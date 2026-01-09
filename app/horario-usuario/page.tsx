// app/horarios-usuarios/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
    Horario, 
    ResumenUsuario,
    meses, 
    diasSemana, 
    normalizarFecha, 
    getCalendarioMes, 
    getDiasDeSemana, 
    formatFechaString, 
    formatHora, 
    calcularResumenUsuario, 
    getHorarioDelDia, 
    getTextoSemana, 
    cambiarMes, 
    esHoy, 
    esFinDeSemana 
} from './utils/fechaUtils';

// Definir tipos adicionales en el mismo archivo
type Vista = 'mes' | 'semana';

interface Usuario {
    employeeid: string;
    nombre: string;
    campana: string;
    horarios: Horario[];
}

export default function HorariosUsuariosPage() {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [vista, setVista] = useState<Vista>('mes');
    const [fechaActual, setFechaActual] = useState<Date>(new Date());
    const [semanaSeleccionada, setSemanaSeleccionada] = useState<number>(0);

    // Cargar horarios
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

    useEffect(() => {
        cargarHorarios();
    }, []);

    // Componente de celda de calendario - CON DISEÑO ACTUALIZADO
    const CeldaCalendario = ({ fecha, horario }: { fecha: Date; horario?: Horario }) => {
        const hoy = esHoy(fecha);
        const finDeSemana = esFinDeSemana(fecha);
        const esDiaLibre = !horario?.hora_entrada;
        const tieneHorario = !!horario;

        return (
            <div className={`
                relative p-2 min-h-[85px] border border-gray-200 dark:border-gray-700 rounded-lg
                ${finDeSemana ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-gray-800/50'}
                ${esDiaLibre ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}
                ${hoy ? 'ring-2 ring-violet-500/50 bg-violet-50 dark:bg-violet-900/20' : ''}
                hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200
                shadow-sm
            `}>
                <div className="absolute top-1.5 right-1.5">
                    <span className={`
                        text-xs font-medium px-2 py-0.5 rounded-full
                        ${hoy ? 'bg-violet-600 text-white' :
                            finDeSemana ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' : 
                            'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'}
                    `}>
                        {fecha.getDate()}
                    </span>
                </div>

                <div className="mt-6">
                    {horario?.hora_entrada ? (
                        <div className="space-y-1.5">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Entrada:</span>
                                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded">
                                        {formatHora(horario.hora_entrada)}
                                    </span>
                                </div>

                                {horario.hora_salida && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Salida:</span>
                                        <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded">
                                            {formatHora(horario.hora_salida)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-1 border-t border-gray-100 dark:border-gray-700/50">
                                <div className="grid grid-cols-2 gap-x-1.5 gap-y-1">
                                    {horario.break_1 && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-gray-500 dark:text-gray-500">B1:</span>
                                            <span className="text-[10px] text-gray-700 dark:text-gray-300">
                                                {formatHora(horario.break_1)}
                                            </span>
                                        </div>
                                    )}

                                    {horario.colacion && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-gray-500 dark:text-gray-500">Col:</span>
                                            <span className="text-[10px] text-gray-700 dark:text-gray-300">
                                                {formatHora(horario.colacion)}
                                            </span>
                                        </div>
                                    )}

                                    {horario.break_2 && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-gray-500 dark:text-gray-500">B2:</span>
                                            <span className="text-[10px] text-gray-700 dark:text-gray-300">
                                                {formatHora(horario.break_2)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : tieneHorario ? (
                        <div className="flex flex-col items-center justify-center h-full pt-3">
                            <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">Libre</span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-500 mt-0.5">Sin horario</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full pt-3">
                            <span className="text-gray-400 dark:text-gray-600 text-xs">Sin registro</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Vista de calendario mensual por usuario - CON DISEÑO ACTUALIZADO
    const CalendarioUsuario = ({ usuario }: { usuario: Usuario }) => {
        const horariosNormalizados = usuario.horarios.map(h => ({
            ...h,
            fecha: normalizarFecha(h.fecha)
        }));

        const semanas = getCalendarioMes(fechaActual);
        const resumen = calcularResumenUsuario(horariosNormalizados);

        return (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 mb-4 shadow-sm">
                <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-600 text-white rounded-full flex items-center justify-center font-bold">
                                {usuario.nombre.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 dark:text-gray-100">{usuario.nombre}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">ID: {usuario.employeeid}</span>
                                    <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs rounded-full border border-violet-200 dark:border-violet-700">
                                        {usuario.campana}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        • {horariosNormalizados.length} registros
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="text-sm">
                            <div className="flex items-center gap-3">
                                <div className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full text-sm">
                                    <span className="font-medium">{resumen.trabajados}</span>
                                    <span className="text-gray-600 dark:text-gray-400"> trabajados</span>
                                </div>
                                <div className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm">
                                    <span className="font-medium">{resumen.libres}</span>
                                    <span className="text-gray-600 dark:text-gray-400"> libres</span>
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
                                className="text-center py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded"
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
                                                fecha={fecha}
                                                horario={getHorarioDelDia(horariosNormalizados, fecha, normalizarFecha)}
                                            />
                                        ) : (
                                            <div className="p-2 min-h-[85px] border border-gray-200 dark:border-gray-700/30 bg-gray-50 dark:bg-gray-800/30 rounded-lg"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/30 p-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            <span>Horario asignado</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-emerald-300 rounded-full"></div>
                            <span>Día libre</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                            <span>Fin de semana</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-violet-600 rounded-full ring-1 ring-violet-500/50"></div>
                            <span>Hoy</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-emerald-500 text-xs">⏰</span>
                            <span>Entrada</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-emerald-400 text-xs">🚪</span>
                            <span>Salida</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Vista de semana por usuario - CON DISEÑO ACTUALIZADO
    const SemanaUsuario = ({ usuario }: { usuario: Usuario }) => {
        const horariosNormalizados = usuario.horarios.map(h => ({
            ...h,
            fecha: normalizarFecha(h.fecha)
        }));

        const diasSemanaArray = getDiasDeSemana(semanaSeleccionada);
        const resumen = calcularResumenUsuario(horariosNormalizados);

        return (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 mb-4 shadow-sm">
                <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-600 text-white rounded-full flex items-center justify-center font-bold">
                                {usuario.nombre.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 dark:text-gray-100">{usuario.nombre}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">ID: {usuario.employeeid}</span>
                                    <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs rounded-full border border-violet-200 dark:border-violet-700">
                                        {usuario.campana}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="text-sm">
                            <div className="flex items-center gap-3">
                                <div className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full text-sm">
                                    <span className="font-medium">{resumen.trabajados}</span>
                                    <span className="text-gray-600 dark:text-gray-400"> trabajados</span>
                                </div>
                                <div className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm">
                                    <span className="font-medium">{resumen.libres}</span>
                                    <span className="text-gray-600 dark:text-gray-400"> libres</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4">
                    <div className="grid grid-cols-7 gap-3">
                        {diasSemanaArray.map((fecha, index) => {
                            const horario = getHorarioDelDia(horariosNormalizados, fecha, normalizarFecha);
                            const hoy = esHoy(fecha);
                            const finDeSemana = esFinDeSemana(fecha);
                            const diaSemanaNombre = diasSemana[fecha.getDay()];

                            return (
                                <div
                                    key={index}
                                    className={`
                                        border border-gray-200 dark:border-gray-700 rounded-lg p-3
                                        ${finDeSemana ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-gray-800/50'}
                                        ${!horario?.hora_entrada && horario ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}
                                        ${hoy ? 'ring-2 ring-violet-500/50' : ''}
                                        shadow-sm
                                    `}
                                >
                                    <div className="text-center mb-3">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{diaSemanaNombre}</div>
                                        <div className={`
                                            text-lg font-semibold
                                            ${hoy ? 'text-violet-600 dark:text-violet-400' :
                                                finDeSemana ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}
                                        `}>
                                            {fecha.getDate()}
                                            {hoy && (
                                                <span className="text-xs text-violet-500 dark:text-violet-300 ml-1">(Hoy)</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {horario?.hora_entrada ? (
                                            <>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-xs text-emerald-500">⏰</span>
                                                            <span className="text-xs text-gray-700 dark:text-gray-300">Entrada:</span>
                                                        </div>
                                                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                                            {formatHora(horario.hora_entrada)}
                                                        </span>
                                                    </div>

                                                    {horario.hora_salida && (
                                                        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-emerald-400">🚪</span>
                                                                <span className="text-xs text-gray-700 dark:text-gray-300">Salida:</span>
                                                            </div>
                                                            <span className="text-sm font-medium text-emerald-500 dark:text-emerald-400">
                                                                {formatHora(horario.hora_salida)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
                                                    <div className="space-y-1.5">
                                                        {horario.break_1 && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-gray-600 dark:text-gray-400">Break 1:</span>
                                                                <span className="text-xs text-gray-700 dark:text-gray-300">
                                                                    {formatHora(horario.break_1)}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {horario.colacion && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-gray-600 dark:text-gray-400">Colación:</span>
                                                                <span className="text-xs text-gray-700 dark:text-gray-300">
                                                                    {formatHora(horario.colacion)}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {horario.break_2 && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-gray-600 dark:text-gray-400">Break 2:</span>
                                                                <span className="text-xs text-gray-700 dark:text-gray-300">
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
                                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Libre</span>
                                            </div>
                                        ) : (
                                            // Sin registro
                                            <div className="text-center py-4">
                                                <span className="text-gray-400 dark:text-gray-600 text-sm">Sin registro</span>
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

    // Estados de carga y error - CON DISEÑO ACTUALIZADO
    if (loading) {
        return (
            <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen flex items-center justify-center">
                <div className="text-gray-600 dark:text-gray-400 flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                    <span>Cargando horarios...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">❌</span>
                            <h3 className="font-medium text-red-800 dark:text-red-300">Error al cargar datos</h3>
                        </div>
                        <p className="text-red-700 dark:text-red-400">{error}</p>
                    </div>
                    <button
                        onClick={cargarHorarios}
                        className="px-4 py-2 bg-violet-600 text-white rounded-lg font-semibold hover:bg-violet-500 transition-all flex items-center gap-2"
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
    const textoSemana = getTextoSemana(semanaSeleccionada);

    return (
        <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 min-h-screen">
            {/* Controles - CON DISEÑO ACTUALIZADO */}
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100">Calendario de Horarios</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {vista === 'mes'
                            ? `${meses[mesActual]} ${añoActual}`
                            : textoSemana}
                        <span className="mx-2">•</span>
                        <span className="text-violet-600 dark:text-violet-400">{usuarios.length} usuarios</span>
                        <span className="mx-2">•</span>
                        <span className="text-gray-700 dark:text-gray-300">
                            {vista === 'mes' ? 'Vista mensual completa' : 'Vista semanal'}
                        </span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
                        <button
                            onClick={() => setVista('mes')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-all ${vista === 'mes'
                                ? 'bg-violet-600 text-white ring-1 ring-violet-500/30'
                                : 'text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            Calendario Mensual
                        </button>
                        <button
                            onClick={() => setVista('semana')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-all ${vista === 'semana'
                                ? 'bg-violet-600 text-white ring-1 ring-violet-500/30'
                                : 'text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            Vista Semanal
                        </button>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => {
                                if (vista === 'mes') {
                                    setFechaActual(cambiarMes(fechaActual, 'anterior'));
                                } else {
                                    setSemanaSeleccionada(prev => prev - 1);
                                }
                            }}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
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
                            className="px-3 py-2 text-sm bg-violet-600 text-white border border-violet-500/30 rounded-lg hover:bg-violet-500 transition-colors"
                        >
                            Hoy
                        </button>
                        <button
                            onClick={() => {
                                if (vista === 'mes') {
                                    setFechaActual(cambiarMes(fechaActual, 'siguiente'));
                                } else {
                                    setSemanaSeleccionada(prev => prev + 1);
                                }
                            }}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                            title={vista === 'mes' ? 'Mes siguiente' : 'Semana siguiente'}
                        >
                            ▶
                        </button>
                    </div>

                    <button
                        onClick={cargarHorarios}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                        title="Actualizar datos"
                    >
                        🔄
                    </button>
                </div>
            </div>

            {/* Contenido principal */}
            {usuarios.length === 0 ? (
                <div className="max-w-4xl mx-auto mt-12 p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center shadow-sm">
                    <div className="text-4xl mb-4 text-gray-400 dark:text-gray-500">📭</div>
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">No hay horarios registrados</h2>
                    <p className="text-gray-600 dark:text-gray-400">
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

            {/* Pie de página - CON DISEÑO ACTUALIZADO */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-600 dark:text-gray-500">
                <div className="mb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Sistema de Calendario de Horarios</span>
                    <span className="mx-2">•</span>
                    <span>{vista === 'mes' ? 'Vista de calendario mensual completa' : 'Vista semanal detallada'}</span>
                </div>
                <div className="flex flex-wrap justify-center gap-3 text-xs">
                    <span>👥 Total usuarios: <span className="text-violet-600 dark:text-violet-400 font-medium">{usuarios.length}</span></span>
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