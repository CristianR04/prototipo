// app/horarios-usuarios/page.tsx
'use client';

import { useState, useEffect } from 'react';

interface Horario {
    fecha: string;
    hora_entrada: string | null;
    hora_salida: string | null;
    break_1: string | null;
    colacion: string | null;
    break_2: string | null;
    campana: string;
}

interface Usuario {
    employeeid: string;
    nombre: string;
    campana: string;
    horarios: Horario[];
}

type Vista = 'mes' | 'semana';

export default function HorariosUsuariosPage() {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [vista, setVista] = useState<Vista>('mes');
    const [fechaActual, setFechaActual] = useState<Date>(new Date());
    const [semanaSeleccionada, setSemanaSeleccionada] = useState<number>(0);

    const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    useEffect(() => {
        cargarHorarios();
    }, []);

    const cargarHorarios = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('horario-usuario/api/usuarios');
            const data = await response.json();

            if (data.success) {
                setUsuarios(data.usuarios);
            } else {
                setError(data.message || 'Error al cargar los datos');
            }
        } catch (error: any) {
            setError('Error de conexión: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const normalizarFecha = (fechaString: string): string => {
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
    const getDiasDelMes = (): Date[] => {
        const año = fechaActual.getFullYear();
        const mes = fechaActual.getMonth();
        const diasEnMes = new Date(año, mes + 1, 0).getDate();
        const dias: Date[] = [];

        for (let dia = 1; dia <= diasEnMes; dia++) {
            dias.push(new Date(año, mes, dia));
        }

        return dias;
    };

    // Obtener estructura del calendario (días del mes organizados por semanas)
    const getCalendarioMes = () => {
        const diasMes = getDiasDelMes();
        const primerDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
        const primerDiaSemana = primerDia.getDay(); // 0 = Domingo, 1 = Lunes, etc.

        // Crear semanas del calendario
        const semanas = [];
        let semanaActual = [];

        // Añadir días vacíos al inicio si el mes no comienza en domingo
        for (let i = 0; i < primerDiaSemana; i++) {
            semanaActual.push(null);
        }

        // Añadir los días del mes
        for (const dia of diasMes) {
            semanaActual.push(dia);

            // Si completamos una semana (7 días), empezar nueva semana
            if (semanaActual.length === 7) {
                semanas.push([...semanaActual]);
                semanaActual = [];
            }
        }

        // Completar la última semana con días vacíos si es necesario
        if (semanaActual.length > 0) {
            while (semanaActual.length < 7) {
                semanaActual.push(null);
            }
            semanas.push(semanaActual);
        }

        return semanas;
    };

    // Obtener días de la semana seleccionada
    const getDiasDeSemana = (semanaOffset: number = 0): Date[] => {
        const hoy = new Date();
        const fechaBase = new Date(hoy);
        fechaBase.setDate(hoy.getDate() + (semanaOffset * 7));

        // Encontrar el lunes de la semana
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
    const formatFechaString = (fecha: Date): string => {
        return fecha.toISOString().split('T')[0];
    };

    // Obtener horario de un día específico
    const getHorarioDelDia = (horarios: Horario[], fecha: Date): Horario | undefined => {
        const fechaStr = formatFechaString(fecha);
        return horarios.find(h => {
            const fechaHorario = normalizarFecha(h.fecha);
            return fechaHorario === fechaStr;
        });
    };

    // Calcular resumen por usuario
    const calcularResumenUsuario = (horarios: Horario[]) => {
        const trabajados = horarios.filter(h => h.hora_entrada).length;
        const libres = horarios.filter(h => !h.hora_entrada).length;
        return { trabajados, libres };
    };

    // Función para cambiar de mes
    const cambiarMes = (direccion: 'anterior' | 'siguiente') => {
        const nuevaFecha = new Date(fechaActual);

        if (direccion === 'anterior') {
            nuevaFecha.setMonth(nuevaFecha.getMonth() - 1);
        } else {
            nuevaFecha.setMonth(nuevaFecha.getMonth() + 1);
        }

        setFechaActual(nuevaFecha);
    };

    // Función para cambiar de semana
    const cambiarSemana = (direccion: 'anterior' | 'siguiente') => {
        if (direccion === 'anterior') {
            setSemanaSeleccionada(prev => prev - 1);
        } else {
            setSemanaSeleccionada(prev => prev + 1);
        }
    };

    // Formatear hora para mostrar
    const formatHora = (hora: string | null) => {
        if (!hora || hora.trim() === '') return null;
        return hora.substring(0, 5); // Tomar solo HH:MM
    };

    // Componente de celda de calendario con horas mejoradas
    const CeldaCalendario = ({ usuario, fecha, horario }: { usuario: Usuario, fecha: Date, horario: Horario | undefined }) => {
        const esHoy = fecha.toDateString() === new Date().toDateString();
        const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
        const esDiaLibre = !horario?.hora_entrada;
        const tieneHorario = !!horario;

        return (
            <div className={`
                relative p-1.5 min-h-[80px] border border-zinc-800
                ${esFinDeSemana ? 'bg-zinc-900/60' : 'bg-zinc-900/40'}
                ${esDiaLibre ? 'bg-green-900/20' : ''}
                ${esHoy ? 'ring-1 ring-cyan-500/50 bg-cyan-900/10' : ''}
                hover:bg-zinc-800/30 transition-colors
            `}>
                <div className="absolute top-1.5 right-1.5">
                    <span className={`
                        text-xs font-medium px-1.5 py-0.5 rounded
                        ${esHoy ? 'bg-cyan-600 text-black' :
                            esFinDeSemana ? 'text-red-400' : 'text-zinc-300'}
                    `}>
                        {fecha.getDate()}
                    </span>
                </div>

                <div className="mt-5">
                    {horario?.hora_entrada ? (
                        <div className="space-y-2">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-zinc-400">⏰ Entrada:</span>
                                    <span className="text-xs font-medium text-cyan-300 bg-cyan-900/30 px-1.5 py-0.5 rounded">
                                        {formatHora(horario.hora_entrada)}
                                    </span>
                                </div>

                                {horario.hora_salida && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-zinc-400">🚪 Salida:</span>
                                        <span className="text-xs font-medium text-cyan-400 bg-cyan-900/30 px-1.5 py-0.5 rounded">
                                            {formatHora(horario.hora_salida)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-1 border-t border-zinc-800/50">
                                <div className="grid grid-cols-2 gap-x-1.5 gap-y-1">
                                    {horario.break_1 && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-zinc-500">B1:</span>
                                            <span className="text-[10px] text-zinc-300">
                                                {formatHora(horario.break_1)}
                                            </span>
                                        </div>
                                    )}

                                    {horario.colacion && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-zinc-500">Col:</span>
                                            <span className="text-[10px] text-zinc-300">
                                                {formatHora(horario.colacion)}
                                            </span>
                                        </div>
                                    )}

                                    {horario.break_2 && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-zinc-500">B2:</span>
                                            <span className="text-[10px] text-zinc-300">
                                                {formatHora(horario.break_2)}
                                            </span>
                                        </div>
                                    )}

                                    {!(horario.break_1 && horario.colacion && horario.break_2) && (
                                        <div className="invisible">
                                            <span className="text-[10px]">-</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : tieneHorario ? (
                        <div className="flex flex-col items-center justify-center h-full pt-2">
                            <span className="text-green-400 text-sm font-medium">Libre</span>
                            <span className="text-[10px] text-zinc-500 mt-0.5">Sin horario</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full pt-2">
                            <span className="text-zinc-600 text-xs">Sin registro</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const CalendarioUsuario = ({ usuario }: { usuario: Usuario }) => {
        const horariosNormalizados = usuario.horarios.map(h => ({
            ...h,
            fecha: normalizarFecha(h.fecha)
        }));

        const semanas = getCalendarioMes();
        const resumen = calcularResumenUsuario(horariosNormalizados);

        return (
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900 mb-4">
                <div className="bg-zinc-900 p-4 border-b border-zinc-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-cyan-600 text-black rounded-full flex items-center justify-center font-bold">
                                {usuario.nombre.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">{usuario.nombre}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-zinc-500">ID: {usuario.employeeid}</span>
                                    <span className="px-2 py-0.5 bg-cyan-600/20 text-cyan-400 text-xs rounded border border-cyan-500/30">
                                        {usuario.campana}
                                    </span>
                                    <span className="text-xs text-zinc-500">
                                        • {horariosNormalizados.length} registros
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="text-sm">
                            <div className="flex items-center gap-3">
                                <div className="px-2 py-1 bg-cyan-600/20 text-cyan-400 rounded text-sm">
                                    <span className="font-medium">{resumen.trabajados}</span>
                                    <span className="text-zinc-500"> trabajados</span>
                                </div>
                                <div className="px-2 py-1 bg-green-900/20 text-green-400 rounded text-sm">
                                    <span className="font-medium">{resumen.libres}</span>
                                    <span className="text-zinc-500"> libres</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {diasSemana.map((dia, index) => (
                            <div
                                key={dia}
                                className="text-center py-2 text-sm font-medium text-zinc-400 bg-zinc-800/30 rounded"
                            >
                                {dia}
                            </div>
                        ))}
                    </div>

                    <div className="space-y-1">
                        {semanas.map((semana, semanaIndex) => (
                            <div key={semanaIndex} className="grid grid-cols-7 gap-1">
                                {semana.map((fecha, diaIndex) => (
                                    <div key={diaIndex}>
                                        {fecha ? (
                                            <CeldaCalendario
                                                usuario={usuario}
                                                fecha={fecha}
                                                horario={getHorarioDelDia(horariosNormalizados, fecha)}
                                            />
                                        ) : (
                                            <div className="p-1.5 min-h-[80px] border border-zinc-800/30 bg-zinc-900/20 rounded"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-zinc-900 p-3 border-t border-zinc-800">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-cyan-600/50 rounded"></div>
                            <span>Horario asignado</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-green-900/50 rounded"></div>
                            <span>Día libre</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-red-900/50 rounded"></div>
                            <span>Fin de semana</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-cyan-600 ring-1 ring-cyan-500/50 rounded"></div>
                            <span>Hoy</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-cyan-300 text-xs">⏰</span>
                            <span>Entrada</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-cyan-400 text-xs">🚪</span>
                            <span>Salida</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Vista de semana
    const SemanaUsuario = ({ usuario }: { usuario: Usuario }) => {
        const horariosNormalizados = usuario.horarios.map(h => ({
            ...h,
            fecha: normalizarFecha(h.fecha)
        }));

        const diasSemanaArray = getDiasDeSemana(semanaSeleccionada);
        const resumen = calcularResumenUsuario(horariosNormalizados);

        return (
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900 mb-4">
                <div className="bg-zinc-900 p-4 border-b border-zinc-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-cyan-600 text-black rounded-full flex items-center justify-center font-bold">
                                {usuario.nombre.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-semibold">{usuario.nombre}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-zinc-500">ID: {usuario.employeeid}</span>
                                    <span className="px-2 py-0.5 bg-cyan-600/20 text-cyan-400 text-xs rounded border border-cyan-500/30">
                                        {usuario.campana}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="text-sm">
                            <div className="flex items-center gap-3">
                                <div className="px-2 py-1 bg-cyan-600/20 text-cyan-400 rounded text-sm">
                                    <span className="font-medium">{resumen.trabajados}</span>
                                    <span className="text-zinc-500"> trabajados</span>
                                </div>
                                <div className="px-2 py-1 bg-green-900/20 text-green-400 rounded text-sm">
                                    <span className="font-medium">{resumen.libres}</span>
                                    <span className="text-zinc-500"> libres</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4">
                    <div className="grid grid-cols-7 gap-2">
                        {diasSemanaArray.map((fecha, index) => {
                            const horario = getHorarioDelDia(horariosNormalizados, fecha);
                            const esHoy = fecha.toDateString() === new Date().toDateString();
                            const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
                            const diaSemana = diasSemana[fecha.getDay()];

                            return (
                                <div
                                    key={index}
                                    className={`
                                        border border-zinc-800 rounded-lg p-3
                                        ${esFinDeSemana ? 'bg-zinc-900/60' : 'bg-zinc-900/40'}
                                        ${!horario?.hora_entrada && horario ? 'bg-green-900/20' : ''}
                                        ${esHoy ? 'ring-1 ring-cyan-500/50' : ''}
                                    `}
                                >
                                    <div className="text-center mb-3">
                                        <div className="text-xs text-zinc-400">{diaSemana}</div>
                                        <div className={`
                                            text-lg font-semibold
                                            ${esHoy ? 'text-cyan-400' :
                                                esFinDeSemana ? 'text-red-400' : 'text-zinc-100'}
                                        `}>
                                            {fecha.getDate()}
                                            {esHoy && (
                                                <span className="text-xs text-cyan-300 ml-1">(Hoy)</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {horario?.hora_entrada ? (
                                            <>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between bg-cyan-900/30 p-2 rounded">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-xs text-cyan-300">⏰</span>
                                                            <span className="text-xs text-zinc-300">Entrada:</span>
                                                        </div>
                                                        <span className="text-sm font-medium text-cyan-300">
                                                            {formatHora(horario.hora_entrada)}
                                                        </span>
                                                    </div>

                                                    {horario.hora_salida && (
                                                        <div className="flex items-center justify-between bg-cyan-900/30 p-2 rounded">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-cyan-400">🚪</span>
                                                                <span className="text-xs text-zinc-300">Salida:</span>
                                                            </div>
                                                            <span className="text-sm font-medium text-cyan-400">
                                                                {formatHora(horario.hora_salida)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="pt-2 border-t border-zinc-800/50">
                                                    <div className="space-y-1.5">
                                                        {horario.break_1 && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-zinc-400">Break 1:</span>
                                                                <span className="text-xs text-zinc-300">
                                                                    {formatHora(horario.break_1)}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {horario.colacion && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-zinc-400">Colación:</span>
                                                                <span className="text-xs text-zinc-300">
                                                                    {formatHora(horario.colacion)}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {horario.break_2 && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-zinc-400">Break 2:</span>
                                                                <span className="text-xs text-zinc-300">
                                                                    {formatHora(horario.break_2)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        ) : horario ? (
                                            // Día libre
                                            <div className="text-center py-4">
                                                <span className="text-green-400 font-medium">Libre</span>
                                            </div>
                                        ) : (
                                            // Sin registro
                                            <div className="text-center py-4">
                                                <span className="text-zinc-600 text-sm">Sin registro</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="p-6 bg-zinc-950 min-h-screen flex items-center justify-center">
                <div className="text-zinc-400 flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                    <span>Cargando horarios...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-zinc-950 min-h-screen">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-6 p-4 bg-red-600/20 border border-red-600/50 text-red-400 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">❌</span>
                            <h3 className="font-medium">Error al cargar datos</h3>
                        </div>
                        <p>{error}</p>
                    </div>
                    <button
                        onClick={cargarHorarios}
                        className="px-4 py-2 bg-cyan-600 text-black rounded-lg font-semibold hover:bg-cyan-500 transition-all flex items-center gap-2"
                    >
                        <span className="text-lg">🔄</span>
                        <span>Reintentar</span>
                    </button>
                </div>
            </div>
        );
    }

    const mesActual = fechaActual.getMonth();
    const añoActual = fechaActual.getFullYear();

    // Obtener texto de semana
    const getTextoSemana = () => {
        if (vista !== 'semana') return '';

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

    return (
        <div className="p-4 md:p-6 bg-zinc-950 text-zinc-100 min-h-screen">
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-semibold">Calendario de Horarios</h1>
                    <p className="text-sm text-zinc-400 mt-1">
                        {vista === 'mes'
                            ? `${meses[mesActual]} ${añoActual}`
                            : getTextoSemana()}
                        <span className="mx-2">•</span>
                        <span className="text-cyan-400">{usuarios.length} usuarios</span>
                        <span className="mx-2">•</span>
                        <span className="text-zinc-300">
                            {vista === 'mes' ? 'Vista mensual completa' : 'Vista semanal'}
                        </span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-zinc-800 rounded-lg p-1">
                        <button
                            onClick={() => {
                                setVista('mes');
                            }}
                            className={`px-3 py-1.5 text-sm rounded-md transition-all ${vista === 'mes'
                                ? 'bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-500/30'
                                : 'text-zinc-400 hover:text-cyan-300 hover:bg-zinc-700'
                                }`}
                        >
                            Calendario Mensual
                        </button>
                        <button
                            onClick={() => {
                                setVista('semana');
                            }}
                            className={`px-3 py-1.5 text-sm rounded-md transition-all ${vista === 'semana'
                                ? 'bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-500/30'
                                : 'text-zinc-400 hover:text-cyan-300 hover:bg-zinc-700'
                                }`}
                        >
                            Vista Semanal
                        </button>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => vista === 'mes' ? cambiarMes('anterior') : cambiarSemana('anterior')}
                            className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                            title={vista === 'mes' ? 'Mes anterior' : 'Semana anterior'}
                        >
                            ◀
                        </button>
                        <button
                            onClick={() => {
                                if (vista === 'mes') {
                                    setFechaActual(new Date());
                                } else {
                                    setSemanaSeleccionada(0);
                                }
                            }}
                            className="px-3 py-2 text-sm bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 rounded-lg hover:bg-cyan-600/30 transition-colors"
                        >
                            Hoy
                        </button>
                        <button
                            onClick={() => vista === 'mes' ? cambiarMes('siguiente') : cambiarSemana('siguiente')}
                            className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                            title={vista === 'mes' ? 'Mes siguiente' : 'Semana siguiente'}
                        >
                            ▶
                        </button>
                    </div>

                    <button
                        onClick={cargarHorarios}
                        className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                        title="Actualizar datos"
                    >
                        🔄
                    </button>
                </div>
            </div>

            {usuarios.length === 0 ? (
                <div className="max-w-4xl mx-auto mt-12 p-6 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
                    <div className="text-4xl mb-4">📭</div>
                    <h2 className="text-xl font-semibold mb-2">No hay horarios registrados</h2>
                    <p className="text-zinc-400">
                        Los horarios aparecerán aquí una vez que se carguen datos en el sistema.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {usuarios.map((usuario) => (
                        <div key={usuario.employeeid}>
                            {vista === 'mes' ? (
                                <CalendarioUsuario usuario={usuario} />
                            ) : (
                                <SemanaUsuario usuario={usuario} />
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-8 pt-6 border-t border-zinc-800 text-center text-sm text-zinc-500">
                <div className="mb-2">
                    <span className="font-medium">Sistema de Calendario de Horarios</span>
                    <span className="mx-2">•</span>
                    <span>{vista === 'mes' ? 'Vista de calendario mensual completa' : 'Vista semanal detallada'}</span>
                </div>
                <div className="flex flex-wrap justify-center gap-3 text-xs">
                    <span>👥 Total usuarios: <span className="text-cyan-400 font-medium">{usuarios.length}</span></span>
                    <span>📅 {vista === 'mes' ? `${meses[mesActual]} ${añoActual}` : 'Vista semanal'}</span>
                    <span>🕒 Actualizado: {new Date().toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</span>
                </div>
            </div>
        </div>
    );
}