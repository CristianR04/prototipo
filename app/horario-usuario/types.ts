// app/horarios-usuarios/types.ts
export interface Horario {
    fecha: string;
    hora_entrada: string | null;
    hora_salida: string | null;
    break_1: string | null;
    colacion: string | null;
    break_2: string | null;
    campana: string;
}

export interface Usuario {
    employeeid: string;
    nombre: string;
    campana: string;
    horarios: Horario[];
}

export type Vista = 'mes' | 'semana';

export interface ResumenUsuario {
    trabajados: number;
    libres: number;
}