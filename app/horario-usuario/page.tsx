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
    esFinDeSemana,
    esDiaLibre
} from './utils/fechaUtils';

// Definir tipos adicionales
type Vista = 'mes' | 'semana';

interface Usuario {
    employeeid: string;
    nombre: string;
    campana: string;
    horarios: Horario[];
}

// Tipo para festivos
interface Festivo {
    fecha: string;
    nombre: string;
    pais: 'chile' | 'colombia' | 'ambos';
    nacional?: boolean;
    observaciones?: string;
}

export default function HorariosUsuariosPage() {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [vista, setVista] = useState<Vista>('mes');
    const [fechaActual, setFechaActual] = useState<Date>(new Date());
    const [semanaSeleccionada, setSemanaSeleccionada] = useState<number>(0);
    const [festivos, setFestivos] = useState<Festivo[]>([]); // Nuevo estado para festivos

    // Función para cargar festivos
    const cargarFestivos = async () => {
        try {
            const año = fechaActual.getFullYear();

            // Cargar festivos de Chile
            const resChile = await fetch(`/Horarios/api/festivos?pais=Chile&año=${año}`);
            const dataChile = await resChile.json();

            // Cargar festivos de Colombia
            const resColombia = await fetch(`/Horarios/api/festivos?pais=Colombia&año=${año}`);
            const dataColombia = await resColombia.json();

            const festivosCombinados: Festivo[] = [];
            const festivosPorFecha: Record<string, {
                fecha: string;
                nombres: string[];
                paises: ('chile' | 'colombia')[];
            }> = {};

            // Procesar festivos de Chile
            if (dataChile.success && dataChile.festivos) {
                dataChile.festivos.forEach((f: any) => {
                    const fecha = f.fecha;
                    if (!festivosPorFecha[fecha]) {
                        festivosPorFecha[fecha] = {
                            fecha,
                            nombres: [],
                            paises: []
                        };
                    }
                    festivosPorFecha[fecha].nombres.push(f.descripcion);
                    if (!festivosPorFecha[fecha].paises.includes('chile')) {
                        festivosPorFecha[fecha].paises.push('chile');
                    }
                });
            }

            // Procesar festivos de Colombia
            if (dataColombia.success && dataColombia.festivos) {
                dataColombia.festivos.forEach((f: any) => {
                    const fecha = f.fecha;
                    if (!festivosPorFecha[fecha]) {
                        festivosPorFecha[fecha] = {
                            fecha,
                            nombres: [],
                            paises: []
                        };
                    }
                    festivosPorFecha[fecha].nombres.push(f.descripcion);
                    if (!festivosPorFecha[fecha].paises.includes('colombia')) {
                        festivosPorFecha[fecha].paises.push('colombia');
                    }
                });
            }

            // Convertir al formato para mostrar
            Object.values(festivosPorFecha).forEach(item => {
                let pais: 'chile' | 'colombia' | 'ambos' = 'chile';
                if (item.paises.includes('chile') && item.paises.includes('colombia')) {
                    pais = 'ambos';
                } else if (item.paises.includes('colombia')) {
                    pais = 'colombia';
                }

                festivosCombinados.push({
                    fecha: item.fecha,
                    nombre: item.nombres[0] || 'Festivo',
                    pais,
                    nacional: true,
                    observaciones: item.nombres.length > 1 ?
                        `También: ${item.nombres.slice(1).join(', ')}` : undefined
                });
            });

            setFestivos(festivosCombinados);

        } catch (error) {
            console.error('Error cargando festivos:', error);
        }
    };

    // Cargar horarios y festivos
    const cargarHorarios = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/horario-usuario/api/usuarios');
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
        cargarFestivos();
    }, []);

    // Cargar festivos cuando cambia el año
    useEffect(() => {
        cargarFestivos();
    }, [fechaActual.getFullYear()]);

    // Función para determinar si una fecha es festivo
    const esFestivo = (fecha: Date) => {
        const fechaStr = fecha.toISOString().split('T')[0];
        return festivos.find(f => f.fecha === fechaStr);  // festivos, no festivo
    };

    // Función para obtener color de fondo según tipo de día
    const getBackgroundColor = (fecha: Date, esFinDeSemana: boolean) => {
        const festivo = esFestivo(fecha);  // Llamar a la función, no al array

        if (festivo) {
            if (festivo.pais === 'ambos') {
                return 'bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/15 dark:to-purple-800/15 border-purple-200 dark:border-purple-700';
            } else if (festivo.pais === 'chile') {
                return 'bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-900/15 dark:to-rose-800/15 border-rose-200 dark:border-rose-700';
            } else if (festivo.pais === 'colombia') {
                return 'bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-900/15 dark:to-yellow-800/15 border-yellow-200 dark:border-yellow-700';
            }
        }

        if (esFinDeSemana) {
            return 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/15 dark:to-red-800/15 border-red-200 dark:border-red-700';
        }

        return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    };

    // Versión corregida - Con colores de festivos
    const CeldaCalendario = ({ fecha, horario }: { fecha: Date; horario?: Horario }) => {
        const hoy = esHoy(fecha);
        const finDeSemana = esFinDeSemana(fecha);
        const diaLibre = esDiaLibre(horario);
        const esDiaDelMes = fecha.getMonth() === fechaActual.getMonth();
        const festivo = esFestivo(fecha);  // CORRECTO: llamamos a la función

        if (!esDiaDelMes) return <div className="min-h-[85px]"></div>;

        return (
            <div className={`
            relative min-h-[85px] p-2 border rounded-lg group overflow-hidden
            ${hoy ? 'ring-2 ring-violet-500/50' : ''}
            ${getBackgroundColor(fecha, finDeSemana)}
        `}>
                {/* Fecha en esquina */}
                <div className="absolute top-0 left-0 z-10">
                    <div className={`
                    flex flex-col items-center justify-center 
                    ${hoy ? 'bg-violet-600' :
                            festivo ? (  // festivo es el resultado de esFestivo(fecha)
                                festivo.pais === 'ambos' ? 'bg-purple-500' :
                                    festivo.pais === 'chile' ? 'bg-rose-500' :
                                        'bg-yellow-500'
                            ) :
                                finDeSemana ? 'bg-red-500 dark:bg-red-600' :
                                    'bg-gray-300 dark:bg-gray-700'}
                    rounded-br-lg px-2 py-1
                `}>
                        <span className="text-xs font-bold text-white">
                            {fecha.getDate()}
                        </span>
                        <span className="text-[8px] text-white/80">
                            {fecha.toLocaleDateString('es-ES', { weekday: 'short' }).charAt(0)}
                        </span>
                    </div>
                </div>
                {/* Indicador visual de festivo */}
                {festivo && (
                    <div className="absolute top-0 right-0 z-10">
                        <div className={`
                            w-2 h-2 rounded-full m-1
                            ${festivo.pais === 'ambos' ? 'bg-purple-500 ring-1 ring-purple-300' : ''}
                            ${festivo.pais === 'chile' ? 'bg-rose-500 ring-1 ring-rose-300' : ''}
                            ${festivo.pais === 'colombia' ? 'bg-yellow-500 ring-1 ring-yellow-300' : ''}
                        `}></div>
                    </div>
                )}

                {/* Contenido principal - CON MARGEN PARA LA FECHA */}
                <div className="h-full flex items-center justify-center pt-3 ml-8">
                    {horario?.hora_entrada && horario.hora_entrada !== "Libre" ? (
                        <>
                            {/* ENTRADA - IZQUIERDA */}
                            <div className="flex flex-col items-center flex-1 max-w-[30%]">
                                <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5 uppercase tracking-wider">
                                    Entrada
                                </div>
                                <div className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                                    {formatHora(horario.hora_entrada)}
                                </div>
                            </div>

                            {/* SEPARADOR VISUAL - CENTRO */}
                            <div className="flex flex-col items-center mx-2">
                                <div className="w-6 h-0.5 bg-gradient-to-r from-emerald-400 to-indigo-400 dark:from-emerald-500 dark:to-indigo-500 rounded-full mb-1"></div>
                                <div className="text-[8px] text-gray-400 dark:text-gray-500">→</div>
                                <div className="w-6 h-0.5 bg-gradient-to-r from-indigo-400 to-emerald-400 dark:from-indigo-500 dark:to-emerald-500 rounded-full mt-1"></div>
                            </div>

                            {/* SALIDA - DERECHA */}
                            {horario.hora_salida && (
                                <div className="flex flex-col items-center flex-1 max-w-[45%]">
                                    <div className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 mb-0.5 uppercase tracking-wider">
                                        Salida
                                    </div>
                                    <div className="text-base font-bold text-indigo-800 dark:text-indigo-300">
                                        {formatHora(horario.hora_salida)}
                                    </div>
                                </div>
                            )}

                            {/* OVERLAY DE DESCANSO - CONTENIDO DENTRO DE LÍMITES */}
                            {(horario.break_1 || horario.colacion || horario.break_2) && (
                                <div
                                    className="absolute inset-0
                                        bg-white/97 dark:bg-gray-800/97 rounded-lg
                                        opacity-0 group-hover:opacity-100 transition-all duration-300
                                        flex items-center justify-center
                                        shadow-xl z-20
                                        border border-gray-300/30 dark:border-gray-600/30
                                        m-1 overflow-hidden"
                                >
                                    {/* Contenido del overlay - CON PADDING ADECUADO */}
                                    <div className="text-center w-full px-2 translate-y-0">
                                        <div className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                            🕐 Horarios de Descanso
                                        </div>

                                        {/* Descansos en tarjetas - COMPACTAS */}
                                        <div className="grid grid-cols-3 gap-1.5 max-w-full px-1">
                                            {horario.break_1 && (
                                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/25 dark:to-blue-800/25 
                                                          border border-blue-200 dark:border-blue-700 rounded-lg 
                                                          transition-transform duration-200 group-hover:scale-105">
                                                    <div className="text-blue-600 dark:text-blue-400 text-xs mb-0.5">☕</div>
                                                    <div className="text-[10px] font-bold text-blue-800 dark:text-blue-300">
                                                        {formatHora(horario.break_1)}
                                                    </div>
                                                    <div className="text-[8px] text-gray-600 dark:text-gray-400 mt-0.5 font-medium">
                                                        Break 1
                                                    </div>
                                                </div>
                                            )}

                                            {horario.colacion && (
                                                <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/25 dark:to-orange-800/25 
                                                          border border-orange-200 dark:border-orange-700 rounded-lg
                                                          transition-transform duration-200 group-hover:scale-105">
                                                    <div className="text-orange-600 dark:text-orange-400 text-xs mb-0.5">🍽️</div>
                                                    <div className="text-[10px] font-bold text-orange-800 dark:text-orange-300">
                                                        {formatHora(horario.colacion)}
                                                    </div>
                                                    <div className="text-[8px] text-gray-600 dark:text-gray-400 mt-0.5 font-medium">
                                                        Colación
                                                    </div>
                                                </div>
                                            )}

                                            {horario.break_2 && (
                                                <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/25 dark:to-teal-800/25 
                                                          border border-teal-200 dark:border-teal-700 rounded-lg 
                                                          transition-transform duration-200 group-hover:scale-105">
                                                    <div className="text-teal-600 dark:text-teal-400 text-xs mb-0.5">☕</div>
                                                    <div className="text-[10px] font-bold text-teal-800 dark:text-teal-300">
                                                        {formatHora(horario.break_2)}
                                                    </div>
                                                    <div className="text-[8px] text-gray-600 dark:text-gray-400 mt-0.5 font-medium">
                                                        Break 2
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : diaLibre ? (
                        // Día libre - Centrado con margen
                        <div className="flex flex-col items-center justify-center w-full ml-6">
                            <div className="text-amber-600 dark:text-amber-400 text-base mb-0.5">🕊️</div>
                            <div className="text-sm font-bold text-amber-700 dark:text-amber-400">Día Libre</div>
                            <div className="text-[9px] text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                                Sin horario asignado
                            </div>
                        </div>
                    ) : (
                        // Sin registro
                        <div className="w-full text-center ml-6">
                            <span className="text-gray-400/70 dark:text-gray-600/70 text-sm">— Sin registro —</span>
                        </div>
                    )}
                </div>

                {/* Tooltip de festivo */}
                {festivo && (
                    <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                        <div className="font-medium text-gray-800 dark:text-gray-100 mb-1">
                            {festivo.nombre}
                        </div>
                        <div className={`
                            text-[10px] font-medium px-2 py-0.5 rounded inline-block
                            ${festivo.pais === 'ambos' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : ''}
                            ${festivo.pais === 'chile' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' : ''}
                            ${festivo.pais === 'colombia' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' : ''}
                        `}>
                            {festivo.pais === 'ambos' ? 'Chile y Colombia' : festivo.pais === 'chile' ? 'Solo Chile' : 'Solo Colombia'}
                        </div>
                    </div>
                )}
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
                                            <div className="p-2 min-h-[100px] border border-gray-200 dark:border-gray-700/30 bg-gray-50 dark:bg-gray-800/30 rounded-lg"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Leyenda actualizada con festivos */}
                <div className="bg-gray-50 dark:bg-gray-700/30 p-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            <span>Horario normal</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                            <span>Día libre</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                            <span>Fin de semana</span>
                        </div>
                        {/* Nueva leyenda para festivos */}
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-purple-500/20 border border-purple-500/50 rounded-full"></div>
                            <span>Festivo ambos</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-rose-500/20 border border-rose-500/50 rounded-full"></div>
                            <span>Festivo Chile</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-yellow-500/20 border border-yellow-500/50 rounded-full"></div>
                            <span>Festivo Colombia</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-violet-600 rounded-full ring-1 ring-violet-500/50"></div>
                            <span>Hoy</span>
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
                            const diaLibre = esDiaLibre(horario);
                            const diaSemanaNombre = diasSemana[fecha.getDay()];
                            const festivo = esFestivo(fecha);

                            return (
                                <div
                                    key={index}
                                    className={` border rounded-lg p-3 min-h-[180px]
                                    ${hoy ? 'ring-2 ring-violet-500/50' : ''}
                                    ${getBackgroundColor(fecha, finDeSemana)}
                                    shadow-sm flex flex-col
                                `}
                                >
                                    <div className="text-center mb-3">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{diaSemanaNombre}</div>
                                            <div className={`
                                            text-lg font-semibold
                                            ${hoy ? 'text-violet-600 dark:text-violet-400' :
                                                festivo ? (
                                                festivo.pais === 'ambos' ? 'text-purple-600 dark:text-purple-400' :
                                                festivo.pais === 'chile' ? 'text-rose-600 dark:text-rose-400' :
                                                'text-yellow-600 dark:text-yellow-400'
                                                ) :
                                                diaLibre ? 'text-amber-600 dark:text-amber-400' :
                                                finDeSemana ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}
                                            `}>
                                            {fecha.getDate()}
                                            {hoy && (
                                                <span className="text-xs text-violet-500 dark:text-violet-300 ml-1">(Hoy)</span>
                                            )}
                                            {festivo && (
                                            <div className={`
                                                text-[8px] px-1 py-0.5 rounded-full inline-block ml-1
                                                ${festivo.pais === 'ambos' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : ''}
                                                ${festivo.pais === 'chile' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' : ''}
                                                ${festivo.pais === 'colombia' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' : ''}
                                            `}>
                                                {festivo.pais === 'ambos' ? 'Festivo' : festivo.pais.charAt(0).toUpperCase()}
                                            </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-grow flex flex-col">
                                        {horario?.hora_entrada && horario.hora_entrada !== "Libre" ? (
                                            <div className="space-y-2.5">
                                                {/* Ingreso */}
                                                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs text-emerald-500">⏰</span>
                                                        <span className="text-xs text-gray-700 dark:text-gray-300">Ingreso:</span>
                                                    </div>
                                                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                                        {formatHora(horario.hora_entrada)}
                                                    </span>
                                                </div>

                                                {/* Break 1 */}
                                                {horario.break_1 && (
                                                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs text-blue-500">☕</span>
                                                            <span className="text-xs text-gray-700 dark:text-gray-300">Break:</span>
                                                        </div>
                                                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                                            {formatHora(horario.break_1)}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Colación */}
                                                {horario.colacion && (
                                                    <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs text-orange-500">🍽️</span>
                                                            <span className="text-xs text-gray-700 dark:text-gray-300">Colación:</span>
                                                        </div>
                                                        <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                                                            {formatHora(horario.colacion)}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Break 2 */}
                                                {horario.break_2 && (
                                                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs text-blue-500">☕</span>
                                                            <span className="text-xs text-gray-700 dark:text-gray-300">Break 2:</span>
                                                        </div>
                                                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                                            {formatHora(horario.break_2)}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Salida */}
                                                {horario.hora_salida && (
                                                    <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded border-t border-emerald-100 dark:border-emerald-800 mt-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs text-emerald-400">🚪</span>
                                                            <span className="text-xs text-gray-700 dark:text-gray-300">Salida:</span>
                                                        </div>
                                                        <span className="text-sm font-medium text-emerald-500 dark:text-emerald-400">
                                                            {formatHora(horario.hora_salida)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : diaLibre ? (
                                            // Día libre en vista semanal
                                            <div className="flex-grow flex flex-col items-center justify-center">
                                                <div className="text-amber-600 dark:text-amber-400 font-medium text-sm mb-1">Día Libre</div>
                                                <div className="text-[10px] text-amber-500 dark:text-amber-400/70 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full">
                                                    Descanso programado
                                                </div>
                                            </div>
                                        ) : (
                                            // Sin registro
                                            <div className="flex-grow flex items-center justify-center">
                                                <span className="text-gray-400 dark:text-gray-600 text-sm">-</span>
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

    // Estados de carga y error
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
            {/* Controles */}
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
                            {vista === 'mes' ? 'Vista mensual' : 'Vista semanal'}
                        </span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Botón para recargar festivos */}
                    <button
                        onClick={cargarFestivos}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                        title="Actualizar festivos"
                    >
                        🎯 Festivos
                    </button>

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

            {/* Estadísticas de festivos */}
            <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl shadow-sm border border-purple-100 dark:border-purple-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Festivos en {añoActual}:</span>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/50"></div>
                                <span className="text-xs text-gray-600 dark:text-gray-400">Ambos: {festivos.filter(f => f.pais === 'ambos').length}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/50"></div>
                                <span className="text-xs text-gray-600 dark:text-gray-400">Chile: {festivos.filter(f => f.pais === 'chile').length}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/50"></div>
                                <span className="text-xs text-gray-600 dark:text-gray-400">Colombia: {festivos.filter(f => f.pais === 'colombia').length}</span>
                            </div>
                        </div>
                    </div>
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
                                // Aquí deberías también actualizar SemanaUsuario con los mismos colores
                                <SemanaUsuario usuario={usuario} />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pie de página actualizado */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-600 dark:text-gray-500">
                <div className="mb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Sistema de Calendario de Horarios</span>
                    <span className="mx-2">•</span>
                    <span>{vista === 'mes' ? 'Vista de calendario mensual' : 'Vista semanal detallada'}</span>
                </div>
                <div className="flex flex-wrap justify-center gap-3 text-xs">
                    <span>👥 Total usuarios: <span className="text-violet-600 dark:text-violet-400 font-medium">{usuarios.length}</span></span>
                    <span>📅 {vista === 'mes' ? `${meses[mesActual]} ${añoActual}` : 'Vista semanal'}</span>
                    <span>🎯 Festivos:
                        <span className="text-purple-600 dark:text-purple-400 font-medium"> {festivos.filter(f => f.pais === 'ambos').length} ambos</span>,
                        <span className="text-rose-600 dark:text-rose-400 font-medium"> {festivos.filter(f => f.pais === 'chile').length} Chile</span>,
                        <span className="text-yellow-600 dark:text-yellow-400 font-medium"> {festivos.filter(f => f.pais === 'colombia').length} Colombia</span>
                    </span>
                    <span>🕒 Actualizado: {new Date().toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</span>
                </div>
            </div>
        </div>
    );
}