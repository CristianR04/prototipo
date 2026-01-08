// types/horario.ts
export interface Horario {
  id?: number;
  employeeid: string;
  fecha: string; // Formato: YYYY-MM-DD
  hora_entrada: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface HorarioRequest {
  employeeid: string;
  fecha: string;
  hora_entrada: string;
}

export interface HorarioResponse {
  success: boolean;
  message: string;
  horarios?: Horario[];
  registrosProcesados?: number;
  totalRecibidos?: number;
  error?: string;
}