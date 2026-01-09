import { 
  Usuario, 
  FechaDia, 
  CeldaSeleccionada, 
  TipoJornada,
  ConfigFechas 
} from './types';
import { 
  MESES_ABR, 
  DIAS_SEMANA, 
  HOY, 
  AÑO_ACTUAL 
} from './constants';

// ==================== CÁLCULOS DE FECHAS ====================
export const dateCalculations = {
  // Operaciones básicas
  startOfMonth: (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1),
  endOfMonth: (date: Date): Date => new Date(date.getFullYear(), date.getMonth() + 1, 0),
  
  startOfWeek: (date: Date): Date => {
    const day = date.getDay();
    const diff = (day < 1 ? 7 : 0) + day - 1; // Lunes como inicio de semana
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - diff);
  },
  
  endOfWeek: (date: Date): Date => {
    const start = dateCalculations.startOfWeek(date);
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  },
  
  addMonths: (date: Date, months: number): Date => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  },
  
  subMonths: (date: Date, months: number): Date => dateCalculations.addMonths(date, -months),
  addWeeks: (date: Date, weeks: number): Date => dateCalculations.addDays(date, weeks * 7),
  subWeeks: (date: Date, weeks: number): Date => dateCalculations.addDays(date, -weeks * 7),
  
  addDays: (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },
  
  isSameDay: (date1: Date, date2: Date): boolean => 
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate(),
  
  startOfYear: (date: Date): Date => new Date(date.getFullYear(), 0, 1),
  endOfYear: (date: Date): Date => new Date(date.getFullYear(), 11, 31),
  
  eachDayOfInterval: ({ start, end }: { start: Date; end: Date }): Date[] => {
    const days: Date[] = [];
    let current = new Date(start);
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  },

  // Generación de fechas por vista
  generarFechasPorVista: (config: ConfigFechas): FechaDia[] => {
    let fechaInicio: Date;
    let fechaFin: Date;

    switch (config.vista) {
      case "mes":
        fechaInicio = dateCalculations.startOfMonth(new Date(config.año, config.mes));
        fechaFin = dateCalculations.endOfMonth(new Date(config.año, config.mes));
        break;
      
      case "semana":
        fechaInicio = dateCalculations.startOfWeek(config.fechaRef);
        fechaFin = dateCalculations.endOfWeek(config.fechaRef);
        break;
      
      case "anual":
        fechaInicio = dateCalculations.startOfYear(new Date(config.año, 0, 1));
        fechaFin = dateCalculations.endOfYear(new Date(config.año, 11, 31));
        break;
      
      default:
        fechaInicio = dateCalculations.startOfMonth(HOY);
        fechaFin = dateCalculations.endOfMonth(HOY);
    }

    const dias = dateCalculations.eachDayOfInterval({ start: fechaInicio, end: fechaFin });
    
    return dias.map((fecha, index) => ({
      id: index,
      fullDate: formatters.formatDate(fecha, 'yyyy-MM-dd'),
      diaSemana: DIAS_SEMANA[fecha.getDay()],
      diaNumero: fecha.getDate(),
      esFinDeSemana: fecha.getDay() === 0 || fecha.getDay() === 6,
      esHoy: dateCalculations.isSameDay(fecha, HOY)
    }));
  },

  // Navegación
  cambiarMesNav: (config: ConfigFechas, direccion: "anterior" | "siguiente", añosDisponibles: number[]): ConfigFechas => {
    if (config.vista === "mes") {
      const nuevoMes = direccion === "anterior" 
        ? dateCalculations.subMonths(new Date(config.año, config.mes), 1)
        : dateCalculations.addMonths(new Date(config.año, config.mes), 1);
      
      const añoResultante = nuevoMes.getFullYear();
      return {
        ...config,
        año: añosDisponibles.includes(añoResultante) ? añoResultante : AÑO_ACTUAL,
        mes: nuevoMes.getMonth()
      };
    } else if (config.vista === "semana") {
      return {
        ...config,
        fechaRef: direccion === "anterior" 
          ? dateCalculations.subWeeks(config.fechaRef, 1)
          : dateCalculations.addWeeks(config.fechaRef, 1)
      };
    }
    return config;
  },

  cambiarAñoNav: (config: ConfigFechas, direccion: "anterior" | "siguiente", añosDisponibles: number[]): ConfigFechas => {
    const nuevoAño = direccion === "anterior" ? config.año - 1 : config.año + 1;
    
    return {
      ...config,
      año: añosDisponibles.includes(nuevoAño) 
        ? nuevoAño 
        : nuevoAño < Math.min(...añosDisponibles) 
          ? AÑO_ACTUAL 
          : config.año
    };
  },

  seleccionarMesActual: (config: ConfigFechas, añosDisponibles: number[]): ConfigFechas => ({
    ...config,
    año: añosDisponibles.includes(AÑO_ACTUAL) ? AÑO_ACTUAL : añosDisponibles[0],
    mes: HOY.getMonth(),
    vista: "mes"
  }),

  seleccionarSemanaActual: (config: ConfigFechas): ConfigFechas => ({
    ...config,
    fechaRef: HOY,
    vista: "semana"
  })
};

