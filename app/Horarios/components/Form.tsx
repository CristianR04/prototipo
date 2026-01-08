"use client";

import React, { useState, useEffect, useRef } from "react";

/* =======================
   TIPOS
======================= */

interface Usuario {
  employeeid: string;
  nombre: string;
}

interface HorarioEntrada {
  employeeid: string;
  fecha: string;
  hora_entrada: string;
}

interface FechaDia {
  id: number;
  fullDate: string;
  diaSemana: string;
  diaNumero: number;
  esFinDeSemana: boolean;
  esHoy: boolean;
}

interface CeldaSeleccionada {
  employeeid: string;
  fecha: string;
}

type ModoSeleccion = "rango" | "disperso";
type VistaFecha = "mes" | "semana" | "personalizado" | "anual";

/* =======================
   FUNCIONES DE FECHAS (JavaScript nativo)
======================= */

// Funciones auxiliares para manejo de fechas
const startOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const endOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

const startOfWeek = (date: Date, weekStartsOn: number = 1): Date => {
  const day = date.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - diff);
};

const endOfWeek = (date: Date, weekStartsOn: number = 1): Date => {
  const start = startOfWeek(date, weekStartsOn);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
};

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const subMonths = (date: Date, months: number): Date => {
  return addMonths(date, -months);
};

const addWeeks = (date: Date, weeks: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + (weeks * 7));
  return result;
};

const subWeeks = (date: Date, weeks: number): Date => {
  return addWeeks(date, -weeks);
};

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const startOfYear = (date: Date): Date => {
  return new Date(date.getFullYear(), 0, 1);
};

const endOfYear = (date: Date): Date => {
  return new Date(date.getFullYear(), 11, 31);
};

