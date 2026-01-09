// app/horarios-usuarios/utils/fechaUtils.ts

// Definir interfaces locales para las utilidades
export interface Horario {
    fecha: string;
    hora_entrada: string | null;
    hora_salida: string | null;
    break_1: string | null;
    colacion: string | null;
    break_2: string | null;
    campana: string;
}

export interface ResumenUsuario {
    trabajados: number;
    libres: number;
}

export const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Normalizar fecha a formato YYYY-MM-DD
export const normalizarFecha = (fechaString: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaString)) {
        return fechaString;
    }

    const fecha = new Date(fechaString);
    const offset = fecha.getTimezoneOffset() * 60000;
    const fechaLocal = new Date(fecha.getTime() + offset);

    const año = fechaLocal.getFullYear();
    const mes = String(fechaLocal.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaLocal.getDate()).padStart(2, '0');

    return `${año}-${mes}-${dia}`;
};

// Obtener todos los días del mes actual
export const getDiasDelMes = (fecha: Date): Date[] => {
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    const diasEnMes = new Date(año, mes + 1, 0).getDate();
    const dias: Date[] = [];

    for (let dia = 1; dia <= diasEnMes; dia++) {
        dias.push(new Date(año, mes, dia));
    }

    return dias;
};

// Obtener estructura del calendario (días del mes organizados por semanas)
export const getCalendarioMes = (fechaActual: Date): (Date | null)[][] => {
    const diasMes = getDiasDelMes(fechaActual);
    const primerDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
    const primerDiaSemana = primerDia.getDay();

    const semanas: (Date | null)[][] = [];
    let semanaActual: (Date | null)[] = [];

    // Añadir días vacíos al inicio
    for (let i = 0; i < primerDiaSemana; i++) {
        semanaActual.push(null);
    }

    // Añadir los días del mes
    for (const dia of diasMes) {
        semanaActual.push(dia);

        if (semanaActual.length === 7) {
            semanas.push([...semanaActual]);
            semanaActual = [];
        }
    }

    // Completar la última semana
    if (semanaActual.length > 0) {
        while (semanaActual.length < 7) {
            semanaActual.push(null);
        }
        semanas.push(semanaActual);
    }

    return semanas;
};

// Obtener días de la semana seleccionada
export const getDiasDeSemana = (semanaOffset: number = 0): Date[] => {
    const hoy = new Date();
    const fechaBase = new Date(hoy);
    fechaBase.setDate(hoy.getDate() + (semanaOffset * 7));

    const diaSemana = fechaBase.getDay();
    const diff = fechaBase.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);

    const lunes = new Date(fechaBase);
    lunes.setDate(diff);

    const dias: Date[] = [];

    for (let i = 0; i < 7; i++) {
        const fecha = new Date(lunes);
        fecha.setDate(lunes.getDate() + i);
        dias.push(fecha);
    }

    return dias;
};

// Formatear fecha a YYYY-MM-DD
export const formatFechaString = (fecha: Date): string => {
    return fecha.toISOString().split('T')[0];
};

// Formatear hora para mostrar (HH:MM)
export const formatHora = (hora: string | null): string | null => {
    if (!hora || hora.trim() === '') return null;
    return hora.substring(0, 5);
};

// Calcular resumen por usuario
export const calcularResumenUsuario = (horarios: Horario[]): ResumenUsuario => {
    const trabajados = horarios.filter(h => h.hora_entrada).length;
    const libres = horarios.filter(h => !h.hora_entrada).length;
    return { trabajados, libres };
};

// Obtener horario de un día específico
export const getHorarioDelDia = (
    horarios: Horario[], 
    fecha: Date, 
    normalizar: (f: string) => string
): Horario | undefined => {
    const fechaStr = formatFechaString(fecha);
    return horarios.find(h => {
        const fechaHorario = normalizar(h.fecha);
        return fechaHorario === fechaStr;
    });
};

// Obtener texto descriptivo de la semana
export const getTextoSemana = (semanaSeleccionada: number): string => {
    const dias = getDiasDeSemana(semanaSeleccionada);
    if (dias.length < 2) return '';

    const primeraFecha = dias[0];
    const ultimaFecha = dias[dias.length - 1];

    if (primeraFecha.getMonth() === ultimaFecha.getMonth()) {
        return `Semana del ${primeraFecha.getDate()} al ${ultimaFecha.getDate()} de ${meses[primeraFecha.getMonth()]}`;
    } else {
        return `Semana del ${primeraFecha.getDate()} ${meses[primeraFecha.getMonth()].substring(0, 3)} al ${ultimaFecha.getDate()} ${meses[ultimaFecha.getMonth()].substring(0, 3)}`;
    }
};

// Función para cambiar de mes
export const cambiarMes = (fechaActual: Date, direccion: 'anterior' | 'siguiente'): Date => {
    const nuevaFecha = new Date(fechaActual);
    
    if (direccion === 'anterior') {
        nuevaFecha.setMonth(nuevaFecha.getMonth() - 1);
    } else {
        nuevaFecha.setMonth(nuevaFecha.getMonth() + 1);
    }
    
    return nuevaFecha;
};

// Verificar si una fecha es hoy
export const esHoy = (fecha: Date): boolean => {
    return fecha.toDateString() === new Date().toDateString();
};

// Verificar si es fin de semana
export const esFinDeSemana = (fecha: Date): boolean => {
    return fecha.getDay() === 0 || fecha.getDay() === 6;
};