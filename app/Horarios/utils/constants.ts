// app/Horarios/utils/constants.ts
import { TipoJornada } from './types';

// Configuración de horarios por país
export interface ConfigHorarioPais {
  horaMinima: number; // Hora mínima de entrada (ej: 5)
  horaMaxima: number; // Hora máxima de entrada (ej: 10 para Colombia, 12 para Chile)
  intervalos: 30 | 60; // Intervalos en minutos
}

export const HORARIOS_POR_PAIS: Record<string, ConfigHorarioPais> = {
  chile: {
    horaMinima: 5,
    horaMaxima: 12, // Chile: horarios hasta las 12:00
    intervalos: 30
  },
  colombia: {
    horaMinima: 5,
    horaMaxima: 10, // Colombia: horarios hasta las 10:30
    intervalos: 30
  }
};

// Función para generar horas según país
export const generarHorasParaPais = (pais: string): string[] => {
  const config = HORARIOS_POR_PAIS[pais] || HORARIOS_POR_PAIS.chile;
  const opciones = ["Libre"];
  
  for (let hora = config.horaMinima; hora <= config.horaMaxima; hora++) {
    for (let minuto = 0; minuto < 60; minuto += config.intervalos) {
      // Para la hora máxima, solo permitir hora:00
      if (hora === config.horaMaxima && minuto > 0) continue;
      
      const horaStr = hora.toString().padStart(2, "0");
      const minutoStr = minuto.toString().padStart(2, "0");
      opciones.push(`${horaStr}:${minutoStr}`);
    }
  }
  
  return opciones;
};

// Horas para Chile (todas las disponibles)
export const HORAS_CHILE: string[] = generarHorasParaPais('chile');

// Horas para Colombia (hasta las 10:30)
export const HORAS_COLOMBIA: string[] = generarHorasParaPais('colombia');

// Horas por defecto (para cuando no se conoce el país)
export const HORAS_DEFAULT: string[] = HORAS_CHILE;

// Alias para compatibilidad
export const HORAS_OPCIONES = HORAS_DEFAULT;

// Tipos de jornada
export const TIPOS_JORNADA = [
  { 
    value: "normal" as TipoJornada, 
    label: "Normal", 
    color: "bg-cyan-500", 
    desc: "Jornada completa (10h)" 
  },
  { 
    value: "entrada_tardia" as TipoJornada, 
    label: "Entrada tardía", 
    color: "bg-orange-500", 
    desc: "Entra 1h más tarde (9h desde entrada tardía)" 
  },
  { 
    value: "salida_temprana" as TipoJornada, 
    label: "Salida temprana", 
    color: "bg-red-500", 
    desc: "Sale 1h más temprano (9h desde entrada original)" 
  },
  { 
    value: "apertura" as TipoJornada, 
    label: "Apertura", 
    color: "bg-green-500", 
    desc: "Turno de apertura" 
  },
  { 
    value: "cierre" as TipoJornada, 
    label: "Cierre", 
    color: "bg-blue-500", 
    desc: "Turno de cierre" 
  },
] as const;

// Fechas
export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const MESES_ABR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Fechas globales
export const HOY = new Date();
export const AÑO_ACTUAL = HOY.getFullYear();
export const AÑOS_DISPONIBLES = Array.from({ length: 6 }, (_, i) => AÑO_ACTUAL + i);