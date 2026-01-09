"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* =======================
   TIPOS
======================= */

interface Usuario {
  employeeid: string;
  nombre: string;
}

interface HorarioCompleto {
  employeeid: string;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  break_1: string | null;
  colacion: string | null;
  break_2: string | null;
  tipo_jornada: TipoJornada;
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
type TipoJornada = "normal" | "entrada_tardia" | "salida_temprana";

/* =======================
   CONSTANTES
======================= */

const HORAS_OPCIONES = [
  "Libre",
  ...Array.from({ length: 12 }, (_, i) => {
    const h = 5 + Math.floor(i / 2);
    return `${String(h).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`;
  }),
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const MESES_ABR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const HOY = new Date();
const AÑO_ACTUAL = HOY.getFullYear();

// Configuración de tipos de jornada
const TIPOS_JORNADA: { value: TipoJornada; label: string; color: string; descripcion: string }[] = [
  { value: "normal", label: "Normal", color: "bg-cyan-500", descripcion: "Jornada completa (10h)" },
  { value: "entrada_tardia", label: "Entrada tardía", color: "bg-orange-500", descripcion: "Entra 1h más tarde (9h desde entrada tardía)" },
  { value: "salida_temprana", label: "Salida temprana", color: "bg-red-500", descripcion: "Sale 1h más temprano (9h desde entrada original)" },
];

/* =======================
   FUNCIONES DE FECHAS UTILIDAD
======================= */

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth() + 1, 0);

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

const subMonths = (date: Date, months: number): Date => addMonths(date, -months);
const addWeeks = (date: Date, weeks: number): Date => addDays(date, weeks * 7);
const subWeeks = (date: Date, weeks: number): Date => addDays(date, -weeks * 7);
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const isSameDay = (date1: Date, date2: Date): boolean =>
  date1.getFullYear() === date2.getFullYear() &&
  date1.getMonth() === date2.getMonth() &&
  date1.getDate() === date2.getDate();

const startOfYear = (date: Date): Date => new Date(date.getFullYear(), 0, 1);
const endOfYear = (date: Date): Date => new Date(date.getFullYear(), 11, 31);

const eachDayOfInterval = ({ start, end }: { start: Date; end: Date }): Date[] => {
  const days: Date[] = [];
  let current = new Date(start);
  
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return days;
};

const formatDate = (date: Date, formatStr: string): string => {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();

  switch (formatStr) {
    case 'EEE':
      return DIAS_SEMANA[date.getDay()];
    case 'dd MMM':
      return `${day.toString().padStart(2, '0')} ${MESES_ABR[month]}`;
    case 'dd MMM yyyy':
      return `${day.toString().padStart(2, '0')} ${MESES_ABR[month]} ${year}`;
    case "dd 'de' MMMM 'de' yyyy":
      return `${day} de ${MESES[month]} de ${year}`;
    case 'yyyy-MM-dd':
      return `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    default:
      return date.toISOString().split('T')[0];
  }
};

/* =======================
   FUNCIONES DE CÁLCULO DE HORAS CORREGIDAS - REVISIÓN FINAL
======================= */

const calcularHorasSegunJornada = (
  horaEntrada: string | null,
  tipoJornada: TipoJornada = "normal"
): { 
  break1: string | null; 
  colacion: string | null; 
  break2: string | null; 
  hora_salida: string | null;
} => {
  if (!horaEntrada || horaEntrada === "Libre") {
    return {
      break1: null,
      colacion: null,
      break2: null,
      hora_salida: null
    };
  }

  try {
    const [horas, minutos] = horaEntrada.split(':').map(Number);
    const entradaDate = new Date();
    entradaDate.setHours(horas, minutos, 0, 0);
    
    const sumarHoras = (fecha: Date, horasASumar: number): string => {
      const nuevaFecha = new Date(fecha);
      nuevaFecha.setHours(nuevaFecha.getHours() + horasASumar);
      return `${nuevaFecha.getHours().toString().padStart(2, '0')}:${nuevaFecha.getMinutes().toString().padStart(2, '0')}`;
    };
    
    // Función para calcular breaks en proporción
    const calcularBreaksParaDuracion = (entrada: Date, duracion: number) => {
      // Los breaks se mantienen proporcionales a la duración
      const proporcion = duracion / 10; // 10 es la duración normal
      
      return {
        break1: sumarHoras(entrada, 2 * proporcion),          // Break 1 proporcional
        colacion: sumarHoras(entrada, 5 * proporcion),        // Colación proporcional
        break2: sumarHoras(entrada, 8 * proporcion),          // Break 2 proporcional
        hora_salida: sumarHoras(entrada, duracion)           // Duración total
      };
    };

    switch (tipoJornada) {
      case "entrada_tardia":
        // Entrada tardía: Suma 1 hora a la entrada configurada
        // Jornada de 9 horas desde la nueva hora de entrada
        const entradaTardiaDate = new Date(entradaDate);
        entradaTardiaDate.setHours(entradaTardiaDate.getHours() + 1);
        
        // Jornada de 9 horas desde la entrada tardía
        return calcularBreaksParaDuracion(entradaTardiaDate, 9);
        
      case "salida_temprana":
        // Salida temprana: Jornada de 9 horas desde la hora de entrada original
        return calcularBreaksParaDuracion(entradaDate, 9);
        
      case "normal":
      default:
        // Jornada normal: 10 horas desde la hora de entrada original
        return calcularBreaksParaDuracion(entradaDate, 10);
    }
    
  } catch (error) {
    console.error('Error al calcular horas:', error);
    return {
      break1: null,
      colacion: null,
      break2: null,
      hora_salida: null
    };
  }
};

/* =======================
   COMPONENTE PRINCIPAL
======================= */

export default function TablaHorariosSimplificada() {
  // Estados principales
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [fechas, setFechas] = useState<FechaDia[]>([]);
  const [horariosCompletos, setHorariosCompletos] = useState<Record<string, HorarioCompleto>>({});
  const [horariosOriginales, setHorariosOriginales] = useState<Record<string, HorarioCompleto>>({});
  
  // Estados para manejar cambios individuales
  const [horasEntrada, setHorasEntrada] = useState<Record<string, string>>({});
  const [tiposJornada, setTiposJornada] = useState<Record<string, TipoJornada>>({});
  
  // Estados de UI
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsuarios, setIsLoadingUsuarios] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);
  const [modoSeleccion, setModoSeleccion] = useState<ModoSeleccion | null>(null);
  const [celdasSeleccionadas, setCeldasSeleccionadas] = useState<CeldaSeleccionada[]>([]);
  
  // Estados de gestión de fechas
  const [vistaFecha, setVistaFecha] = useState<VistaFecha>("mes");
  const [fechaReferencia, setFechaReferencia] = useState<Date>(HOY);
  const [añoSeleccionado, setAñoSeleccionado] = useState<number>(AÑO_ACTUAL);
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(HOY.getMonth());
  const [rangoPersonalizado] = useState<{ inicio: Date | null; fin: Date | null }>({ 
    inicio: null, 
    fin: null 
  });
  
  // Refs
  const tablaRef = useRef<HTMLDivElement>(null);
  const inicioSeleccionRef = useRef<{ employeeid: string; fecha: string } | null>(null);

  // Memoized values
  const añosDisponibles = useMemo(() => {
    const añosFuturos = 5;
    return Array.from({ length: añosFuturos + 1 }, (_, i) => AÑO_ACTUAL + i);
  }, []);

  // Calcular cambios pendientes
  const cambiosPendientes = useMemo(() => {
    return Object.keys(horariosCompletos).filter(key => {
      const actual = horariosCompletos[key];
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
  }, [horariosCompletos, horariosOriginales]);

  const todasCeldasSeleccionadas = useMemo(() => 
    celdasSeleccionadas.length === usuarios.length * fechas.length,
    [celdasSeleccionadas.length, usuarios.length, fechas.length]
  );

  const textoRangoFechas = useMemo(() => {
    if (fechas.length === 0) return "";
    
    const primera = fechas[0];
    const ultima = fechas[fechas.length - 1];
    
    if (primera.fullDate === ultima.fullDate) {
      const fecha = new Date(primera.fullDate);
      return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
    }
    
    const primeraFecha = new Date(primera.fullDate);
    const ultimaFecha = new Date(ultima.fullDate);
    
    return `${primeraFecha.getDate()} ${MESES_ABR[primeraFecha.getMonth()]} - ${ultimaFecha.getDate()} ${MESES_ABR[ultimaFecha.getMonth()]} ${ultimaFecha.getFullYear()}`;
  }, [fechas]);

  const textoSemana = useMemo(() => {
    const inicioSemana = startOfWeek(fechaReferencia, 1);
    const finSemana = endOfWeek(fechaReferencia, 1);
    return `${inicioSemana.getDate()} ${MESES_ABR[inicioSemana.getMonth()]} - ${finSemana.getDate()} ${MESES_ABR[finSemana.getMonth()]} ${finSemana.getFullYear()}`;
  }, [fechaReferencia]);

  /* =======================
     FUNCIONES DE FECHAS
  ======================= */

  const generarFechasPorVista = useCallback((): FechaDia[] => {
    let fechaInicio: Date;
    let fechaFin: Date;

    switch (vistaFecha) {
      case "mes":
        fechaInicio = startOfMonth(new Date(añoSeleccionado, mesSeleccionado));
        fechaFin = endOfMonth(new Date(añoSeleccionado, mesSeleccionado));
        break;
      
      case "semana":
        fechaInicio = startOfWeek(fechaReferencia, 1);
        fechaFin = endOfWeek(fechaReferencia, 1);
        break;
      
      case "personalizado":
        fechaInicio = rangoPersonalizado.inicio || startOfMonth(HOY);
        fechaFin = rangoPersonalizado.fin || endOfMonth(HOY);
        break;
      
      case "anual":
        fechaInicio = startOfYear(new Date(añoSeleccionado, 0, 1));
        fechaFin = endOfYear(new Date(añoSeleccionado, 11, 31));
        break;
      
      default:
        fechaInicio = startOfMonth(HOY);
        fechaFin = endOfMonth(HOY);
    }

    return eachDayOfInterval({ start: fechaInicio, end: fechaFin }).map((fecha, index) => ({
      id: index,
      fullDate: formatDate(fecha, 'yyyy-MM-dd'),
      diaSemana: DIAS_SEMANA[fecha.getDay()],
      diaNumero: fecha.getDate(),
      esFinDeSemana: fecha.getDay() === 0 || fecha.getDay() === 6,
      esHoy: isSameDay(fecha, HOY)
    }));
  }, [vistaFecha, fechaReferencia, añoSeleccionado, mesSeleccionado, rangoPersonalizado]);

  /* =======================
     FUNCIONES DE DATOS
  ======================= */

  const cargarUsuarios = useCallback(async () => {
    try {
      setIsLoadingUsuarios(true);
      const response = await fetch("/Horarios/api/usuarios", { cache: "no-store" });
      const data = await response.json();

      if (!data.success) throw new Error(data.message);
      setUsuarios(data.usuarios || []);
    } catch (error: any) {
      console.error("❌ Error al cargar usuarios:", error);
      setMensaje({ tipo: "error", texto: `Error al cargar usuarios: ${error.message}` });
      setUsuarios([]);
    } finally {
      setIsLoadingUsuarios(false);
    }
  }, []);

  const cargarHorarios = useCallback(async () => {
    try {
      if (usuarios.length === 0 || fechas.length === 0) return;

      const fechaInicio = fechas[0].fullDate;
      const fechaFin = fechas[fechas.length - 1].fullDate;
      const url = `/Horarios/api/horario?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;

      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();

      if (!data.success) throw new Error(data.message);

      const horariosTemp: Record<string, HorarioCompleto> = {};
      const horasEntradaTemp: Record<string, string> = {};
      const tiposJornadaTemp: Record<string, TipoJornada> = {};

      // Inicializar todo
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
          const tipoJornada = registro.tipo_jornada && 
            ["normal", "entrada_tardia", "salida_temprana"].includes(registro.tipo_jornada)
            ? registro.tipo_jornada as TipoJornada
            : "normal";

          horariosTemp[key] = {
            employeeid: registro.employeeid,
            fecha: registro.fecha,
            hora_entrada: registro.hora_entrada || null,
            hora_salida: registro.hora_salida || null,
            break_1: registro.break_1 || null,
            colacion: registro.colacion || null,
            break_2: registro.break_2 || null,
            tipo_jornada: tipoJornada
          };

          horasEntradaTemp[key] = registro.hora_entrada ? registro.hora_entrada.substring(0, 5) : "Libre";
          tiposJornadaTemp[key] = tipoJornada;
        }
      });

      setHorariosCompletos(horariosTemp);
      setHorariosOriginales(JSON.parse(JSON.stringify(horariosTemp)));
      setHorasEntrada(horasEntradaTemp);
      setTiposJornada(tiposJornadaTemp);
      setIsHydrated(true);
      
    } catch (error: any) {
      console.error("❌ Error al cargar horarios:", error);
      setMensaje({ tipo: "error", texto: `Error al cargar horarios: ${error.message}` });
    }
  }, [usuarios, fechas]);

  /* =======================
     FUNCIONES DE ACTUALIZACIÓN
  ======================= */

  const cambiarTipoJornada = useCallback((employeeid: string, fecha: string, nuevoTipo: TipoJornada) => {
    const key = `${employeeid}-${fecha}`;
    
    setTiposJornada(prev => ({
      ...prev,
      [key]: nuevoTipo
    }));

    const horaEntradaActual = horasEntrada[key] !== "Libre" ? horasEntrada[key] : null;
    
    if (horaEntradaActual) {
      const nuevasHoras = calcularHorasSegunJornada(horaEntradaActual, nuevoTipo);
      
      setHorariosCompletos(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          tipo_jornada: nuevoTipo,
          hora_salida: nuevasHoras.hora_salida,
          break_1: nuevasHoras.break1,
          colacion: nuevasHoras.colacion,
          break_2: nuevasHoras.break2
        }
      }));
    } else {
      setHorariosCompletos(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          tipo_jornada: nuevoTipo
        }
      }));
    }

    setMensaje(null);
  }, [horasEntrada]);

  const cambiarHoraEntrada = useCallback((employeeid: string, fecha: string, nuevaHora: string) => {
    const key = `${employeeid}-${fecha}`;
    
    setHorasEntrada(prev => ({
      ...prev,
      [key]: nuevaHora
    }));

    const tipoJornadaActual = tiposJornada[key] || "normal";
    
    if (nuevaHora !== "Libre") {
      const nuevasHoras = calcularHorasSegunJornada(nuevaHora, tipoJornadaActual);
      
      setHorariosCompletos(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          hora_entrada: nuevaHora,
          tipo_jornada: tipoJornadaActual,
          hora_salida: nuevasHoras.hora_salida,
          break_1: nuevasHoras.break1,
          colacion: nuevasHoras.colacion,
          break_2: nuevasHoras.break2
        }
      }));
    } else {
      setHorariosCompletos(prev => ({
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

  /* =======================
     FUNCIONES DE SELECCIÓN
  ======================= */

  const estaSeleccionada = useCallback((employeeid: string, fecha: string) =>
    celdasSeleccionadas.some(c => c.employeeid === employeeid && c.fecha === fecha),
    [celdasSeleccionadas]
  );

  const limpiarSeleccion = useCallback(() => {
    setCeldasSeleccionadas([]);
    inicioSeleccionRef.current = null;
  }, []);

  const toggleSeleccionCelda = useCallback((employeeid: string, fecha: string) => {
    if (!modoSeleccion) return;

    const existe = estaSeleccionada(employeeid, fecha);
    
    setCeldasSeleccionadas(prev => existe
      ? prev.filter(c => !(c.employeeid === employeeid && c.fecha === fecha))
      : [...prev, { employeeid, fecha }]
    );
  }, [modoSeleccion, estaSeleccionada]);

  const seleccionarRango = useCallback((
    startEmployeeid: string,
    startFecha: string,
    endEmployeeid: string,
    endFecha: string
  ) => {
    if (modoSeleccion !== "rango") return;

    const startUserIndex = usuarios.findIndex(u => u.employeeid === startEmployeeid);
    const endUserIndex = usuarios.findIndex(u => u.employeeid === endEmployeeid);
    const startFechaIndex = fechas.findIndex(f => f.fullDate === startFecha);
    const endFechaIndex = fechas.findIndex(f => f.fullDate === endFecha);

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
  }, [modoSeleccion, usuarios, fechas]);

  const aplicarTipoJornadaGlobal = useCallback((tipo: TipoJornada) => {
    if (celdasSeleccionadas.length === 0) {
      setMensaje({ tipo: "error", texto: "Selecciona al menos una celda primero" });
      return;
    }

    const nuevosTiposJornada = { ...tiposJornada };
    const nuevosHorarios = { ...horariosCompletos };
    
    celdasSeleccionadas.forEach(({ employeeid, fecha }) => {
      const key = `${employeeid}-${fecha}`;
      
      nuevosTiposJornada[key] = tipo;
      
      const horaEntradaActual = horasEntrada[key];
      if (horaEntradaActual && horaEntradaActual !== "Libre") {
        const nuevasHoras = calcularHorasSegunJornada(horaEntradaActual, tipo);
        
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
    setHorariosCompletos(nuevosHorarios);

    const nombreTipo = TIPOS_JORNADA.find(t => t.value === tipo)?.label || tipo;
    setMensaje({
      tipo: "success",
      texto: `Aplicado "${nombreTipo}" a ${celdasSeleccionadas.length} celda(s)`,
    });
  }, [celdasSeleccionadas, tiposJornada, horasEntrada, horariosCompletos]);

  const aplicarHoraGlobal = useCallback((hora: string) => {
    if (celdasSeleccionadas.length === 0) {
      setMensaje({ tipo: "error", texto: "Selecciona al menos una celda primero" });
      return;
    }

    const nuevasHorasEntrada = { ...horasEntrada };
    const nuevosHorarios = { ...horariosCompletos };
    
    celdasSeleccionadas.forEach(({ employeeid, fecha }) => {
      const key = `${employeeid}-${fecha}`;
      const tipoJornadaActual = tiposJornada[key] || "normal";
      
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
    setHorariosCompletos(nuevosHorarios);

    setMensaje({
      tipo: "success",
      texto: `Aplicado "${hora}" a ${celdasSeleccionadas.length} celda(s)`,
    });
  }, [celdasSeleccionadas, horasEntrada, tiposJornada, horariosCompletos]);

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
    seleccionarRango(startEmployeeid, startFecha, employeeid, fecha);
  }, [modoSeleccion, seleccionarRango]);

  const handleMouseUp = useCallback(() => {
    inicioSeleccionRef.current = null;
  }, []);

  const toggleSeleccionTodo = useCallback(() => {
    if (todasCeldasSeleccionadas) {
      limpiarSeleccion();
    } else {
      const todasCeldas: CeldaSeleccionada[] = [];
      
      usuarios.forEach(usuario => {
        fechas.forEach(fecha => {
          todasCeldas.push({ employeeid: usuario.employeeid, fecha: fecha.fullDate });
        });
      });
      
      setCeldasSeleccionadas(todasCeldas);
    }
  }, [usuarios, fechas, todasCeldasSeleccionadas, limpiarSeleccion]);

  const seleccionarFila = useCallback((employeeid: string) => {
    const celdasUsuario = fechas.map(fecha => ({ employeeid, fecha: fecha.fullDate }));
    setCeldasSeleccionadas(celdasUsuario);
  }, [fechas]);

  const toggleSeleccionColumna = useCallback((fecha: string) => {
    const todasCeldasColumna = usuarios.map(usuario => ({ employeeid: usuario.employeeid, fecha }));
    const columnaCompletaSeleccionada = todasCeldasColumna.every(celda =>
      estaSeleccionada(celda.employeeid, celda.fecha)
    );
    
    if (columnaCompletaSeleccionada) {
      setCeldasSeleccionadas(prev => prev.filter(celda => celda.fecha !== fecha));
    } else {
      const nuevasCeldas = [...celdasSeleccionadas];
      todasCeldasColumna.forEach(celda => {
        if (!estaSeleccionada(celda.employeeid, celda.fecha)) {
          nuevasCeldas.push(celda);
        }
      });
      setCeldasSeleccionadas(nuevasCeldas);
    }
  }, [usuarios, celdasSeleccionadas, estaSeleccionada]);

  const toggleModoSeleccion = useCallback((modo: ModoSeleccion) => {
    setModoSeleccion(prev => prev === modo ? null : modo);
    limpiarSeleccion();
  }, [limpiarSeleccion]);

  /* =======================
     FUNCIONES DE FECHAS UI
  ======================= */

  const cambiarMes = useCallback((direccion: "anterior" | "siguiente") => {
    if (vistaFecha === "mes") {
      const nuevoMes = direccion === "anterior" 
        ? subMonths(new Date(añoSeleccionado, mesSeleccionado), 1)
        : addMonths(new Date(añoSeleccionado, mesSeleccionado), 1);
      
      const añoResultante = nuevoMes.getFullYear();
      if (añosDisponibles.includes(añoResultante)) {
        setAñoSeleccionado(añoResultante);
        setMesSeleccionado(nuevoMes.getMonth());
      } else {
        setAñoSeleccionado(AÑO_ACTUAL);
        setMesSeleccionado(nuevoMes.getMonth());
      }
    } else if (vistaFecha === "semana") {
      setFechaReferencia(prev => direccion === "anterior" 
        ? subWeeks(prev, 1)
        : addWeeks(prev, 1)
      );
    }
  }, [vistaFecha, añoSeleccionado, mesSeleccionado, añosDisponibles]);

  const cambiarAño = useCallback((direccion: "anterior" | "siguiente") => {
    const nuevoAño = direccion === "anterior" ? añoSeleccionado - 1 : añoSeleccionado + 1;
    
    if (añosDisponibles.includes(nuevoAño)) {
      setAñoSeleccionado(nuevoAño);
    } else if (nuevoAño < Math.min(...añosDisponibles)) {
      setAñoSeleccionado(AÑO_ACTUAL);
    }
  }, [añoSeleccionado, añosDisponibles]);

  const seleccionarMes = useCallback((mes: number) => {
    setMesSeleccionado(mes);
    setVistaFecha("mes");
  }, []);

  const seleccionarMesActual = useCallback(() => {
    const añoActual = HOY.getFullYear();
    setAñoSeleccionado(añosDisponibles.includes(añoActual) ? añoActual : añosDisponibles[0]);
    setMesSeleccionado(HOY.getMonth());
    setVistaFecha("mes");
  }, [añosDisponibles]);

  const seleccionarSemanaActual = useCallback(() => {
    setFechaReferencia(HOY);
    setVistaFecha("semana");
  }, []);

  /* =======================
     HANDLERS PRINCIPALES
  ======================= */

  const handleGuardar = useCallback(async () => {
    if (cambiosPendientes === 0) {
      setMensaje({ tipo: "error", texto: "No hay cambios para guardar" });
      return;
    }

    setIsLoading(true);
    setMensaje(null);

    try {
      const payload = Object.values(horariosCompletos).map(horario => ({
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
  }, [cambiosPendientes, horariosCompletos, cargarHorarios, limpiarSeleccion]);

  const handleRevertir = useCallback(() => {
    setHorariosCompletos(JSON.parse(JSON.stringify(horariosOriginales)));
    
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

  /* =======================
     EFFECTS
  ======================= */

  useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);
  useEffect(() => { setFechas(generarFechasPorVista()); }, [generarFechasPorVista]);
  useEffect(() => { if (usuarios.length > 0 && fechas.length > 0) cargarHorarios(); }, 
    [usuarios, fechas, cargarHorarios]);

  /* =======================
     RENDER HELPERS
  ======================= */

  const renderLoading = () => (
    <div className="p-6 bg-zinc-950 min-h-screen flex items-center justify-center">
      <div className="text-zinc-400 flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
        <span>{isLoadingUsuarios ? "Cargando usuarios..." : "Preparando formulario..."}</span>
      </div>
    </div>
  );

  const renderNoUsuarios = () => (
    <div className="p-6 bg-zinc-950 text-zinc-100 min-h-screen">
      <div className="max-w-md mx-auto mt-12 p-6 bg-zinc-900 rounded-xl border border-zinc-800">
        <h2 className="text-xl font-semibold mb-3">No hay usuarios</h2>
        <p className="text-zinc-400 mb-6">No se encontraron usuarios en la base de datos.</p>
        <button
          onClick={handleRecargarUsuarios}
          className="px-4 py-2 bg-cyan-600 text-black rounded-lg font-semibold hover:bg-cyan-500 transition-all"
        >
          Reintentar
        </button>
      </div>
    </div>
  );

  const renderMensaje = mensaje && (
    <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
      mensaje.tipo === "success"
        ? "bg-green-600/20 border border-green-600/50 text-green-400"
        : "bg-red-600/20 border border-red-600/50 text-red-400"
    }`}>
      <span>{mensaje.texto}</span>
      <button onClick={() => setMensaje(null)} className="ml-auto text-xs opacity-70 hover:opacity-100">
        ✕
      </button>
    </div>
  );

  const renderSelectorVista = () => (
    <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
      {(["mes", "semana", "anual"] as VistaFecha[]).map(vista => (
        <button
          key={vista}
          onClick={() => setVistaFecha(vista)}
          className={`px-3 py-1.5 text-sm rounded-md transition-all ${
            vistaFecha === vista
              ? "bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-500/30"
              : "text-zinc-400 hover:text-cyan-300 hover:bg-zinc-700"
          }`}
          title={`Vista ${vista}`}
        >
          {vista.charAt(0).toUpperCase() + vista.slice(1)}
        </button>
      ))}
    </div>
  );

  const renderNavegacionFechas = () => {
    if (vistaFecha === "anual") {
      return (
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
                {año} {año === AÑO_ACTUAL ? "(Actual)" : ""}
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
      );
    }

    if (vistaFecha === "mes") {
      return (
        <>
          <button onClick={() => cambiarMes("anterior")} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors" title="Mes anterior">◀</button>
          <div className="flex items-center gap-2">
            <select value={añoSeleccionado} onChange={(e) => setAñoSeleccionado(parseInt(e.target.value))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:bg-zinc-750 transition-colors">
              {añosDisponibles.map(año => <option key={año} value={año}>{año} {año === AÑO_ACTUAL ? "(Actual)" : ""}</option>)}
            </select>
            <select value={mesSeleccionado} onChange={(e) => setMesSeleccionado(parseInt(e.target.value))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:bg-zinc-750 transition-colors min-w-[120px]">
              {MESES.map((mes, index) => <option key={mes} value={index}>{mes} {index === HOY.getMonth() && añoSeleccionado === AÑO_ACTUAL ? "(Actual)" : ""}</option>)}
            </select>
          </div>
          <button onClick={() => cambiarMes("siguiente")} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors" title="Mes siguiente">▶</button>
        </>
      );
    }

    if (vistaFecha === "semana") {
      return (
        <>
          <button onClick={() => cambiarMes("anterior")} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors" title="Semana anterior">◀</button>
          <div className="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm">{textoSemana}</div>
          <button onClick={() => cambiarMes("siguiente")} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors" title="Semana siguiente">▶</button>
        </>
      );
    }

    return null;
  };

  const renderSelectorMesAnual = vistaFecha === "anual" && (
    <div className="pt-3 border-t border-zinc-800">
      <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
        {MESES.map((mes, index) => {
          const esMesActual = index === HOY.getMonth() && añoSeleccionado === AÑO_ACTUAL;
          return (
            <button
              key={mes}
              onClick={() => seleccionarMes(index)}
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
  );

  const renderSelectorModo = () => (
    <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
      {(["rango", "disperso"] as ModoSeleccion[]).map(modo => (
        <button
          key={modo}
          onClick={() => toggleModoSeleccion(modo)}
          className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 group relative ${
            modoSeleccion === modo
              ? modo === "rango" 
                ? "bg-amber-900/50 text-amber-300 ring-1 ring-amber-500/30" 
                : "bg-purple-900/50 text-purple-300 ring-1 ring-purple-500/30"
              : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          <span className="text-lg">{modo === "rango" ? "⬜" : "🔘"}</span>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-xs text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            {modoSeleccion === modo ? "Click para desactivar" : `Seleccionar por ${modo === "rango" ? "área" : "puntos"}`}
            <br/>
            <span className="text-zinc-400 text-[10px]">
              {modo === "rango" ? "Arrastra para seleccionar" : "Ctrl+click para múltiples"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );

  const renderCelda = (usuario: Usuario, fecha: FechaDia) => {
    const key = `${usuario.employeeid}-${fecha.fullDate}`;
    const horario = horariosCompletos[key];
    const horaEntradaActual = horasEntrada[key] || "Libre";
    const tipoJornadaActual = tiposJornada[key] || "normal";
    
    const horarioOriginal = horariosOriginales[key];
    const hayCambio = horario && horarioOriginal && (
      horario.hora_entrada !== horarioOriginal.hora_entrada ||
      horario.tipo_jornada !== horarioOriginal.tipo_jornada
    );
    
    const seleccionada = estaSeleccionada(usuario.employeeid, fecha.fullDate);
    
    const getEstiloSeleccion = () => {
      if (!seleccionada) return '';
      if (modoSeleccion === "rango") return 'ring-1 ring-amber-500/30 bg-amber-500/5';
      if (modoSeleccion === "disperso") return 'ring-1 ring-purple-500/30 bg-purple-500/5';
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
          <div className={`absolute inset-0 rounded ${getEstiloSeleccion()} ${
            modoSeleccion ? 'cursor-pointer' : ''
          }`}></div>
          
          <div className="relative flex flex-col gap-2">
            {/* Selector de tipo de jornada */}
            <select
              value={tipoJornadaActual}
              onChange={(e) => cambiarTipoJornada(usuario.employeeid, fecha.fullDate, e.target.value as TipoJornada)}
              className={`w-full bg-zinc-800 border rounded px-2 py-1.5 text-xs transition-all cursor-pointer z-10
                ${hayCambio ? "border-amber-500 bg-amber-950/20" : fecha.esFinDeSemana ? "border-zinc-700 bg-zinc-900/70" : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-750"}
                ${tipoJornadaActual === "normal" ? "text-cyan-400" : tipoJornadaActual === "entrada_tardia" ? "text-orange-400" : "text-red-400"}
                ${modoSeleccion ? 'pointer-events-none opacity-90' : ''}
              `}
              disabled={isLoading || modoSeleccion !== null}
            >
              {TIPOS_JORNADA.map(tipo => (
                <option key={tipo.value} value={tipo.value} className={tipo.value === "normal" ? "text-cyan-400" : tipo.value === "entrada_tardia" ? "text-orange-400" : "text-red-400"}>
                  {tipo.label}
                </option>
              ))}
            </select>
            
            {/* Selector de hora de entrada */}
            <select
              value={horaEntradaActual}
              onChange={(e) => cambiarHoraEntrada(usuario.employeeid, fecha.fullDate, e.target.value)}
              className={`w-full bg-zinc-800 border rounded px-2 py-1.5 text-sm transition-all cursor-pointer z-10
                ${hayCambio ? "border-amber-500 bg-amber-950/20" : fecha.esFinDeSemana ? "border-zinc-700 bg-zinc-900/70" : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-750"}
                ${horaEntradaActual !== "Libre" ? "text-cyan-400" : "text-zinc-400"}
                ${modoSeleccion ? 'pointer-events-none opacity-90' : ''}
              `}
              disabled={isLoading || modoSeleccion !== null}
            >
              {HORAS_OPCIONES.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          
          {/* Información de horas calculadas (tooltip) */}
          {horaEntradaActual !== "Libre" && horario && (
            <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-zinc-800 text-xs text-zinc-300 rounded opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
              <div className="font-medium">Horarios calculados:</div>
              <div>Break 1: {horario.break_1 || "-"}</div>
              <div>Colación: {horario.colacion || "-"}</div>
              <div>Break 2: {horario.break_2 || "-"}</div>
              <div>Salida: {horario.hora_salida || "-"}</div>
            </div>
          )}
        </div>
      </td>
    );
  };

  /* =======================
     RENDER PRINCIPAL
  ======================= */

  if (isLoadingUsuarios || (!isHydrated && usuarios.length === 0)) return renderLoading();
  if (usuarios.length === 0) return renderNoUsuarios();

  return (
    <div className="p-4 md:p-6 bg-zinc-950 text-zinc-100 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Gestión de Horarios</h1>
          <p className="text-sm text-zinc-400 mt-1">
            <button onClick={handleRecargarUsuarios} className="text-cyan-400 hover:text-cyan-300 hover:underline transition-all" title="Recargar lista de usuarios">
              {usuarios.length} usuarios
            </button>
            <span className="mx-2">•</span>
            <span className="text-zinc-300 font-medium">{textoRangoFechas}</span>
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

      {renderMensaje}

      {/* Panel de navegación */}
      <div className="mb-4 p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 backdrop-blur-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400">Vista:</span>
              {renderSelectorVista()}
            </div>

            <div className="flex items-center gap-2">
              {renderNavegacionFechas()}
              <button
                onClick={vistaFecha === "semana" ? seleccionarSemanaActual : seleccionarMesActual}
                className="ml-2 px-3 py-1.5 text-sm bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 rounded-lg hover:bg-cyan-600/30 transition-colors"
                title="Ir al período actual"
              >
                Hoy
              </button>
            </div>
          </div>
          {renderSelectorMesAnual}
        </div>
      </div>

      {/* Panel de selección */}
      <div className="mb-4 p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 backdrop-blur-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400">Selección:</span>
              {renderSelectorModo()}
            </div>

            {modoSeleccion && (
              <div className="flex items-center gap-2">
                <button onClick={toggleSeleccionTodo} className={`p-2 rounded-lg transition-colors group relative ${
                  todasCeldasSeleccionadas
                    ? "bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-500/30"
                    : "text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700"
                }`} title={todasCeldasSeleccionadas ? "Deseleccionar todo" : "Seleccionar todas las celdas"}>
                  <span className="text-lg">✓✓</span>
                </button>
                <button onClick={limpiarSeleccion} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors group relative" title="Limpiar selección">
                  <span className="text-lg">✕</span>
                </button>
              </div>
            )}
          </div>

          {modoSeleccion && celdasSeleccionadas.length > 0 && (
            <>
              <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent"></div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${modoSeleccion === "rango" ? "bg-amber-500" : "bg-purple-500"}`}></div>
                  <span className="text-sm text-zinc-300">
                    <span className="font-medium">{celdasSeleccionadas.length}</span> celdas seleccionadas
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Selector de hora */}
                  <select onChange={(e) => aplicarHoraGlobal(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:bg-zinc-750 transition-colors min-w-[160px]" defaultValue="">
                    <option value="" disabled>Aplicar hora...</option>
                    <option value="Libre">Libre</option>
                    {HORAS_OPCIONES.filter(h => h !== "Libre").map(hora => <option key={hora} value={hora}>{hora}</option>)}
                  </select>
                  
                  {/* Selector de tipo de jornada */}
                  <select onChange={(e) => aplicarTipoJornadaGlobal(e.target.value as TipoJornada)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:bg-zinc-750 transition-colors min-w-[180px]" defaultValue="">
                    <option value="" disabled>Tipo de jornada...</option>
                    {TIPOS_JORNADA.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label} ({tipo.descripcion})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div ref={tablaRef} className="overflow-auto border border-zinc-800 rounded-xl select-none" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-900 sticky top-0 z-20">
            <tr>
              <th className="p-3 sticky left-0 bg-cyan-600 text-black z-30 min-w-[180px]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Usuario</span>
                </div>
              </th>
              {fechas.map(f => (
                <th key={f.id} className="p-3 text-center min-w-[90px]">
                  <div className="flex flex-col items-center relative group">
                    <div className={`font-semibold ${f.esFinDeSemana ? "text-red-400" : "text-zinc-100"}`}>
                      {f.diaSemana}
                    </div>
                    <div className={`text-xs ${f.esHoy ? "bg-cyan-600 text-black rounded-full w-6 h-6 flex items-center justify-center mx-auto mt-1" : f.esFinDeSemana ? "text-red-400" : "text-zinc-400"}`}>
                      {f.diaNumero}
                    </div>
                    {modoSeleccion && (
                      <button onClick={() => toggleSeleccionColumna(f.fullDate)} className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" title="Alternar selección de columna">
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${
                          usuarios.every(usuario => estaSeleccionada(usuario.employeeid, f.fullDate))
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
            {usuarios.map(usuario => (
              <tr key={usuario.employeeid} className="border-t border-zinc-800 hover:bg-zinc-900/30 transition-colors group">
                <td className="p-3 sticky left-0 bg-zinc-950 z-10 border-r border-zinc-800 group-hover:bg-zinc-900 relative">
                  <div className="flex items-center justify-between pr-2">
                    <div>
                      <div className="font-medium text-sm">{usuario.nombre}</div>
                      <div className="text-xs text-zinc-500">{usuario.employeeid}</div>
                    </div>
                    {modoSeleccion && (
                      <button onClick={() => seleccionarFila(usuario.employeeid)} className="p-1.5 text-zinc-500 hover:text-white rounded hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-all" title="Seleccionar fila completa">
                        <span className="text-lg">→</span>
                      </button>
                    )}
                  </div>
                </td>
                {fechas.map(fecha => renderCelda(usuario, fecha))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Barra de acciones */}
      <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              !modoSeleccion ? "bg-cyan-500" : modoSeleccion === "rango" ? "bg-amber-500" : "bg-purple-500"
            }`}></div>
            <span>
              {!modoSeleccion && "Modo edición individual"}
              {modoSeleccion === "rango" && "Modo selección por área"}
              {modoSeleccion === "disperso" && "Modo selección por puntos"}
            </span>
            <span className="mx-2">•</span>
            <span className="text-zinc-400">{fechas.length} días • {usuarios.length} usuarios</span>
          </div>
          
          {/* Leyenda de tipos de jornada */}
          <div className="mt-2 flex flex-wrap gap-3">
            <div className="text-xs text-zinc-500 font-medium">Tipos de jornada:</div>
            {TIPOS_JORNADA.map(tipo => (
              <div key={tipo.value} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${tipo.color}`}></div>
                <span className="text-xs text-zinc-400">{tipo.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {cambiosPendientes > 0 && (
            <button onClick={handleRevertir} disabled={isLoading} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg font-medium hover:bg-zinc-700 transition-all disabled:opacity-50 order-2 sm:order-1 flex items-center gap-2">
              <span className="text-lg">↶</span>
              <span>Descartar</span>
            </button>
          )}

          <button onClick={handleGuardar} disabled={isLoading || cambiosPendientes === 0} className={`px-5 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 flex items-center gap-2 ${
            cambiosPendientes > 0 ? "bg-cyan-600 text-black hover:bg-cyan-500" : "bg-zinc-800 text-zinc-400"
          }`}>
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

      {/* Información */}
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
          </div>
          
          <div className="mt-4 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-zinc-400 font-medium">Configuración de jornadas:</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TIPOS_JORNADA.map(tipo => (
                <div key={tipo.value} className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${tipo.color}`}></div>
                    <span className="text-sm font-medium text-zinc-300">{tipo.label}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 pl-5">{tipo.descripcion}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}