const eachDayOfInterval = (interval: { start: Date; end: Date }): Date[] => {
  const days: Date[] = [];
  let current = new Date(interval.start);
  
  while (current <= interval.end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return days;
};

const formatDate = (date: Date, formatStr: string): string => {
  // Formato simple para días y meses
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
  ];
  const monthsFull = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const dayOfWeek = date.getDay();

  switch (formatStr) {
    case 'EEE':
      return days[dayOfWeek];
    case 'dd MMM':
      return `${day.toString().padStart(2, '0')} ${months[month]}`;
    case 'dd MMM yyyy':
      return `${day.toString().padStart(2, '0')} ${months[month]} ${year}`;
    case "dd 'de' MMMM 'de' yyyy":
      return `${day} de ${monthsFull[month]} de ${year}`;
    case 'yyyy-MM-dd':
      return `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    default:
      return date.toISOString().split('T')[0];
  }
};

/* =======================
   COMPONENTE
======================= */

export default function TablaHorariosUnificada() {
  // Estados principales
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [fechas, setFechas] = useState<FechaDia[]>([]);
  const [horarios, setHorarios] = useState<Record<string, HorarioEntrada>>({});
  const [horariosOriginales, setHorariosOriginales] = useState<
    Record<string, HorarioEntrada>
  >({});
  
  // Estados de UI
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsuarios, setIsLoadingUsuarios] = useState(true);
  const [mensaje, setMensaje] = useState<{
    tipo: "success" | "error";
    texto: string;
  } | null>(null);
  const [modoSeleccion, setModoSeleccion] = useState<ModoSeleccion | null>(null);
  const [celdasSeleccionadas, setCeldasSeleccionadas] = useState<
    CeldaSeleccionada[]
  >([]);
  
  // Estados de gestión de fechas
  const [vistaFecha, setVistaFecha] = useState<VistaFecha>("mes");
  const [fechaReferencia, setFechaReferencia] = useState<Date>(new Date());
  const [añoSeleccionado, setAñoSeleccionado] = useState<number>(new Date().getFullYear());
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(new Date().getMonth());
  const [rangoPersonalizado, setRangoPersonalizado] = useState<{
    inicio: Date | null;
    fin: Date | null;
  }>({ inicio: null, fin: null });
  
  // Refs
  const tablaRef = useRef<HTMLDivElement>(null);
  const inicioSeleccionRef = useRef<{ employeeid: string; fecha: string } | null>(null);

  // Opciones de horas
  const horasOpciones = [
    "Libre",
    ...Array.from({ length: 12 }).flatMap((_, i) => {
      const h = 5 + Math.floor(i / 2);
      return [`${String(h).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`];
    }),
  ];

  // 🔄 CÁLCULO DINÁMICO DE AÑOS DISPONIBLES
  // Solo años presente y futuros (presente + 5 años adelante)
  const añosDisponibles = (() => {
    const añoActual = new Date().getFullYear();
    const añosFuturos = 5; // Extender 5 años hacia el futuro
    return Array.from({ length: añosFuturos + 1 }, (_, i) => añoActual + i);
  })();

  // Meses en español
  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  // Días en español
  const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  /* =======================
     GENERACIÓN DE FECHAS
  ======================= */

  const generarFechasPorVista = (): FechaDia[] => {
    let fechaInicio: Date;
    let fechaFin: Date;
    const hoy = new Date();

    switch (vistaFecha) {
      case "mes": {
        // Primer día del mes seleccionado
        fechaInicio = startOfMonth(new Date(añoSeleccionado, mesSeleccionado));
        // Último día del mes seleccionado
        fechaFin = endOfMonth(new Date(añoSeleccionado, mesSeleccionado));
        break;
      }
      
      case "semana": {
        // Lunes de la semana seleccionada
        fechaInicio = startOfWeek(fechaReferencia, 1);
        // Domingo de la semana seleccionada
        fechaFin = endOfWeek(fechaReferencia, 1);
        break;
      }
      
      case "personalizado": {
        if (!rangoPersonalizado.inicio || !rangoPersonalizado.fin) {
          // Si no hay rango personalizado, usar mes actual
          fechaInicio = startOfMonth(hoy);
          fechaFin = endOfMonth(hoy);
        } else {
          fechaInicio = rangoPersonalizado.inicio;
          fechaFin = rangoPersonalizado.fin;
        }
        break;
      }
      
      case "anual": {
        // Todo el año seleccionado
        fechaInicio = startOfYear(new Date(añoSeleccionado, 0, 1));
        fechaFin = endOfYear(new Date(añoSeleccionado, 11, 31));
        break;
      }
      
      default:
        fechaInicio = startOfMonth(hoy);
        fechaFin = endOfMonth(hoy);
    }

    // Generar todos los días del intervalo
    const dias = eachDayOfInterval({ start: fechaInicio, end: fechaFin });
    
    return dias.map((fecha, index) => {
      const diaNumero = fecha.getDate();
      const diaSemanaNumero = fecha.getDay();
      const diaSemana = diasSemana[diaSemanaNumero];
      
      return {
        id: index,
        fullDate: formatDate(fecha, 'yyyy-MM-dd'),
        diaSemana,
        diaNumero,
        esFinDeSemana: diaSemanaNumero === 0 || diaSemanaNumero === 6,
        esHoy: isSameDay(fecha, hoy)
      };
    });
  };

  /* =======================
     CARGAR USUARIOS
  ======================= */

  const cargarUsuarios = async () => {
    try {
      setIsLoadingUsuarios(true);
      console.log("📡 Cargando usuarios desde la base de datos...");

      const response = await fetch("/Horarios/api/usuarios", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      setUsuarios(data.usuarios || []);
      console.log(`✅ ${data.usuarios?.length || 0} usuarios cargados`);
    } catch (error: any) {
      console.error("❌ Error al cargar usuarios:", error);
      setMensaje({
        tipo: "error",
        texto: `Error al cargar usuarios: ${error.message}`,
      });
      setUsuarios([]);
    } finally {
      setIsLoadingUsuarios(false);
    }
  };

  /* =======================
     CONSTRUIR ESTRUCTURA VACÍA
  ======================= */

  const construirEstructuraVacia = () => {
    const estructura: Record<string, HorarioEntrada> = {};

    usuarios.forEach((usuario) => {
      fechas.forEach((fecha) => {
        const key = `${usuario.employeeid}-${fecha.fullDate}`;
        estructura[key] = {
          employeeid: usuario.employeeid,
          fecha: fecha.fullDate,
          hora_entrada: "Libre",
        };
      });
    });

    return estructura;
  };

  const detectarCambios = () => {
    return Object.keys(horarios).filter((key) => {
      return horarios[key].hora_entrada !== horariosOriginales[key]?.hora_entrada;
    });
  };

  /* =======================
     CARGAR HORARIOS
  ======================= */

  const cargarHorarios = async () => {
    try {
      if (usuarios.length === 0 || fechas.length === 0) {
        console.log("⏳ Esperando usuarios y fechas...");
        return;
      }

      const fechaInicio = fechas[0].fullDate;
      const fechaFin = fechas[fechas.length - 1].fullDate;
      const url = `/Horarios/api/horario?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;

      console.log("📡 Cargando horarios existentes...");

      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      // Crear estructura vacía
      const estructura = construirEstructuraVacia();

      console.log("📦 Registros en BD:", data.horarios?.length || 0);

      // Rellenar con datos existentes
      data.horarios?.forEach((registro: any) => {
        const key = `${registro.employeeid}-${registro.fecha}`;

        if (estructura[key]) {
          const hora = registro.hora_entrada
            ? registro.hora_entrada.substring(0, 5)
            : "Libre";

          estructura[key].hora_entrada = hora;
        }
      });

      // Establecer estado
      setHorarios(estructura);
      setHorariosOriginales(JSON.parse(JSON.stringify(estructura)));
      setIsHydrated(true);

      console.log(`✅ Formulario listo: ${Object.keys(estructura).length} celdas cargadas`);
    } catch (error: any) {
      console.error("❌ Error al cargar horarios:", error);
      setMensaje({
        tipo: "error",
        texto: `Error al cargar horarios: ${error.message}`,
      });

      // Mostrar formulario vacío si falla la carga
      const estructura = construirEstructuraVacia();
      setHorarios(estructura);
      setHorariosOriginales(JSON.parse(JSON.stringify(estructura)));
      setIsHydrated(true);
    }
  };

  /* =======================
     FUNCIONES DE SELECCIÓN
  ======================= */

  const toggleSeleccionCelda = (employeeid: string, fecha: string) => {
    if (!modoSeleccion) return;

    const celda = { employeeid, fecha };
    const existe = celdasSeleccionadas.some(
      (c) => c.employeeid === employeeid && c.fecha === fecha
    );

    if (existe) {
      setCeldasSeleccionadas(
        celdasSeleccionadas.filter(
          (c) => !(c.employeeid === employeeid && c.fecha === fecha)
        )
      );
    } else {
      setCeldasSeleccionadas([...celdasSeleccionadas, celda]);
    }
  };

  const seleccionarRango = (
    startEmployeeid: string,
    startFecha: string,
    endEmployeeid: string,
    endFecha: string
  ) => {
    if (modoSeleccion !== "rango") return;

    const startUserIndex = usuarios.findIndex((u) => u.employeeid === startEmployeeid);
    const endUserIndex = usuarios.findIndex((u) => u.employeeid === endEmployeeid);
    const startFechaIndex = fechas.findIndex((f) => f.fullDate === startFecha);
    const endFechaIndex = fechas.findIndex((f) => f.fullDate === endFecha);

    const minUserIndex = Math.min(startUserIndex, endUserIndex);
    const maxUserIndex = Math.max(startUserIndex, endUserIndex);
    const minFechaIndex = Math.min(startFechaIndex, endFechaIndex);
    const maxFechaIndex = Math.max(startFechaIndex, endFechaIndex);

    const nuevasCeldas: CeldaSeleccionada[] = [];

    for (let i = minUserIndex; i <= maxUserIndex; i++) {
      for (let j = minFechaIndex; j <= maxFechaIndex; j++) {
        nuevasCeldas.push({
          employeeid: usuarios[i].employeeid,
          fecha: fechas[j].fullDate,
        });
      }
    }

    setCeldasSeleccionadas(nuevasCeldas);
  };

  const limpiarSeleccion = () => {
    setCeldasSeleccionadas([]);
    inicioSeleccionRef.current = null;
  };

  const aplicarHoraGlobal = (hora: string) => {
    if (celdasSeleccionadas.length === 0) {
      setMensaje({
        tipo: "error",
        texto: "Selecciona al menos una celda primero",
      });
      return;
    }

    const nuevosHorarios = { ...horarios };

    celdasSeleccionadas.forEach((celda) => {
      const key = `${celda.employeeid}-${celda.fecha}`;
      if (nuevosHorarios[key]) {
        nuevosHorarios[key] = {
          ...nuevosHorarios[key],
          hora_entrada: hora,
        };
      }
    });

    setHorarios(nuevosHorarios);
    setMensaje({
      tipo: "success",
      texto: `Aplicado "${hora}" a ${celdasSeleccionadas.length} celda(s)`,
    });
  };

  const estaSeleccionada = (employeeid: string, fecha: string) => {
    return celdasSeleccionadas.some(
      (c) => c.employeeid === employeeid && c.fecha === fecha
    );
  };

  const handleMouseDownCelda = (employeeid: string, fecha: string, e: React.MouseEvent) => {
    if (!modoSeleccion) return;
    
    if (modoSeleccion === "rango") {
      e.preventDefault();
      inicioSeleccionRef.current = { employeeid, fecha };
      
      // Para modo rango, empezamos una nueva selección
      setCeldasSeleccionadas([{ employeeid, fecha }]);
    } else if (modoSeleccion === "disperso") {
      // Para modo disperso, checkeamos si se presiona Ctrl/Shift
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        // Mantener selección existente y agregar/quitar
        toggleSeleccionCelda(employeeid, fecha);
      } else {
        // Sin Ctrl/Shift, nueva selección
        setCeldasSeleccionadas([{ employeeid, fecha }]);
      }
    }
  };

  const handleMouseEnterCelda = (employeeid: string, fecha: string) => {
    if (modoSeleccion !== "rango" || !inicioSeleccionRef.current) return;
    
    const { employeeid: startEmployeeid, fecha: startFecha } = inicioSeleccionRef.current;
    seleccionarRango(startEmployeeid, startFecha, employeeid, fecha);
  };

  const handleMouseUp = () => {
    inicioSeleccionRef.current = null;
  };

  const toggleSeleccionTodo = () => {
    if (celdasSeleccionadas.length === usuarios.length * fechas.length) {
      // Si todo está seleccionado, limpiar
      limpiarSeleccion();
    } else {
      // Si no todo está seleccionado, seleccionar todo
      const todasCeldas: CeldaSeleccionada[] = [];
      
      usuarios.forEach(usuario => {
        fechas.forEach(fecha => {
          todasCeldas.push({
            employeeid: usuario.employeeid,
            fecha: fecha.fullDate
          });
        });
      });
      
      setCeldasSeleccionadas(todasCeldas);
    }
  };

  const seleccionarFila = (employeeid: string) => {
    const celdasUsuario = fechas.map(fecha => ({
      employeeid,
      fecha: fecha.fullDate
    }));
    
    setCeldasSeleccionadas(celdasUsuario);
  };

  const toggleSeleccionColumna = (fecha: string) => {
    const todasCeldasColumna = usuarios.map(usuario => ({
      employeeid: usuario.employeeid,
      fecha
    }));
    
    // Verificar si toda la columna ya está seleccionada
    const columnaCompletaSeleccionada = todasCeldasColumna.every(celda =>
      celdasSeleccionadas.some(
        c => c.employeeid === celda.employeeid && c.fecha === celda.fecha
      )
    );
    
    if (columnaCompletaSeleccionada) {
      // Si ya está seleccionada, remover todas las celdas de esa columna
      setCeldasSeleccionadas(prev =>
        prev.filter(celda => celda.fecha !== fecha)
      );
    } else {
      // Si no está completamente seleccionada, agregar todas las celdas de la columna
      const nuevasCeldas = [...celdasSeleccionadas];
      todasCeldasColumna.forEach(celda => {
        if (!nuevasCeldas.some(c => c.employeeid === celda.employeeid && c.fecha === celda.fecha)) {
          nuevasCeldas.push(celda);
        }
      });
      setCeldasSeleccionadas(nuevasCeldas);
    }
  };

  const toggleModoSeleccion = (modo: ModoSeleccion) => {
    if (modoSeleccion === modo) {
      // Desactivar si ya está activo
      setModoSeleccion(null);
      limpiarSeleccion();
    } else {
      // Activar nuevo modo
      setModoSeleccion(modo);
    }
  };

  /* =======================
     FUNCIONES DE GESTIÓN DE FECHAS
  ======================= */

  const cambiarMes = (direccion: "anterior" | "siguiente") => {
    if (vistaFecha === "mes") {
      const nuevoMes = direccion === "anterior" 
        ? subMonths(new Date(añoSeleccionado, mesSeleccionado), 1)
        : addMonths(new Date(añoSeleccionado, mesSeleccionado), 1);
      
      // 🔄 Verificar que el año resultante esté en años disponibles
      const añoResultante = nuevoMes.getFullYear();
      if (añosDisponibles.includes(añoResultante)) {
        setAñoSeleccionado(añoResultante);
        setMesSeleccionado(nuevoMes.getMonth());
      } else {
        // Si se sale del rango, mantener el año actual
        const añoActual = new Date().getFullYear();
        setAñoSeleccionado(añoActual);
        setMesSeleccionado(nuevoMes.getMonth());
      }
    } else if (vistaFecha === "semana") {
      setFechaReferencia(direccion === "anterior" 
        ? subWeeks(fechaReferencia, 1)
        : addWeeks(fechaReferencia, 1)
      );
    }
  };

  const cambiarAño = (direccion: "anterior" | "siguiente") => {
    const nuevoAño = direccion === "anterior" ? añoSeleccionado - 1 : añoSeleccionado + 1;
    
    // 🔄 Solo permitir navegación dentro de años disponibles
    if (añosDisponibles.includes(nuevoAño)) {
      setAñoSeleccionado(nuevoAño);
    } else if (nuevoAño < Math.min(...añosDisponibles)) {
      // Si intenta ir más atrás del año actual, mantener el año actual
      setAñoSeleccionado(new Date().getFullYear());
    }
    // No hacer nada si intenta ir más allá de los años futuros configurados
  };

  const seleccionarMes = (mes: number) => {
    setMesSeleccionado(mes);
    setVistaFecha("mes");
  };

  const seleccionarSemanaActual = () => {
    setFechaReferencia(new Date());
    setVistaFecha("semana");
  };

  const seleccionarMesActual = () => {
    const hoy = new Date();
    const añoActual = hoy.getFullYear();
    
    // Asegurarse de que el año actual esté en años disponibles
    if (añosDisponibles.includes(añoActual)) {
      setAñoSeleccionado(añoActual);
    } else {
      // Si por alguna razón no está, usar el primer año disponible
      setAñoSeleccionado(añosDisponibles[0]);
    }
    
    setMesSeleccionado(hoy.getMonth());
    setVistaFecha("mes");
  };

  const getRangoFechasTexto = () => {
    if (fechas.length === 0) return "";
    
    const primera = fechas[0];
    const ultima = fechas[fechas.length - 1];
    
    if (primera.fullDate === ultima.fullDate) {
      const fecha = new Date(primera.fullDate);
      return `${fecha.getDate()} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()}`;
    }
    
    const primeraFecha = new Date(primera.fullDate);
    const ultimaFecha = new Date(ultima.fullDate);
    
    const mesesAbr = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    
    return `${primeraFecha.getDate()} ${mesesAbr[primeraFecha.getMonth()]} - ${ultimaFecha.getDate()} ${mesesAbr[ultimaFecha.getMonth()]} ${ultimaFecha.getFullYear()}`;
  };

  /* =======================
     EFFECTS
  ======================= */

  useEffect(() => {
    // Cargar usuarios
    cargarUsuarios();
  }, []);

  useEffect(() => {
    // Generar fechas según la vista actual
    const nuevasFechas = generarFechasPorVista();
    setFechas(nuevasFechas);
  }, [vistaFecha, fechaReferencia, añoSeleccionado, mesSeleccionado, rangoPersonalizado]);

  useEffect(() => {
    // Cuando los usuarios y fechas estén listos, cargar horarios
    if (usuarios.length > 0 && fechas.length > 0) {
      cargarHorarios();
    }
  }, [usuarios, fechas]);

  /* =======================
     HANDLERS
  ======================= */

  const handleCambioHora = (employeeid: string, fecha: string, valor: string) => {
    const key = `${employeeid}-${fecha}`;
    setHorarios((prev) => ({
      ...prev,
      [key]: { ...prev[key], hora_entrada: valor },
    }));
    setMensaje(null);
  };

  const handleGuardar = async () => {
    const cambios = detectarCambios();

    if (cambios.length === 0) {
      setMensaje({ tipo: "error", texto: "No hay cambios para guardar" });
      return;
    }

    setIsLoading(true);
    setMensaje(null);

    try {
      const payload = Object.values(horarios);

      console.log("💾 Guardando", payload.length, "registros...");
      console.log("📝 Cambios detectados:", cambios.length);

      const response = await fetch("/Horarios/api/horario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error al guardar");
      }

      console.log("✅ Guardado exitoso:", data.message);

      // Recargar datos actualizados
      await cargarHorarios();

      // Limpiar selección después de guardar
      limpiarSeleccion();

      setMensaje({
        tipo: "success",
        texto: `✓ ${data.message}`,
      });
    } catch (error: any) {
      console.error("❌ Error al guardar:", error);
      setMensaje({ tipo: "error", texto: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevertir = () => {
    setHorarios(JSON.parse(JSON.stringify(horariosOriginales)));
    setMensaje({ tipo: "success", texto: "Cambios revertidos" });
    limpiarSeleccion();
  };

  const handleRecargarUsuarios = async () => {
    await cargarUsuarios();
    setMensaje({ tipo: "success", texto: "Usuarios recargados" });
    limpiarSeleccion();
  };

  /* =======================
     RENDER
  ======================= */

  if (isLoadingUsuarios) {
    return (
      <div className="p-6 bg-zinc-950 min-h-screen flex items-center justify-center">
        <div className="text-zinc-400 flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
          <span>Cargando usuarios...</span>
        </div>
      </div>
    );
  }

  if (!isHydrated && usuarios.length === 0) {
    return (
      <div className="p-6 bg-zinc-950 min-h-screen flex items-center justify-center">
        <div className="text-zinc-400 flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
          <span>Preparando formulario...</span>
        </div>
      </div>
    );
  }

  if (usuarios.length === 0) {
    return (
      <div className="p-6 bg-zinc-950 text-zinc-100 min-h-screen">
        <div className="max-w-md mx-auto mt-12 p-6 bg-zinc-900 rounded-xl border border-zinc-800">
          <h2 className="text-xl font-semibold mb-3">No hay usuarios</h2>
          <p className="text-zinc-400 mb-6">
            No se encontraron usuarios en la base de datos.
          </p>
          <button
            onClick={handleRecargarUsuarios}
            className="px-4 py-2 bg-cyan-600 text-black rounded-lg font-semibold hover:bg-cyan-500 transition-all"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const cambiosPendientes = detectarCambios().length;
  const todasCeldasSeleccionadas = celdasSeleccionadas.length === usuarios.length * fechas.length;
  const hoy = new Date();

  // Para vista semanal
  const inicioSemana = startOfWeek(fechaReferencia, 1);
  const finSemana = endOfWeek(fechaReferencia, 1);
  const textoSemana = `${inicioSemana.getDate()} ${["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][inicioSemana.getMonth()]} - ${finSemana.getDate()} ${["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][finSemana.getMonth()]} ${finSemana.getFullYear()}`;

  return (
    <div className="p-4 md:p-6 bg-zinc-950 text-zinc-100 min-h-screen">
      {/* Header compacto */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Gestión de Horarios</h1>
          <p className="text-sm text-zinc-400 mt-1">
            <button
              onClick={handleRecargarUsuarios}
              className="text-cyan-400 hover:text-cyan-300 hover:underline transition-all"
              title="Recargar lista de usuarios"
            >
              {usuarios.length} usuarios
            </button>
            <span className="mx-2">•</span>
            <span className="text-zinc-300 font-medium">{getRangoFechasTexto()}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {modoSeleccion && celdasSeleccionadas.length > 0 && (
            <div className={`px-3 py-1.5 border rounded-lg text-sm ${
              modoSeleccion === "rango" 
                ? "border-amber-500/30 text-amber-400 bg-amber-500/10" 
                : "border-purple-500/30 text-purple-400 bg-purple-500/10"
            }`}>
              {celdasSeleccionadas.length} ✓
            </div>
          )}
          {cambiosPendientes > 0 && (
            <div className="px-3 py-1.5 border border-amber-500/30 text-amber-400 bg-amber-500/10 rounded-lg text-sm">
              {cambiosPendientes} 💾
            </div>
          )}
        </div>
      </div>

      {/* Mensaje de estado */}
      {mensaje && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            mensaje.tipo === "success"
              ? "bg-green-600/20 border border-green-600/50 text-green-400"
              : "bg-red-600/20 border border-red-600/50 text-red-400"
          }`}
        >
          <span>{mensaje.texto}</span>
          <button
            onClick={() => setMensaje(null)}
            className="ml-auto text-xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Panel de control superior */}
      <div className="mb-4">
        {/* Panel de navegación de fechas */}
        <div className="mb-4 p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 backdrop-blur-sm">
          <div className="flex flex-col gap-4">
            {/* Selector de vista */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-400">Vista:</span>
                <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
                  <button
                    onClick={() => setVistaFecha("mes")}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                      vistaFecha === "mes"
                        ? "bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-500/30"
                        : "text-zinc-400 hover:text-cyan-300 hover:bg-zinc-700"
                    }`}
                    title="Vista mensual"
                  >
                    Mes
                  </button>
                  <button
                    onClick={() => setVistaFecha("semana")}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                      vistaFecha === "semana"
                        ? "bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-500/30"
                        : "text-zinc-400 hover:text-cyan-300 hover:bg-zinc-700"
                    }`}
                    title="Vista semanal"
                  >
                    Semana
                  </button>
                  <button
                    onClick={() => setVistaFecha("anual")}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                      vistaFecha === "anual"
                        ? "bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-500/30"
                        : "text-zinc-400 hover:text-cyan-300 hover:bg-zinc-700"
                    }`}
                    title="Vista anual"
                  >
                    Año
                  </button>
                </div>
              </div>

              {/* Navegación según vista */}
              <div className="flex items-center gap-2">
                {vistaFecha === "anual" ? (
                  <>
                    <button
                      onClick={() => cambiarAño("anterior")}
                      disabled={!añosDisponibles.includes(añoSeleccionado - 1)}
                      className={`p-2 rounded-lg transition-colors ${
                        añosDisponibles.includes(añoSeleccionado - 1)
                          ? "text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700"
                          : "text-zinc-600 bg-zinc-900 cursor-not-allowed"
                      }`}
                      title="Año anterior"
                    >
                      ◀
                    </button>
                    <select
                      value={añoSeleccionado}
                      onChange={(e) => setAñoSeleccionado(parseInt(e.target.value))}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:bg-zinc-750 transition-colors"
                    >
                      {añosDisponibles.map(año => (
                        <option key={año} value={año}>
                          {año} {año === new Date().getFullYear() ? "(Actual)" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => cambiarAño("siguiente")}
                      disabled={!añosDisponibles.includes(añoSeleccionado + 1)}
                      className={`p-2 rounded-lg transition-colors ${
                        añosDisponibles.includes(añoSeleccionado + 1)
                          ? "text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700"
                          : "text-zinc-600 bg-zinc-900 cursor-not-allowed"
                      }`}
                      title="Año siguiente"
                    >
                      ▶
                    </button>
                  </>
                ) : vistaFecha === "mes" ? (
                  <>
                    <button
                      onClick={() => cambiarMes("anterior")}
                      className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                      title="Mes anterior"
                    >
                      ◀
                    </button>
                    <div className="flex items-center gap-2">
                      <select
                        value={añoSeleccionado}
                        onChange={(e) => setAñoSeleccionado(parseInt(e.target.value))}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:bg-zinc-750 transition-colors"
                      >
                        {añosDisponibles.map(año => (
                          <option key={año} value={año}>
                            {año} {año === new Date().getFullYear() ? "(Actual)" : ""}
                          </option>
                        ))}
                      </select>
                      <select
                        value={mesSeleccionado}
                        onChange={(e) => setMesSeleccionado(parseInt(e.target.value))}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:bg-zinc-750 transition-colors min-w-[120px]"
                      >
                        {meses.map((mes, index) => (
                          <option key={mes} value={index}>
                            {mes} {index === new Date().getMonth() && añoSeleccionado === new Date().getFullYear() ? "(Actual)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => cambiarMes("siguiente")}
                      className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                      title="Mes siguiente"
                    >
                      ▶
                    </button>
                  </>
                ) : vistaFecha === "semana" ? (
                  <>
                    <button
                      onClick={() => cambiarMes("anterior")}
                      className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                      title="Semana anterior"
                    >
                      ◀
                    </button>
                    <div className="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm">
                      {textoSemana}
                    </div>
                    <button
                      onClick={() => cambiarMes("siguiente")}
                      className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                      title="Semana siguiente"
                    >
                      ▶
                    </button>
                  </>
                ) : null}

                {/* Botón para hoy/actual */}
                <button
                  onClick={vistaFecha === "semana" ? seleccionarSemanaActual : seleccionarMesActual}
                  className="ml-2 px-3 py-1.5 text-sm bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 rounded-lg hover:bg-cyan-600/30 transition-colors"
                  title="Ir al período actual"
                >
                  Hoy
                </button>
              </div>
            </div>

            {/* Vista anual - Selector rápido de meses */}
            {vistaFecha === "anual" && (
              <div className="pt-3 border-t border-zinc-800">
                <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                  {meses.map((mes, index) => {
                    const esMesActual = index === hoy.getMonth() && añoSeleccionado === hoy.getFullYear();
                    return (
                      <button
                        key={mes}
                        onClick={() => {
                          setMesSeleccionado(index);
                          setVistaFecha("mes");
                        }}
                        className={`px-2 py-1.5 text-xs rounded-lg transition-all ${
                          esMesActual
                            ? "bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-500/30"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
                        }`}
                        title={`${mes} ${añoSeleccionado}${esMesActual ? ' (Mes actual)' : ''}`}
                      >
                        {mes.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel de selección múltiple */}
        <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 backdrop-blur-sm">
          <div className="flex flex-col gap-4">
            {/* Selector de modo - Toggle activo/inactivo */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-400">Selección:</span>
                <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
                  <button
                    onClick={() => toggleModoSeleccion("rango")}
                    className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 group relative ${
                      modoSeleccion === "rango"
                        ? "bg-amber-900/50 text-amber-300 ring-1 ring-amber-500/30" 
                        : "text-zinc-400 hover:text-amber-300 hover:bg-zinc-700"
                    }`}
                  >
                    <span className="text-lg">⬜</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-xs text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      {modoSeleccion === "rango" ? "Click para desactivar" : "Seleccionar por área"}
                      <br/>
                      <span className="text-zinc-400 text-[10px]">Arrastra para seleccionar</span>
                    </div>
                  </button>
                  <button
                    onClick={() => toggleModoSeleccion("disperso")}
                    className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 group relative ${
                      modoSeleccion === "disperso"
                        ? "bg-purple-900/50 text-purple-300 ring-1 ring-purple-500/30" 
                        : "text-zinc-400 hover:text-purple-300 hover:bg-zinc-700"
                    }`}
                  >
                    <span className="text-lg">🔘</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-xs text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      {modoSeleccion === "disperso" ? "Click para desactivar" : "Seleccionar por puntos"}
                      <br/>
                      <span className="text-zinc-400 text-[10px]">Ctrl+click para múltiples</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Acciones de selección - Solo cuando hay modo activo */}
              {modoSeleccion && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSeleccionTodo}
                    className={`p-2 rounded-lg transition-colors group relative ${
                      todasCeldasSeleccionadas
                        ? "bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-500/30"
                        : "text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700"
                    }`}
                    title={todasCeldasSeleccionadas ? "Deseleccionar todo" : "Seleccionar todas las celdas"}
                  >
                    <span className="text-lg">✓✓</span>
                    <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-zinc-800 text-xs text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      {todasCeldasSeleccionadas ? "Deseleccionar todo" : "Seleccionar todo"}
                    </div>
                  </button>
                  <button
                    onClick={limpiarSeleccion}
                    className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors group relative"
                    title="Limpiar selección"
                  >
                    <span className="text-lg">✕</span>
                    <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-zinc-800 text-xs text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      Limpiar selección
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Panel de edición en bloque - Solo cuando hay selección */}
            {modoSeleccion && celdasSeleccionadas.length > 0 && (
              <>
                <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent"></div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      modoSeleccion === "rango" ? "bg-amber-500" : "bg-purple-500"
                    }`}></div>
                    <span className="text-sm text-zinc-300">
                      <span className="font-medium">{celdasSeleccionadas.length}</span> celdas seleccionadas
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      onChange={(e) => aplicarHoraGlobal(e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:bg-zinc-750 transition-colors min-w-[160px]"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Aplicar hora a selección...
                      </option>
                      <option value="Libre">🟢 Libre</option>
                      {horasOpciones.filter(h => h !== "Libre").map((hora) => (
                        <option key={hora} value={hora}>
                          {hora}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div 
        ref={tablaRef} 
        className="overflow-auto border border-zinc-800 rounded-xl select-none"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-900 sticky top-0 z-20">
            <tr>
              <th className="p-3 sticky left-0 bg-cyan-600 text-black z-30 min-w-[180px]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Usuario</span>
                </div>
              </th>
              {fechas.map((f) => (
                <th key={f.id} className="p-3 text-center min-w-[90px]">
                  <div className="flex flex-col items-center relative group">
                    <div className={`font-semibold ${f.esFinDeSemana ? "text-red-400" : "text-zinc-100"}`}>
                      {f.diaSemana}
                    </div>
                    <div className={`text-xs ${f.esHoy ? "bg-cyan-600 text-black rounded-full w-6 h-6 flex items-center justify-center mx-auto mt-1" : f.esFinDeSemana ? "text-red-400" : "text-zinc-400"}`}>
                      {f.diaNumero}
                    </div>
                    {modoSeleccion && (
                      <button
                        onClick={() => toggleSeleccionColumna(f.fullDate)}
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        title="Alternar selección de columna"
                      >
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${
                          usuarios.every(usuario =>
                            celdasSeleccionadas.some(
                              c => c.employeeid === usuario.employeeid && c.fecha === f.fullDate
                            )
                          )
                            ? "bg-cyan-600/20 ring-1 ring-cyan-500/30"
                            : "bg-zinc-800/80 hover:bg-zinc-700/80"
                        }`}>
                          <span className="text-xs">↓</span>
                        </div>
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {usuarios.map((usuario) => (
              <tr
                key={usuario.employeeid}
                className="border-t border-zinc-800 hover:bg-zinc-900/30 transition-colors group"
              >
                <td className="p-3 sticky left-0 bg-zinc-950 z-10 border-r border-zinc-800 group-hover:bg-zinc-900 relative">
                  <div className="flex items-center justify-between pr-2">
                    <div>
                      <div className="font-medium text-sm">{usuario.nombre}</div>
                      <div className="text-xs text-zinc-500">{usuario.employeeid}</div>
                    </div>
                    {modoSeleccion && (
                      <button
                        onClick={() => seleccionarFila(usuario.employeeid)}
                        className="p-1.5 text-zinc-500 hover:text-white rounded hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-all group/btn relative"
                        title="Seleccionar fila completa"
                      >
                        <span className="text-lg">→</span>
                        <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-zinc-800 text-xs text-zinc-300 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                          Seleccionar fila
                        </div>
                      </button>
                    )}
                  </div>
                </td>

                {fechas.map((fecha) => {
                  const key = `${usuario.employeeid}-${fecha.fullDate}`;
                  const horario = horarios[key];
                  const hayCambio = horario?.hora_entrada !== horariosOriginales[key]?.hora_entrada;
                  const seleccionada = estaSeleccionada(usuario.employeeid, fecha.fullDate);
                  
                  const getEstiloSeleccion = () => {
                    if (!seleccionada) return '';
                    if (modoSeleccion === "rango") return 'ring-1 ring-amber-500/30 bg-amber-500/5';
                    if (modoSeleccion === "disperso") return 'ring-1 ring-purple-500/30 bg-purple-500/5';
                    return '';
                  };

                  const getColorIcono = () => {
                    if (!seleccionada) return '';
                    if (modoSeleccion === "rango") return 'text-amber-500';
                    if (modoSeleccion === "disperso") return 'text-purple-500';
                    return '';
                  };

                  return (
                    <td 
                      key={key} 
                      className={`p-2 ${fecha.esFinDeSemana ? 'bg-zinc-900/50' : ''}`}
                      onMouseDown={(e) => handleMouseDownCelda(usuario.employeeid, fecha.fullDate, e)}
                      onMouseEnter={() => handleMouseEnterCelda(usuario.employeeid, fecha.fullDate)}
                      onMouseUp={handleMouseUp}
                    >
                      <div className="relative">
                        {/* Fondo de selección */}
                        <div className={`absolute inset-0 rounded ${getEstiloSeleccion()} ${
                          modoSeleccion ? 'cursor-pointer' : ''
                        }`}></div>
                        
                        {/* Select de hora */}
                        <select
                          value={horario?.hora_entrada || "Libre"}
                          onChange={(e) =>
                            handleCambioHora(usuario.employeeid, fecha.fullDate, e.target.value)
                          }
                          className={`relative w-full bg-zinc-800 border rounded px-2 py-1.5 text-sm transition-all z-10
                            ${hayCambio
                              ? "border-amber-500 bg-amber-950/20"
                              : fecha.esFinDeSemana 
                                ? "border-zinc-700 bg-zinc-900/70"
                                : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-750"
                            }
                            ${modoSeleccion ? 'pointer-events-none opacity-90' : 'cursor-pointer'}
                            ${horario?.hora_entrada !== "Libre"
                              ? "text-cyan-400"
                              : "text-zinc-400"
                            }
                          `}
                          disabled={isLoading || modoSeleccion !== null}
                        >
                          {horasOpciones.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                        
                        {/* Indicador de selección */}
                        {seleccionada && modoSeleccion && (
                          <div className={`absolute -top-1 -right-1 w-3 h-3 ${getColorIcono()} pointer-events-none z-20`}>
                            <div className={`w-full h-full rounded-full ${getColorIcono().replace('text-', 'bg-')} opacity-70`}></div>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Barra de acciones inferior */}
      <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              !modoSeleccion ? "bg-cyan-500" :
              modoSeleccion === "rango" ? "bg-amber-500" : "bg-purple-500"
            }`}></div>
            <span>
              {!modoSeleccion && "Modo edición individual"}
              {modoSeleccion === "rango" && "Modo selección por área"}
              {modoSeleccion === "disperso" && "Modo selección por puntos"}
            </span>
            <span className="mx-2">•</span>
            <span className="text-zinc-400">
              {fechas.length} días • {usuarios.length} usuarios
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {cambiosPendientes > 0 && (
            <button
              onClick={handleRevertir}
              disabled={isLoading}
              className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg font-medium hover:bg-zinc-700 transition-all disabled:opacity-50 order-2 sm:order-1 flex items-center gap-2"
            >
              <span className="text-lg">↶</span>
              <span>Descartar</span>
            </button>
          )}

          <button
            onClick={handleGuardar}
            disabled={isLoading || cambiosPendientes === 0}
            className={`px-5 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 flex items-center gap-2 ${
              cambiosPendientes > 0 
                ? "bg-cyan-600 text-black hover:bg-cyan-500" 
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <span className="text-lg">💾</span>
                <span>Guardar {cambiosPendientes > 0 ? `(${cambiosPendientes})` : ""}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Información sobre configuración de años */}
      <div className="mt-8 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
        <div className="text-xs text-zinc-500">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-zinc-400 font-medium">Configuración de fechas:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
              <span><strong>Años disponibles:</strong> {añosDisponibles.join(', ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
              <span><strong>Rango:</strong> Año actual + {añosDisponibles.length - 1} años futuros</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
              <span><strong>Lógica:</strong> Solo años presente y futuros (no años pasados)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
              <span><strong>Navegación:</strong> Flechas deshabilitadas al llegar a límites</span>
            </div>
          </div>
          <div className="mt-3 text-zinc-600 text-[11px]">
            ℹ️ Configuración basada en el año actual ({new Date().getFullYear()}) extendido hacia el futuro para planificación anticipada.
          </div>
        </div>
      </div>
    </div>
  );
}