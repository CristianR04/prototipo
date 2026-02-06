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

// Domingo al final
export const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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

// Obtener estructura del calendario (SOLO días del mes actual) - CON DOMINGO AL FINAL
export const getCalendarioMes = (fechaActual: Date): (Date | null)[][] => {
    const diasMes = getDiasDelMes(fechaActual);
    const primerDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
    let primerDiaSemana = primerDia.getDay(); // 0=Domingo, 1=Lunes, etc.
    
    // AJUSTE: Convertir para que Lunes sea el primer día de la semana (0)
    // Domingo (0) -> 6, Lunes (1) -> 0, Martes (2) -> 1, etc.
    primerDiaSemana = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

    const semanas: (Date | null)[][] = [];
    let semanaActual: (Date | null)[] = [];

    // Añadir null para los días anteriores al primer día del mes
    for (let i = 0; i < primerDiaSemana; i++) {
        semanaActual.push(null);
    }

    // Añadir los días del mes actual
    for (const dia of diasMes) {
        semanaActual.push(dia);

        if (semanaActual.length === 7) {
            semanas.push([...semanaActual]);
            semanaActual = [];
        }
    }

    // Si hay días restantes en la última semana, completar con null
    if (semanaActual.length > 0) {
        while (semanaActual.length < 7) {
            semanaActual.push(null);
        }
        semanas.push(semanaActual);
    }

    return semanas;
};

// Obtener días de la semana seleccionada - CON LUNES PRIMERO
export const getDiasDeSemana = (semanaOffset: number = 0): Date[] => {
    const hoy = new Date();
    const fechaBase = new Date(hoy);
    fechaBase.setDate(hoy.getDate() + (semanaOffset * 7));

    const diaSemana = fechaBase.getDay(); // 0=Domingo, 1=Lunes...
    
    // Calcular el Lunes de esta semana
    const diff = fechaBase.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1);

    const lunes = new Date(fechaBase);
    lunes.setDate(diff);
    lunes.setHours(0, 0, 0, 0);

    const dias: Date[] = [];

    // Generar los 7 días de la semana empezando por Lunes
    for (let i = 0; i < 7; i++) {
        const fecha = new Date(lunes);
        fecha.setDate(lunes.getDate() + i);
        dias.push(fecha);
    }

    return dias;
};

// Formatear fecha a YYYY-MM-DD
export const formatFechaString = (fecha: Date): string => {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
};

// Formatear hora para mostrar (HH:MM)
export const formatHora = (hora: string | null): string | null => {
    if (!hora || hora.trim() === '' || hora === "Libre") return null;
    return hora.substring(0, 5);
};

// Calcular resumen por usuario
export const calcularResumenUsuario = (horarios: Horario[]): ResumenUsuario => {
    const trabajados = horarios.filter(h => h.hora_entrada && h.hora_entrada !== "Libre").length;
    const libres = horarios.filter(h => !h.hora_entrada || h.hora_entrada === "Libre").length;
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

    const lunes = dias[0];
    const domingo = dias[6];

    const formatoCorto = (fecha: Date): string => {
        return `${fecha.getDate()} ${meses[fecha.getMonth()].substring(0, 3)}`;
    };

    if (lunes.getFullYear() === domingo.getFullYear()) {
        return `Semana del ${formatoCorto(lunes)} al ${formatoCorto(domingo)} ${domingo.getFullYear()}`;
    } else {
        return `Semana del ${formatoCorto(lunes)} ${lunes.getFullYear()} al ${formatoCorto(domingo)} ${domingo.getFullYear()}`;
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
    const hoy = new Date();
    return fecha.getDate() === hoy.getDate() && 
           fecha.getMonth() === hoy.getMonth() && 
           fecha.getFullYear() === hoy.getFullYear();
};

// Verificar si es fin de semana (Sábado o Domingo)
export const esFinDeSemana = (fecha: Date): boolean => {
    const diaSemana = fecha.getDay();
    return diaSemana === 0 || diaSemana === 6; // 0=Domingo, 6=Sábado
};

// Verificar si es día libre
export const esDiaLibre = (horario?: Horario): boolean => {
    return horario ? !horario.hora_entrada || horario.hora_entrada === "Libre" : false;
};

// Verificar si una fecha está en el mes actual
export const esDiaDelMesActual = (fecha: Date | null, mesActual: Date): boolean => {
    if (!fecha) return false;
    return fecha.getMonth() === mesActual.getMonth() && 
           fecha.getFullYear() === mesActual.getFullYear();
};