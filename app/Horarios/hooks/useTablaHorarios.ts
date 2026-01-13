// app/Horarios/hooks/useTablaHorarios.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Usuario,
  HorarioCompleto,
  FechaDia,
  CeldaSeleccionada,
  TipoJornada,
  ModoSeleccion,
  VistaFecha,
  ConfigFechas,
  MensajeUI
} from '../utils/types';
import {
  HOY,
  AÑO_ACTUAL,
  AÑOS_DISPONIBLES,
  HORAS_OPCIONES,
  HORAS_CHILE,
  HORAS_COLOMBIA,
  HORAS_DEFAULT
} from '../utils/constants';
import {
  dateCalculations,
  selectionCalculations,
  formatters,
  calcularHorasSegunJornada
} from '../utils/calculations';

export const useTablaHorarios = () => {
  // ==================== ESTADOS PRINCIPALES ====================
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [fechas, setFechas] = useState<FechaDia[]>([]);
  const [horarios, setHorarios] = useState<Record<string, HorarioCompleto>>({});
  const [horariosOriginales, setHorariosOriginales] = useState<Record<string, HorarioCompleto>>({});
  const [horasEntrada, setHorasEntrada] = useState<Record<string, string>>({});
  const [festivos, setFestivos] = useState<Array<{
    fecha: string;
    nombre: string;
    pais: 'chile' | 'colombia' | 'ambos';
    nacional?: boolean;
    observaciones?: string;
  }>>([]);

  // ==================== ESTADOS DE UI ====================
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsuarios, setIsLoadingUsuarios] = useState(true);
  const [isLoadingFestivos, setIsLoadingFestivos] = useState(false);
  const [mensaje, setMensaje] = useState<MensajeUI | null>(null);
  const [modoSeleccion, setModoSeleccion] = useState<ModoSeleccion | null>(null);
  const [celdasSeleccionadas, setCeldasSeleccionadas] = useState<CeldaSeleccionada[]>([]);
  const [mostrarGenerador5x2, setMostrarGenerador5x2] = useState(false);

  // ==================== ESTADOS DE FECHAS ====================
  const [configFechas, setConfigFechas] = useState<ConfigFechas>({
    vista: "mes",
    fechaRef: HOY,
    año: AÑO_ACTUAL,
    mes: HOY.getMonth()
  });

  // ==================== REFS ====================
  const inicioSeleccionRef = useRef<{ employeeid: string; fecha: string } | null>(null);

  // ==================== API FUNCTIONS ====================
  const fetchAPI = useCallback(async <T>(url: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
      cache: "no-store",
      ...options
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || `Error ${response.status}`);
    return data;
  }, []);

  // ==================== CARGA DE FESTIVOS ====================
  const cargarFestivos = useCallback(async () => {
    try {
      setIsLoadingFestivos(true);
      const año = configFechas.año;

      console.log(`📅 Cargando festivos para el año ${año}...`);

      // Cargar festivos de ambos países
      const [resChile, resColombia] = await Promise.all([
        fetch(`/Horarios/api/festivos?pais=Chile&año=${año}`),
        fetch(`/Horarios/api/festivos?pais=Colombia&año=${año}`)
      ]);

      const dataChile = await resChile.json();
      const dataColombia = await resColombia.json();

      console.log('🎯 Festivos Chile:', dataChile);
      console.log('🎯 Festivos Colombia:', dataColombia);

      // Crear array para combinar festivos
      const festivosCombinados: Array<{
        fecha: string;
        nombre: string;
        pais: 'chile' | 'colombia' | 'ambos';
        nacional?: boolean;
        observaciones?: string;
      }> = [];

      // Mapa para agrupar por fecha
      const festivosPorFecha: Record<string, {
        fecha: string;
        nombres: string[];
        paises: ('chile' | 'colombia' | 'ambos')[];
      }> = {};

      // Procesar festivos de Chile
      if (dataChile.success && dataChile.festivos) {
        dataChile.festivos.forEach((f: any) => {
          const fecha = f.fecha;
          if (!festivosPorFecha[fecha]) {
            festivosPorFecha[fecha] = {
              fecha,
              nombres: [],
              paises: []
            };
          }
          festivosPorFecha[fecha].nombres.push(f.descripcion);
          if (!festivosPorFecha[fecha].paises.includes('chile')) {
            festivosPorFecha[fecha].paises.push('chile');
          }
        });
      }

      // Procesar festivos de Colombia
      if (dataColombia.success && dataColombia.festivos) {
        dataColombia.festivos.forEach((f: any) => {
          const fecha = f.fecha;
          if (!festivosPorFecha[fecha]) {
            festivosPorFecha[fecha] = {
              fecha,
              nombres: [],
              paises: []
            };
          }
          festivosPorFecha[fecha].nombres.push(f.descripcion);
          if (!festivosPorFecha[fecha].paises.includes('colombia')) {
            festivosPorFecha[fecha].paises.push('colombia');
          }
        });
      }

      // Convertir a formato para la tabla
      Object.values(festivosPorFecha).forEach(item => {
        let pais: 'chile' | 'colombia' | 'ambos' = 'chile';
        if (item.paises.includes('chile') && item.paises.includes('colombia')) {
          pais = 'ambos';
        } else if (item.paises.includes('colombia')) {
          pais = 'colombia';
        }

        festivosCombinados.push({
          fecha: item.fecha,
          nombre: item.nombres[0] || 'Festivo',
          pais,
          nacional: true,
          observaciones: item.nombres.length > 1 ?
            `También: ${item.nombres.slice(1).join(', ')}` : undefined
        });
      });

      console.log(`✅ Festivos combinados: ${festivosCombinados.length}`);
      setFestivos(festivosCombinados);

    } catch (error: any) {
      console.error("❌ Error cargando festivos:", error);
      setFestivos([]);
    } finally {
      setIsLoadingFestivos(false);
    }
  }, [configFechas.año]);

  // ==================== CARGA DE USUARIOS ====================
  const cargarUsuarios = useCallback(async () => {
    try {
      setIsLoadingUsuarios(true);
      const data = await fetchAPI<{ success: boolean; usuarios: Usuario[] }>("/Horarios/api/usuarios");
      setUsuarios(data.usuarios || []);
    } catch (error: any) {
      console.error("❌ Error cargando usuarios:", error);
      setMensaje({ tipo: "error", texto: `Error al cargar usuarios: ${error.message}` });
      setUsuarios([]);
    } finally {
      setIsLoadingUsuarios(false);
    }
  }, [fetchAPI]);

  // ==================== CARGA DE HORARIOS ====================
  const cargarHorarios = useCallback(async () => {
    try {
      if (usuarios.length === 0 || fechas.length === 0) return;

      const fechaInicio = fechas[0].fullDate;
      const fechaFin = fechas[fechas.length - 1].fullDate;
      const url = `/Horarios/api/horario?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;

      console.log(`📥 Cargando horarios del ${fechaInicio} al ${fechaFin}`);

      const data = await fetchAPI<{ success: boolean; horarios: any[] }>(url);

      // Inicializar estructuras
      const horariosTemp: Record<string, HorarioCompleto> = {};
      const horasEntradaTemp: Record<string, string> = {};

      // Primero inicializar todo como "Libre"
      usuarios.forEach(usuario => {
        fechas.forEach(fecha => {
          const key = `${usuario.employeeid}-${fecha.fullDate}`;

          // Inicializar con valores por defecto
          horariosTemp[key] = {
            employeeid: usuario.employeeid,
            fecha: fecha.fullDate,
            hora_entrada: null,
            hora_salida: null,
            break_1: null,
            colacion: null,
            break_2: null,
            tipo_jornada: "normal" as TipoJornada
          };

          horasEntradaTemp[key] = "Libre";
        });
      });

      // Llenar con datos existentes de la API
      if (data.horarios && data.horarios.length > 0) {
        console.log(`✅ ${data.horarios.length} horarios cargados de la API`);

        data.horarios.forEach((registro: any) => {
          const key = `${registro.employeeid}-${registro.fecha}`;

          if (horariosTemp[key]) {
            const tipoJornada: TipoJornada =
              ["normal", "entrada_tardia", "salida_temprana", "apertura", "cierre"]
                .includes(registro.tipo_jornada)
                ? registro.tipo_jornada as TipoJornada
                : "normal";

            horariosTemp[key] = {
              ...horariosTemp[key],
              hora_entrada: registro.hora_entrada || null,
              hora_salida: registro.hora_salida || null,
              break_1: registro.break_1 || null,
              colacion: registro.colacion || null,
              break_2: registro.break_2 || null,
              tipo_jornada: tipoJornada
            };

            horasEntradaTemp[key] = registro.hora_entrada
              ? registro.hora_entrada.substring(0, 5)
              : "Libre";
          }
        });
      } else {
        console.log('ℹ️ No hay horarios existentes para este rango');
      }

      // Actualizar estados
      setHorarios(horariosTemp);
      setHorariosOriginales(JSON.parse(JSON.stringify(horariosTemp)));
      setHorasEntrada(horasEntradaTemp);

      // Marcar como hidratado después de cargar
      setIsHydrated(true);

    } catch (error: any) {
      console.error("❌ Error cargando horarios:", error);
      setMensaje({
        tipo: "error",
        texto: `Error al cargar horarios: ${error.message}`
      });

      // Aún así marcar como hidratado para evitar bucles
      setIsHydrated(true);
    }
  }, [usuarios, fechas, fetchAPI]);

  // ==================== FUNCIÓN DE GENERACIÓN AUTOMÁTICA SIMPLE ====================
  const generarHorariosAutomaticos = useCallback(async (meses: number = 2) => {
    if (usuarios.length === 0) {
      setMensaje({ tipo: "error", texto: "No hay usuarios para generar horarios" });
      return;
    }

    setIsLoading(true);
    setMensaje({ tipo: "info", texto: `Generando horarios automáticos para ${meses} meses...` });

    try {
      const response = await fetch('/Horarios/api/horario', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ meses })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al generar horarios');
      }

      // Recargar los horarios después de la generación
      await cargarHorarios();

      setMensaje({
        tipo: 'success',
        texto: `✅ ${data.message} (${data.resumen?.insertados || 0} horarios generados)`
      });

      // Recargar usuarios también por si hubo cambios
      await cargarUsuarios();

    } catch (error: any) {
      setMensaje({
        tipo: 'error',
        texto: `Error al generar horarios: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  }, [usuarios.length, cargarHorarios, cargarUsuarios]);

  // ==================== FUNCIÓN DE GENERACIÓN MALLA 5x2 ====================
  const generarMalla5x2 = useCallback(async (params: {
    fecha_inicio: string;
    fecha_fin: string;
    employeeids?: string[];
  }) => {
    if (usuarios.length === 0) {
      setMensaje({ tipo: "error", texto: "No hay usuarios para generar horarios" });
      return;
    }

    setIsLoading(true);
    setMensaje({
      tipo: "info",
      texto: `🚀 Generando malla 5x2 del ${params.fecha_inicio} al ${params.fecha_fin}...`
    });

    try {
      const response = await fetch('/Horarios/api/horario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tipo: '5x2',
          ...params
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al generar malla 5x2');
      }

      // Recargar los horarios después de la generación
      await cargarHorarios();

      setMensaje({
        tipo: 'success',
        texto: `✅ ${data.message}`
      });

      setMostrarGenerador5x2(false);

    } catch (error: any) {
      setMensaje({
        tipo: 'error',
        texto: `Error al generar malla: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  }, [usuarios.length, cargarHorarios]);

  // ==================== GUARDAR HORARIOS ====================
  const guardarHorarios = useCallback(async () => {
    const cambiosPendientes = Object.keys(horarios).filter(key => {
      const actual = horarios[key];
      const original = horariosOriginales[key];
      if (!original) return true;

      return (
        actual.hora_entrada !== original.hora_entrada ||
        actual.tipo_jornada !== original.tipo_jornada ||
        actual.hora_salida !== original.hora_salida ||
        actual.break_1 !== original.break_1 ||
        actual.colacion !== original.colacion ||
        actual.break_2 !== original.break_2
      );
    }).length;

    if (cambiosPendientes === 0) {
      setMensaje({ tipo: "error", texto: "No hay cambios para guardar" });
      return;
    }

    setIsLoading(true);
    setMensaje(null);

    try {
      const payload = Object.values(horarios).map(horario => ({
        employeeid: horario.employeeid,
        fecha: horario.fecha,
        hora_entrada: horario.hora_entrada || "Libre",
        tipo_jornada: horario.tipo_jornada,
      }));

      const response = await fetch("/Horarios/api/horario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Error al guardar");

      await cargarHorarios();
      limpiarSeleccion();
      setMensaje({ tipo: "success", texto: `✓ ${data.message}` });
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [horarios, horariosOriginales, cargarHorarios]);

  // ==================== FUNCIONES DE CAMBIO ====================
  const cambiarHoraEntrada = useCallback((employeeid: string, fecha: string, hora: string) => {
    const key = `${employeeid}-${fecha}`;

    setHorasEntrada(prev => ({ ...prev, [key]: hora }));

    const tipoJornadaActual = horarios[key]?.tipo_jornada || "normal" as TipoJornada;

    if (hora !== "Libre") {
      const nuevasHoras = calcularHorasSegunJornada(hora, tipoJornadaActual);

      setHorarios(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          hora_entrada: hora,
          hora_salida: nuevasHoras.hora_salida,
          break_1: nuevasHoras.break1,
          colacion: nuevasHoras.colacion,
          break_2: nuevasHoras.break2
        }
      }));
    } else {
      setHorarios(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          hora_entrada: null,
          hora_salida: null,
          break_1: null,
          colacion: null,
          break_2: null
        }
      }));
    }

    setMensaje(null);
  }, [horarios]);

  // ==================== FUNCIONES DE SELECCIÓN ====================
  const limpiarSeleccion = useCallback(() => {
    setCeldasSeleccionadas([]);
    inicioSeleccionRef.current = null;
  }, []);

  const toggleSeleccionCelda = useCallback((employeeid: string, fecha: string) => {
    if (!modoSeleccion) return;

    const existe = selectionCalculations.estaSeleccionada(celdasSeleccionadas, employeeid, fecha);

    setCeldasSeleccionadas(prev => existe
      ? prev.filter(c => !(c.employeeid === employeeid && c.fecha === fecha))
      : [...prev, { employeeid, fecha }]
    );
  }, [modoSeleccion, celdasSeleccionadas]);

  const handleMouseDownCelda = useCallback((employeeid: string, fecha: string, e: React.MouseEvent) => {
    if (!modoSeleccion) return;

    if (modoSeleccion === "rango") {
      e.preventDefault();
      inicioSeleccionRef.current = { employeeid, fecha };
      setCeldasSeleccionadas([{ employeeid, fecha }]);
    } else if (modoSeleccion === "disperso") {
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        toggleSeleccionCelda(employeeid, fecha);
      } else {
        setCeldasSeleccionadas([{ employeeid, fecha }]);
      }
    }
  }, [modoSeleccion, toggleSeleccionCelda]);

  const handleMouseEnterCelda = useCallback((employeeid: string, fecha: string) => {
    if (modoSeleccion !== "rango" || !inicioSeleccionRef.current) return;

    const { employeeid: startEmployeeid, fecha: startFecha } = inicioSeleccionRef.current;
    const nuevasCeldas = selectionCalculations.seleccionarRango(
      startEmployeeid,
      startFecha,
      employeeid,
      fecha,
      usuarios,
      fechas
    );
    setCeldasSeleccionadas(nuevasCeldas);
  }, [modoSeleccion, usuarios, fechas]);

  const handleMouseUp = useCallback(() => {
    inicioSeleccionRef.current = null;
  }, []);

  const toggleSeleccionTodo = useCallback(() => {
    const todasCeldas = selectionCalculations.getTodasCeldas(usuarios, fechas);
    const todasSeleccionadas = celdasSeleccionadas.length === todasCeldas.length;
    setCeldasSeleccionadas(todasSeleccionadas ? [] : todasCeldas);
  }, [usuarios, fechas, celdasSeleccionadas.length]);

  const seleccionarFila = useCallback((employeeid: string) => {
    const celdasFila = selectionCalculations.getCeldasFila(employeeid, fechas);
    setCeldasSeleccionadas(celdasFila);
  }, [fechas]);

  const toggleSeleccionColumna = useCallback((fecha: string) => {
    const celdasColumna = selectionCalculations.getCeldasColumna(fecha, usuarios);
    const columnaCompletaSeleccionada = celdasColumna.every(celda =>
      selectionCalculations.estaSeleccionada(celdasSeleccionadas, celda.employeeid, celda.fecha)
    );

    if (columnaCompletaSeleccionada) {
      setCeldasSeleccionadas(prev => prev.filter(celda => celda.fecha !== fecha));
    } else {
      const nuevasCeldas = [...celdasSeleccionadas];
      celdasColumna.forEach(celda => {
        if (!selectionCalculations.estaSeleccionada(celdasSeleccionadas, celda.employeeid, celda.fecha)) {
          nuevasCeldas.push(celda);
        }
      });
      setCeldasSeleccionadas(nuevasCeldas);
    }
  }, [usuarios, celdasSeleccionadas]);

  const toggleModoSeleccion = useCallback((modo: ModoSeleccion) => {
    setModoSeleccion(prev => prev === modo ? null : modo);
    limpiarSeleccion();
  }, [limpiarSeleccion]);

  // ==================== FUNCIONES GLOBALES ====================
  const aplicarHoraGlobal = useCallback((hora: string) => {
    if (celdasSeleccionadas.length === 0) {
      setMensaje({ tipo: "error", texto: "Selecciona al menos una celda primero" });
      return;
    }

    const nuevasHorasEntrada = { ...horasEntrada };
    const nuevosHorarios = { ...horarios };

    celdasSeleccionadas.forEach(({ employeeid, fecha }) => {
      const key = `${employeeid}-${fecha}`;
      const tipoJornadaActual = nuevosHorarios[key]?.tipo_jornada || "normal" as TipoJornada;

      nuevasHorasEntrada[key] = hora;

      if (hora !== "Libre") {
        const nuevasHoras = calcularHorasSegunJornada(hora, tipoJornadaActual);

        nuevosHorarios[key] = {
          ...nuevosHorarios[key],
          hora_entrada: hora,
          hora_salida: nuevasHoras.hora_salida,
          break_1: nuevasHoras.break1,
          colacion: nuevasHoras.colacion,
          break_2: nuevasHoras.break2
        };
      } else {
        nuevosHorarios[key] = {
          ...nuevosHorarios[key],
          hora_entrada: null,
          hora_salida: null,
          break_1: null,
          colacion: null,
          break_2: null
        };
      }
    });

    setHorasEntrada(nuevasHorasEntrada);
    setHorarios(nuevosHorarios);

    setMensaje({
      tipo: "success",
      texto: `Aplicado "${hora}" a ${celdasSeleccionadas.length} celda(s)`,
    });
  }, [celdasSeleccionadas, horasEntrada, horarios]);

  // ==================== FUNCIONES DE FECHAS ====================
  const cambiarVista = useCallback((vista: VistaFecha) => {
    setConfigFechas(prev => ({ ...prev, vista }));
  }, []);

  const cambiarAño = useCallback((año: number) => {
    setConfigFechas(prev => ({ ...prev, año }));
  }, []);

  const cambiarMes = useCallback((mes: number) => {
    setConfigFechas(prev => ({ ...prev, mes }));
  }, []);

  const cambiarMesNavigation = useCallback((direccion: "anterior" | "siguiente") => {
    setConfigFechas(prev => dateCalculations.cambiarMesNav(prev, direccion, AÑOS_DISPONIBLES));
  }, []);

  const cambiarAñoNavigation = useCallback((direccion: "anterior" | "siguiente") => {
    setConfigFechas(prev => dateCalculations.cambiarAñoNav(prev, direccion, AÑOS_DISPONIBLES));
  }, []);

  const seleccionarMesActual = useCallback(() => {
    setConfigFechas(prev => dateCalculations.seleccionarMesActual(prev, AÑOS_DISPONIBLES));
  }, []);

  const seleccionarSemanaActual = useCallback(() => {
    setConfigFechas(prev => dateCalculations.seleccionarSemanaActual(prev));
  }, []);

  // ==================== FUNCIONES PRINCIPALES ====================
  const handleRevertir = useCallback(() => {
    setHorarios(JSON.parse(JSON.stringify(horariosOriginales)));

    const horasEntradaRevertidas: Record<string, string> = {};

    Object.keys(horariosOriginales).forEach(key => {
      const horario = horariosOriginales[key];
      horasEntradaRevertidas[key] = horario.hora_entrada || "Libre";
    });

    setHorasEntrada(horasEntradaRevertidas);

    setMensaje({ tipo: "success", texto: "Cambios revertidos" });
    limpiarSeleccion();
  }, [horariosOriginales, limpiarSeleccion]);

  const handleRecargarUsuarios = useCallback(async () => {
    await cargarUsuarios();
    setMensaje({ tipo: "success", texto: "Usuarios recargados" });
    limpiarSeleccion();
  }, [cargarUsuarios, limpiarSeleccion]);

  // ==================== VALORES CALCULADOS ====================
  const cambiosPendientes = Object.keys(horarios).filter(key => {
    const actual = horarios[key];
    const original = horariosOriginales[key];
    if (!original) return true;

    return (
      actual.hora_entrada !== original.hora_entrada ||
      actual.tipo_jornada !== original.tipo_jornada ||
      actual.hora_salida !== original.hora_salida ||
      actual.break_1 !== original.break_1 ||
      actual.colacion !== original.colacion ||
      actual.break_2 !== original.break_2
    );
  }).length;

  const todasCeldasSeleccionadas = celdasSeleccionadas.length === usuarios.length * fechas.length;
  const textoRangoFechas = formatters.getRangoFechasTexto(fechas);
  const textoSemana = formatters.getSemanaTexto(configFechas.fechaRef);

  // ==================== EFFECTS ====================
  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  useEffect(() => {
    const nuevasFechas = dateCalculations.generarFechasPorVista(configFechas);
    setFechas(nuevasFechas);
    cargarFestivos();
  }, [configFechas, cargarFestivos]);

  // FIX: Este useEffect debe cargar horarios siempre que usuarios o fechas cambien
  useEffect(() => {
    if (usuarios.length > 0 && fechas.length > 0) {
      // IMPORTANTE: No verificar isHydrated aquí
      cargarHorarios();
    }
  }, [usuarios, fechas, cargarHorarios]); // Eliminado isHydrated de las dependencias

  // ==================== RETORNO DEL HOOK ====================
  return {
    // Estados
    usuarios,
    fechas,
    horarios,
    horariosOriginales,
    horasEntrada,
    festivos,
    isHydrated,
    isLoading,
    isLoadingUsuarios,
    isLoadingFestivos,
    mensaje,
    modoSeleccion,
    celdasSeleccionadas,
    configFechas,
    mostrarGenerador5x2,

    // Valores calculados
    cambiosPendientes,
    todasCeldasSeleccionadas,
    textoRangoFechas,
    textoSemana,

    // Setters
    setMensaje,
    setMostrarGenerador5x2,

    // Funciones de API
    guardarHorarios,
    generarHorariosAutomaticos,
    generarMalla5x2,
    cargarFestivos,

    // Funciones de cambio
    cambiarHoraEntrada,

    // Funciones de selección
    limpiarSeleccion,
    toggleSeleccionCelda,
    handleMouseDownCelda,
    handleMouseEnterCelda,
    handleMouseUp,
    toggleSeleccionTodo,
    seleccionarFila,
    toggleSeleccionColumna,
    toggleModoSeleccion,
    estaSeleccionada: (employeeid: string, fecha: string) =>
      selectionCalculations.estaSeleccionada(celdasSeleccionadas, employeeid, fecha),

    // Funciones globales
    aplicarHoraGlobal,

    // Funciones de fechas
    cambiarVista,
    cambiarAño,
    cambiarMes,
    cambiarMesNavigation,
    cambiarAñoNavigation,
    seleccionarMesActual,
    seleccionarSemanaActual,

    // Funciones principales
    handleRevertir,
    handleRecargarUsuarios,

    // Constantes
    HORAS_OPCIONES,
    HORAS_CHILE,
    HORAS_COLOMBIA,
    HORAS_DEFAULT,
    AÑOS_DISPONIBLES
  };
};