// horarios-config.ts
// Configuración centralizada para generación automática de horarios

export interface TurnoConfig {
  entrada: string;
  salida: string;
  tipo: 'apertura' | 'cierre' | 'normal';
}

export interface ConfiguracionPais {
  pais: string;
  zonaHoraria: string;
  diferenciaCL: number; // Diferencia en horas con Chile
  turnos: {
    lunesViernes: TurnoConfig[];
    finSemanaFestivos: TurnoConfig[];
  };
}

export interface ReglaNegocio {
  id: string;
  descripcion: string;
  prioridad: number; // Mayor prioridad = se aplica primero
  aplicable: (context: any) => boolean;
  aplicar: (context: any) => any;
}

export interface CasoEspecial {
  employeeid?: string;
  nombre?: string;
  reglas: {
    soloLunesViernes?: boolean;
    excluirFestivos?: boolean;
    horaMinima?: string;
    horaMaxima?: string;
    turnosFijos?: string[];
    soloApertura?: boolean;
  };
}

// ============================================
// CONFIGURACIÓN DE PAÍSES
// ============================================

export const CONFIGURACION_PAISES: Record<string, ConfiguracionPais> = {
  'Chile': {
    pais: 'Chile',
    zonaHoraria: 'America/Santiago',
    diferenciaCL: 0,
    turnos: {
      lunesViernes: [
        { entrada: '08:00', salida: '18:00', tipo: 'apertura' },
        { entrada: '08:30', salida: '18:30', tipo: 'normal' },
        { entrada: '09:00', salida: '19:00', tipo: 'normal' },
        { entrada: '09:30', salida: '19:30', tipo: 'normal' },
        { entrada: '10:00', salida: '20:00', tipo: 'normal' },
        { entrada: '10:30', salida: '20:30', tipo: 'normal' },
        { entrada: '11:00', salida: '21:00', tipo: 'normal' },
        { entrada: '11:30', salida: '21:30', tipo: 'normal' },
        { entrada: '12:00', salida: '22:00', tipo: 'cierre' }
      ],
      finSemanaFestivos: [
        { entrada: '09:00', salida: '19:00', tipo: 'apertura' },
        { entrada: '09:30', salida: '19:30', tipo: 'normal' },
        { entrada: '10:00', salida: '20:00', tipo: 'normal' },
        { entrada: '10:30', salida: '20:30', tipo: 'normal' },
        { entrada: '11:00', salida: '21:00', tipo: 'normal' },
        { entrada: '11:30', salida: '21:30', tipo: 'normal' },
        { entrada: '12:00', salida: '22:00', tipo: 'cierre' }
      ]
    }
  },
  'Colombia': {
    pais: 'Colombia',
    zonaHoraria: 'America/Bogota',
    diferenciaCL: -2,
    turnos: {
      lunesViernes: [
        { entrada: '06:00', salida: '16:00', tipo: 'apertura' },
        { entrada: '06:30', salida: '16:30', tipo: 'normal' },
        { entrada: '07:00', salida: '17:00', tipo: 'normal' },
        { entrada: '07:30', salida: '17:30', tipo: 'normal' },
        { entrada: '08:00', salida: '18:00', tipo: 'normal' },
        { entrada: '08:30', salida: '18:30', tipo: 'normal' },
        { entrada: '09:00', salida: '19:00', tipo: 'normal' },
        { entrada: '09:30', salida: '19:30', tipo: 'normal' },
        { entrada: '10:00', salida: '20:00', tipo: 'cierre' }
      ],
      finSemanaFestivos: [
        { entrada: '07:00', salida: '17:00', tipo: 'apertura' },
        { entrada: '07:30', salida: '17:30', tipo: 'normal' },
        { entrada: '08:00', salida: '18:00', tipo: 'normal' },
        { entrada: '08:30', salida: '18:30', tipo: 'normal' },
        { entrada: '09:00', salida: '19:00', tipo: 'normal' },
        { entrada: '09:30', salida: '19:30', tipo: 'normal' },
        { entrada: '10:00', salida: '20:00', tipo: 'cierre' }
      ]
    }
  }
};

// ============================================
// FESTIVOS 2025-2026 (Chile y Colombia)
// ============================================

export const FESTIVOS_2025_2026 = [
  // 2025
  '2025-12-25', // Navidad
  
  // 2026
  '2026-01-01', // Año Nuevo (tratar como domingo)
  '2026-04-10', // Viernes Santo
  '2026-04-11', // Sábado Santo
  '2026-05-01', // Día del Trabajo
  '2026-05-21', // Día de las Glorias Navales
  '2026-06-20', // Corpus Christi
  '2026-06-21', // Día Nacional de los Pueblos Indígenas
  '2026-07-16', // Día de la Virgen del Carmen
  '2026-08-15', // Asunción de la Virgen
  '2026-09-18', // Fiestas Patrias
  '2026-09-19', // Día de las Glorias del Ejército
  '2026-10-12', // Encuentro de Dos Mundos
  '2026-10-31', // Día de las Iglesias Evangélicas y Protestantes
  '2026-11-01', // Día de Todos los Santos
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
];

// ============================================
// CASOS ESPECIALES DE EMPLEADOS
// ============================================

