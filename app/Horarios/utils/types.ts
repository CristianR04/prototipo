// Tipos básicos
export type TipoJornada = "normal" | "entrada_tardia" | "salida_temprana" | "apertura" | "cierre";
export type ModoSeleccion = "rango" | "disperso";
export type VistaFecha = "mes" | "semana" | "anual";

// Interfaces principales
export interface Usuario {
  employeeid: string;
  nombre: string;
  pais?: 'chile' | 'colombia'; // Agregar país
}

export interface HorarioCompleto {
  employeeid: string;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  break_1: string | null;
  colacion: string | null;
  break_2: string | null;
  tipo_jornada: TipoJornada;
  horas_trabajadas?: number; // Agregar este campo
}

export interface FechaDia {
  id: number;
  fullDate: string;
  diaSemana: string;
  diaNumero: number;
  esFinDeSemana: boolean;
  esHoy: boolean;
}

export interface CeldaSeleccionada {
  employeeid: string;
  fecha: string;
}

export interface MensajeUI {
  tipo: "success" | "error" | "info"; // Agrega "info" aquí
  texto: string;
}

export interface ConfigFechas {
  vista: VistaFecha;
  fechaRef: Date;
  año: number;
  mes: number;
}