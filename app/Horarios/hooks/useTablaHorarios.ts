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
  TIPOS_JORNADA 
} from '../utils/constants';
import { 
  dateCalculations, 
  timeCalculations, 
  selectionCalculations,
  formatters 
} from '../utils/calculations';

export const useTablaHorarios = () => {
  // ==================== ESTADOS PRINCIPALES ====================
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [fechas, setFechas] = useState<FechaDia[]>([]);
  const [horarios, setHorarios] = useState<Record<string, HorarioCompleto>>({});
  const [horariosOriginales, setHorariosOriginales] = useState<Record<string, HorarioCompleto>>({});
  const [horasEntrada, setHorasEntrada] = useState<Record<string, string>>({});
  const [tiposJornada, setTiposJornada] = useState<Record<string, TipoJornada>>({});
  
  // ==================== ESTADOS DE UI ====================
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsuarios, setIsLoadingUsuarios] = useState(true);
  const [mensaje, setMensaje] = useState<MensajeUI | null>(null);
  const [modoSeleccion, setModoSeleccion] = useState<ModoSeleccion | null>(null);
  const [celdasSeleccionadas, setCeldasSeleccionadas] = useState<CeldaSeleccionada[]>([]);
  
  // ==================== ESTADOS DE FECHAS ====================
  const [configFechas, setConfigFechas] = useState<ConfigFechas>({
    vista: "mes",
    fechaRef: HOY,
    año: AÑO_ACTUAL,
    mes: HOY.getMonth()
  });

  // ==================== REFS ====================
  const inicioSeleccionRef = useRef<{ employeeid: string; fecha: string } | null>(null);

  // ==================== MEMOIZED VALUES ====================
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

  const cargarHorarios = useCallback(async () => {
    try {
      if (usuarios.length === 0 || fechas.length === 0) return;

      const fechaInicio = fechas[0].fullDate;
      const fechaFin = fechas[fechas.length - 1].fullDate;
      const url = `/Horarios/api/horario?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
      
      const data = await fetchAPI<{ success: boolean; horarios: any[] }>(url);

      // Inicializar estructuras
      const horariosTemp: Record<string, HorarioCompleto> = {};
      const horasEntradaTemp: Record<string, string> = {};
      const tiposJornadaTemp: Record<string, TipoJornada> = {};

      usuarios.forEach(usuario => {
        fechas.forEach(fecha => {
          const key = `${usuario.employeeid}-${fecha.fullDate}`;
          horariosTemp[key] = {
            employeeid: usuario.employeeid,
            fecha: fecha.fullDate,
            hora_entrada: null,
            hora_salida: null,
            break_1: null,
            colacion: null,
            break_2: null,
            tipo_jornada: "normal"
          };
          horasEntradaTemp[key] = "Libre";
          tiposJornadaTemp[key] = "normal";
        });
      });

      // Llenar con datos existentes
      data.horarios?.forEach((registro: any) => {
        const key = `${registro.employeeid}-${registro.fecha}`;
        if (horariosTemp[key]) {
          const tipoJornada: TipoJornada = 
            ["normal", "entrada_tardia", "salida_temprana"].includes(registro.tipo_jornada)
            ? registro.tipo_jornada
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
          tiposJornadaTemp[key] = tipoJornada;
        }
      });

      setHorarios(horariosTemp);
      setHorariosOriginales(JSON.parse(JSON.stringify(horariosTemp)));
      setHorasEntrada(horasEntradaTemp);
      setTiposJornada(tiposJornadaTemp);
      setIsHydrated(true);
      
    } catch (error: any) {
      console.error("❌ Error cargando horarios:", error);
      setMensaje({ tipo: "error", texto: `Error al cargar horarios: ${error.message}` });
    }
  }, [usuarios, fechas, fetchAPI]);

  // ==================== FUNCIÓN DE GENERACIÓN AUTOMÁTICA ====================
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

  const guardarHorarios = useCallback(async () => {
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
  }, [cambiosPendientes, horarios, cargarHorarios]);

  // ==================== FUNCIONES DE CAMBIO ====================
  const cambiarTipoJornada = useCallback((employeeid: string, fecha: string, tipo: TipoJornada) => {
    const key = `${employeeid}-${fecha}`;
    
    setTiposJornada(prev => ({ ...prev, [key]: tipo }));

    const horaEntradaActual = horasEntrada[key] !== "Libre" ? horasEntrada[key] : null;
    
    if (horaEntradaActual) {
      const nuevasHoras = timeCalculations.calcularHorasSegunJornada(horaEntradaActual, tipo);
      
      setHorarios(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          tipo_jornada: tipo,
          hora_salida: nuevasHoras.hora_salida,
          break_1: nuevasHoras.break1,
          colacion: nuevasHoras.colacion,
          break_2: nuevasHoras.break2
        }
      }));
    } else {
      setHorarios(prev => ({
        ...prev,
        [key]: { ...prev[key], tipo_jornada: tipo }
      }));
    }

    setMensaje(null);
  }, [horasEntrada]);

  const cambiarHoraEntrada = useCallback((employeeid: string, fecha: string, hora: string) => {
    const key = `${employeeid}-${fecha}`;
    
    setHorasEntrada(prev => ({ ...prev, [key]: hora }));

    const tipoJornadaActual = tiposJornada[key] || "normal";
    
    if (hora !== "Libre") {
      const nuevasHoras = timeCalculations.calcularHorasSegunJornada(hora, tipoJornadaActual);
      
      setHorarios(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          hora_entrada: hora,
          tipo_jornada: tipoJornadaActual,
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
          tipo_jornada: tipoJornadaActual,
          hora_salida: null,
          break_1: null,
          colacion: null,
          break_2: null
        }
      }));
    }

    setMensaje(null);
  }, [tiposJornada]);

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
  const aplicarTipoJornadaGlobal = useCallback((tipo: TipoJornada) => {
    if (celdasSeleccionadas.length === 0) {
      setMensaje({ tipo: "error", texto: "Selecciona al menos una celda primero" });
      return;
    }

    const nuevosTiposJornada = { ...tiposJornada };
    const nuevosHorarios = { ...horarios };
    
    celdasSeleccionadas.forEach(({ employeeid, fecha }) => {
      const key = `${employeeid}-${fecha}`;
      
      nuevosTiposJornada[key] = tipo;
      
      const horaEntradaActual = horasEntrada[key];
      if (horaEntradaActual && horaEntradaActual !== "Libre") {
        const nuevasHoras = timeCalculations.calcularHorasSegunJornada(horaEntradaActual, tipo);
        
        nuevosHorarios[key] = {
          ...nuevosHorarios[key],
          tipo_jornada: tipo,
          hora_salida: nuevasHoras.hora_salida,
          break_1: nuevasHoras.break1,
          colacion: nuevasHoras.colacion,
          break_2: nuevasHoras.break2
        };
      } else {
        nuevosHorarios[key] = {
          ...nuevosHorarios[key],
          tipo_jornada: tipo
        };
      }
    });

    setTiposJornada(nuevosTiposJornada);
    setHorarios(nuevosHorarios);

    const nombreTipo = TIPOS_JORNADA.find(t => t.value === tipo)?.label || tipo;
    setMensaje({
      tipo: "success",
      texto: `Aplicado "${nombreTipo}" a ${celdasSeleccionadas.length} celda(s)`,
    });
  }, [celdasSeleccionadas, tiposJornada, horasEntrada, horarios]);

  const aplicarHoraGlobal = useCallback((hora: string) => {
    if (celdasSeleccionadas.length === 0) {
      setMensaje({ tipo: "error", texto: "Selecciona al menos una celda primero" });
      return;
    }

    const nuevasHorasEntrada = { ...horasEntrada };
    const nuevosHorarios = { ...horarios };
    
    celdasSeleccionadas.forEach(({ employeeid, fecha }) => {
      const key = `${employeeid}-${fecha}`;
      const tipoJornadaActual = tiposJornada[key] || "normal";
      
      nuevasHorasEntrada[key] = hora;
      
      if (hora !== "Libre") {
        const nuevasHoras = timeCalculations.calcularHorasSegunJornada(hora, tipoJornadaActual);
        
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
  }, [celdasSeleccionadas, horasEntrada, tiposJornada, horarios]);

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

  const handleRevertir = useCallback(() => {
    setHorarios(JSON.parse(JSON.stringify(horariosOriginales)));
    
    const horasEntradaRevertidas: Record<string, string> = {};
    const tiposJornadaRevertidos: Record<string, TipoJornada> = {};
    
    Object.keys(horariosOriginales).forEach(key => {
      const horario = horariosOriginales[key];
      horasEntradaRevertidas[key] = horario.hora_entrada || "Libre";
      tiposJornadaRevertidos[key] = horario.tipo_jornada;
    });
    
    setHorasEntrada(horasEntradaRevertidas);
    setTiposJornada(tiposJornadaRevertidos);
    
    setMensaje({ tipo: "success", texto: "Cambios revertidos" });
    limpiarSeleccion();
  }, [horariosOriginales, limpiarSeleccion]);

  const handleRecargarUsuarios = useCallback(async () => {
    await cargarUsuarios();
    setMensaje({ tipo: "success", texto: "Usuarios recargados" });
    limpiarSeleccion();
  }, [cargarUsuarios, limpiarSeleccion]);

  // ==================== EFFECTS ====================
  useEffect(() => { 
    cargarUsuarios(); 
  }, [cargarUsuarios]);

  useEffect(() => {
    const nuevasFechas = dateCalculations.generarFechasPorVista(configFechas);
    setFechas(nuevasFechas);
  }, [configFechas]);

  useEffect(() => { 
    if (usuarios.length > 0 && fechas.length > 0 && isHydrated) {
      cargarHorarios(); 
    }
  }, [usuarios, fechas, isHydrated, cargarHorarios]);

  // ==================== RETORNO DEL HOOK ====================
  return {
    // Estados
    usuarios,
    fechas,
    horarios,
    horariosOriginales,
    horasEntrada,
    tiposJornada,
    isHydrated,
    isLoading,
    isLoadingUsuarios,
    mensaje,
    modoSeleccion,
    celdasSeleccionadas,
    configFechas,
    
    // Valores calculados
    cambiosPendientes,
    todasCeldasSeleccionadas,
    textoRangoFechas,
    textoSemana,
    
    // Setters
    setMensaje,
    
    // Funciones de API
    guardarHorarios,
    generarHorariosAutomaticos, // NUEVO: función de generación automática
    
    // Funciones de cambio
    cambiarTipoJornada,
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
    aplicarTipoJornadaGlobal,
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
    TIPOS_JORNADA,
    AÑOS_DISPONIBLES
  };
};