export const CASOS_ESPECIALES: CasoEspecial[] = [
  {
    nombre: 'Nadia Maria Caro Vargas',
    reglas: {
      horaMinima: '07:00',
      horaMaxima: '21:00' // No puede entrar después de esta hora (salida a las 21:00 + 10h = entrada a las 11:00)
    }
  },
  {
    nombre: 'Sophia Lopera Parra',
    reglas: {
      soloLunesViernes: true,
      excluirFestivos: true,
      turnosFijos: ['07:00-17:00']
    }
  },
  {
    nombre: 'Maria Alejandra Medina Paredes',
    reglas: {
      soloLunesViernes: true,
      excluirFestivos: true,
      turnosFijos: ['07:00-17:00']
    }
  },
  {
    nombre: 'Maria Valentina Diaz Hincapié',
    reglas: {
      soloApertura: true,
      horaMaxima: '07:30'
    }
  }
];

// ============================================
// REGLAS DE NEGOCIO SISTEMÁTICAS
// ============================================

export const REGLAS_HORARIOS = {
  // Patrón de trabajo
  PATRON_5X2: {
    diasTrabajo: 5,
    diasLibres: 2
  },
  
  // Límites legales
  MAX_DIAS_CONSECUTIVOS: 6,
  HORAS_SEMANALES_MAX: 44,
  
  // Distribución de turnos
  PORCENTAJE_APERTURA: 0.20, // 20%
  PORCENTAJE_CIERRE: 0.20,   // 20%
  PORCENTAJE_NORMALES: 0.60,  // 60%
  
  // Dotación domingos
  DOTACION_DOMINGOS: {
    min: 16,
    max: 20
  },
  
  // Días libres mensuales
  FINES_SEMANA_LIBRES_MES: 1,
  DOMINGOS_LIBRES_MES: 2,
  
  // Días con dotación completa
  DIAS_DOTACION_COMPLETA: [1], // Lunes = 1
  
  // Reducción de horas
  REDUCCION_HORAS_44: {
    aplicaEnDias: [1, 2, 3, 4, 5], // Lunes a Viernes
    excluirFestivos: true,
    excluirFinSemana: true,
    frecuencia: 'una_vez_por_semana' // Solo un día a la semana
  }
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

export function esFestivo(fecha: string): boolean {
  return FESTIVOS_2025_2026.includes(fecha);
}

export function esFinDeSemana(fecha: Date): boolean {
  const dia = fecha.getDay();
  return dia === 0 || dia === 6; // Domingo o Sábado
}

export function esDomingo(fecha: Date): boolean {
  return fecha.getDay() === 0;
}

export function esLunes(fecha: Date): boolean {
  return fecha.getDay() === 1;
}

export function esDiaLaboral(fecha: Date, fechaStr: string): boolean {
  if (esFinDeSemana(fecha)) return false;
  if (esFestivo(fechaStr)) return false;
  return true;
}

export function obtenerTurnosDisponibles(
  pais: string,
  fecha: Date,
  fechaStr: string
): TurnoConfig[] {
  const config = CONFIGURACION_PAISES[pais];
  if (!config) return [];
  
  const esFinOFestivo = esFinDeSemana(fecha) || esFestivo(fechaStr);
  
  return esFinOFestivo 
    ? config.turnos.finSemanaFestivos 
    : config.turnos.lunesViernes;
}

export function obtenerCasoEspecial(
  employeeid: string,
  nombre: string
): CasoEspecial | undefined {
  return CASOS_ESPECIALES.find(
    caso => 
      (caso.employeeid && caso.employeeid === employeeid) ||
      (caso.nombre && caso.nombre === nombre)
  );
}

export function validarTurnoConRestricciones(
  turno: TurnoConfig,
  fecha: Date,
  fechaStr: string,
  restricciones?: CasoEspecial['reglas']
): boolean {
  if (!restricciones) return true;
  
  // Solo lunes a viernes
  if (restricciones.soloLunesViernes) {
    const dia = fecha.getDay();
    if (dia === 0 || dia === 6) return false; // Fin de semana
  }
  
  // Excluir festivos
  if (restricciones.excluirFestivos && esFestivo(fechaStr)) {
    return false;
  }
  
  // Turnos fijos
  if (restricciones.turnosFijos) {
    const turnoStr = `${turno.entrada}-${turno.salida}`;
    if (!restricciones.turnosFijos.includes(turnoStr)) return false;
  }
  
  // Solo apertura
  if (restricciones.soloApertura && turno.tipo !== 'apertura') {
    return false;
  }
  
  // Rango de horas
  if (restricciones.horaMinima) {
    if (turno.entrada < restricciones.horaMinima) return false;
  }
  
  if (restricciones.horaMaxima) {
    if (turno.entrada > restricciones.horaMaxima) return false;
  }
  
  return true;
}

export function calcularHorasSemana(turnos: { entrada: string; salida: string }[]): number {
  let totalHoras = 0;
  
  turnos.forEach(turno => {
    const [entradaH, entradaM] = turno.entrada.split(':').map(Number);
    const [salidaH, salidaM] = turno.salida.split(':').map(Number);
    
    const entradaMinutos = entradaH * 60 + entradaM;
    const salidaMinutos = salidaH * 60 + salidaM;
    
    const duracionMinutos = salidaMinutos - entradaMinutos;
    totalHoras += duracionMinutos / 60;
  });
  
  return totalHoras;
}

export function aplicarReduccionHora(
  turno: TurnoConfig,
  esTurnoCierre: boolean
): TurnoConfig {
  if (esTurnoCierre) {
    // Cierre: restar hora de entrada
    const [h, m] = turno.entrada.split(':').map(Number);
    const nuevaEntrada = `${(h + 1).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    return { ...turno, entrada: nuevaEntrada };
  } else {
    // Normal/Apertura: restar hora de salida
    const [h, m] = turno.salida.split(':').map(Number);
    const nuevaSalida = `${(h - 1).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    return { ...turno, salida: nuevaSalida };
  }
}