// ==================== CÁLCULOS DE HORAS ====================
export const timeCalculations = {
  calcularHorasSegunJornada: (
    horaEntrada: string | null,
    tipoJornada: TipoJornada = "normal"
  ): { 
    break1: string | null; 
    colacion: string | null; 
    break2: string | null; 
    hora_salida: string | null;
  } => {
    if (!horaEntrada || horaEntrada === "Libre") {
      return { break1: null, colacion: null, break2: null, hora_salida: null };
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
      
      const calcularBreaksParaDuracion = (entrada: Date, duracion: number) => {
        const proporcion = duracion / 10;
        return {
          break1: sumarHoras(entrada, 2 * proporcion),
          colacion: sumarHoras(entrada, 5 * proporcion),
          break2: sumarHoras(entrada, 8 * proporcion),
          hora_salida: sumarHoras(entrada, duracion)
        };
      };

      switch (tipoJornada) {
        case "entrada_tardia":
          const entradaTardiaDate = new Date(entradaDate);
          entradaTardiaDate.setHours(entradaTardiaDate.getHours() + 1);
          return calcularBreaksParaDuracion(entradaTardiaDate, 9);
          
        case "salida_temprana":
          return calcularBreaksParaDuracion(entradaDate, 9);
          
        case "normal":
        default:
          return calcularBreaksParaDuracion(entradaDate, 10);
      }
    } catch (error) {
      console.error('Error al calcular horas:', error);
      return { break1: null, colacion: null, break2: null, hora_salida: null };
    }
  }
};

// ==================== CÁLCULOS DE SELECCIÓN ====================
export const selectionCalculations = {
  estaSeleccionada: (
    celdasSeleccionadas: CeldaSeleccionada[], 
    employeeid: string, 
    fecha: string
  ): boolean => celdasSeleccionadas.some(c => c.employeeid === employeeid && c.fecha === fecha),

  seleccionarRango: (
    startEmployeeid: string,
    startFecha: string,
    endEmployeeid: string,
    endFecha: string,
    usuarios: Usuario[],
    fechas: FechaDia[]
  ): CeldaSeleccionada[] => {
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

    return nuevasCeldas;
  },

  getTodasCeldas: (usuarios: Usuario[], fechas: FechaDia[]): CeldaSeleccionada[] => {
    const todasCeldas: CeldaSeleccionada[] = [];
    usuarios.forEach(usuario => {
      fechas.forEach(fecha => {
        todasCeldas.push({ employeeid: usuario.employeeid, fecha: fecha.fullDate });
      });
    });
    return todasCeldas;
  },

  getCeldasFila: (employeeid: string, fechas: FechaDia[]): CeldaSeleccionada[] =>
    fechas.map(fecha => ({ employeeid, fecha: fecha.fullDate })),

  getCeldasColumna: (fecha: string, usuarios: Usuario[]): CeldaSeleccionada[] =>
    usuarios.map(usuario => ({ employeeid: usuario.employeeid, fecha }))
};

// ==================== FORMATEADORES ====================
export const formatters = {
  formatDate: (date: Date, formatStr: string): string => {
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    switch (formatStr) {
      case 'EEE': return DIAS_SEMANA[date.getDay()];
      case 'dd MMM': return `${day.toString().padStart(2, '0')} ${MESES_ABR[month]}`;
      case 'dd MMM yyyy': return `${day.toString().padStart(2, '0')} ${MESES_ABR[month]} ${year}`;
      case "dd 'de' MMMM 'de' yyyy": return `${day} de ${MESES_ABR[month]} de ${year}`;
      case 'yyyy-MM-dd': return `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      default: return date.toISOString().split('T')[0];
    }
  },

  getRangoFechasTexto: (fechas: FechaDia[]): string => {
    if (fechas.length === 0) return "";
    
    const primera = fechas[0];
    const ultima = fechas[fechas.length - 1];
    
    if (primera.fullDate === ultima.fullDate) {
      const fecha = new Date(primera.fullDate);
      return `${fecha.getDate()} de ${MESES_ABR[fecha.getMonth()]} de ${fecha.getFullYear()}`;
    }
    
    const primeraFecha = new Date(primera.fullDate);
    const ultimaFecha = new Date(ultima.fullDate);
    
    return `${primeraFecha.getDate()} ${MESES_ABR[primeraFecha.getMonth()]} - ${ultimaFecha.getDate()} ${MESES_ABR[ultimaFecha.getMonth()]} ${ultimaFecha.getFullYear()}`;
  },

  getSemanaTexto: (fechaReferencia: Date): string => {
    const inicioSemana = dateCalculations.startOfWeek(fechaReferencia);
    const finSemana = dateCalculations.endOfWeek(fechaReferencia);
    return `${inicioSemana.getDate()} ${MESES_ABR[inicioSemana.getMonth()]} - ${finSemana.getDate()} ${MESES_ABR[finSemana.getMonth()]} ${finSemana.getFullYear()}`;
  }
};