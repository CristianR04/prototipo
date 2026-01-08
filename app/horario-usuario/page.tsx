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

// Definir los tipos de eventos/horarios que mostraremos
const EVENTOS = [
    { key: 'hora_entrada', label: 'Entrada', icon: '⏰' },
    { key: 'break_1', label: 'Break 1', icon: '☕' },
    { key: 'colacion', label: 'Colación', icon: '🍽️' },
    { key: 'break_2', label: 'Break 2', icon: '☕' },
    { key: 'hora_salida', label: 'Salida', icon: '🚪' },
];

export default function HorariosUsuariosPage() {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    // Función para normalizar fechas
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

    // Obtener los últimos 7 días
    const getDiasSemana = (): string[] => {
        const dias: string[] = [];
        const hoy = new Date();

        const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

        for (let i = 6; i >= 0; i--) {
            const fecha = new Date(hoyLocal);
            fecha.setDate(hoyLocal.getDate() - i);

            const año = fecha.getFullYear();
            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
            const dia = String(fecha.getDate()).padStart(2, '0');

            dias.push(`${año}-${mes}-${dia}`);
        }

        return dias;
    };

    // Formatear fecha para encabezado
    const formatFechaHeader = (fechaString: string) => {
        const [año, mes, dia] = fechaString.split('-').map(Number);
        const fecha = new Date(año, mes - 1, dia);

        const dias = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
        const diaSemana = dias[fecha.getDay()];

        return (
            <div className="text-center">
                <div className="text-xs text-zinc-400 font-normal mb-0.5">
                    {diaSemana}
                </div>
                <div className={`font-bold text-sm ${fecha.getDay() === 0 || fecha.getDay() === 6
                        ? 'text-red-400'
                        : 'text-zinc-100'
                    }`}>
                    {String(dia).padStart(2, '0')}/{String(mes).padStart(2, '0')}
                </div>
            </div>
        );
    };

    // Formatear hora/evento
    const formatHora = (hora: string | null) => {
        if (!hora || hora.trim() === '') {
            return (
                <div className="text-green-400 italic font-bold bg-green-900/20 px-2 py-1 rounded border border-green-800/50 text-xs text-center min-w-[60px]">
                    Libre
                </div>
            );
        }
        return (
            <div className="text-cyan-400 font-bold bg-zinc-800 px-2 py-1 rounded border border-zinc-700 text-xs text-center min-w-[60px]">
                {hora}
            </div>
        );
    };

    // Obtener horario de un día específico
    const getHorarioDelDia = (horarios: Horario[], dia: string): Horario | undefined => {
        return horarios.find(h => {
            const fechaHorario = normalizarFecha(h.fecha);
            return fechaHorario === dia;
        });
    };

    // Obtener valor de un evento específico
    const getValorEvento = (horario: Horario | undefined, eventoKey: string): string | null => {
        if (!horario) return null;
        return horario[eventoKey as keyof Horario] as string | null;
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

    const diasSemana = getDiasSemana();

    return (
        <div className="p-4 md:p-6 bg-zinc-950 text-zinc-100 min-h-screen">
            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-semibold">Visualización de Horarios</h1>
                    <p className="text-sm text-zinc-400 mt-1">
                        Semana del {diasSemana[0]} al {diasSemana[diasSemana.length - 1]}
                        <span className="mx-2">•</span>
                        <span className="text-cyan-400">{usuarios.length} usuarios</span>
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={cargarHorarios}
                        className="px-4 py-2 bg-cyan-600 text-black rounded-lg font-semibold hover:bg-cyan-500 transition-all flex items-center gap-2"
                    >
                        <span className="text-lg">🔄</span>
                        <span>Actualizar</span>
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
                    {usuarios.map((usuario) => {
                        // Normalizar fechas de los horarios del usuario
                        const horariosNormalizados = usuario.horarios.map(h => ({
                            ...h,
                            fecha: normalizarFecha(h.fecha)
                        }));

                        // Calcular estadísticas
                        const diasTrabajados = horariosNormalizados.filter(h => h.hora_entrada).length;
                        const diasLibres = horariosNormalizados.filter(h => !h.hora_entrada).length;

                        return (
                            <div
                                key={usuario.employeeid}
                                className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900"
                            >
                                {/* Encabezado del usuario */}
                                <div className="bg-zinc-900 p-4 border-b border-zinc-800">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-cyan-600 text-black rounded-full flex items-center justify-center font-bold">
                                                    👤
                                                </div>
                                                <div>
                                                    <h2 className="text-lg font-semibold">{usuario.nombre}</h2>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        <span className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs">
                                                            🔢 ID: {usuario.employeeid}
                                                        </span>
                                                        <span className="px-2 py-1 bg-cyan-600/20 text-cyan-400 rounded text-xs">
                                                            🏢 {usuario.campana}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1">
                                            <div className="px-3 py-1.5 bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 rounded-lg font-bold text-sm flex items-center gap-2">
                                                <span>📅</span>
                                                <span>{diasTrabajados} trabajados / {diasLibres} libres</span>
                                            </div>
                                            <div className="text-xs text-zinc-500">
                                                {horariosNormalizados.length} registros
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabla de horarios */}
                                <div className="overflow-x-auto p-4">
                                    <table className="w-full border-collapse text-sm min-w-[1000px]">
                                        {/* Encabezado con fechas */}
                                        <thead>
                                            <tr>
                                                <th className="p-3 text-left bg-zinc-900 border-b-2 border-zinc-800 border-r-2 border-zinc-800 w-32 sticky left-0 z-10">
                                                    <div className="font-semibold text-zinc-300">Eventos</div>
                                                </th>

                                                {diasSemana.map((dia) => {
                                                    const [año, mes, diaNum] = dia.split('-').map(Number);
                                                    const fecha = new Date(año, mes - 1, diaNum);
                                                    const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
                                                    const tieneHorario = getHorarioDelDia(horariosNormalizados, dia) !== undefined;

                                                    return (
                                                        <th
                                                            key={dia}
                                                            className={`p-2 text-center min-w-[100px] ${esFinDeSemana
                                                                    ? 'bg-zinc-900 border-l-2 border-red-800/50'
                                                                    : 'bg-zinc-900 border-l border-zinc-800'
                                                                }`}
                                                        >
                                                            <div className="relative">
                                                                {formatFechaHeader(dia)}
                                                                {tieneHorario && (
                                                                    <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                                                                )}
                                                            </div>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>

                                        {/* Cuerpo con eventos */}
                                        <tbody>
                                            {EVENTOS.map((evento) => (
                                                <tr key={evento.key} className="border-t border-zinc-800 hover:bg-zinc-900/30">
                                                    {/* Nombre del evento */}
                                                    <td className="p-3 bg-zinc-900 border-r-2 border-zinc-800 sticky left-0 z-5 whitespace-nowrap">
                                                        <div className="flex items-center gap-2 font-medium text-zinc-300">
                                                            <span className="text-sm">{evento.icon}</span>
                                                            <span>{evento.label}</span>
                                                        </div>
                                                    </td>

                                                    {/* Valores para cada día */}
                                                    {diasSemana.map((dia) => {
                                                        const horario = getHorarioDelDia(horariosNormalizados, dia);
                                                        const valor = getValorEvento(horario, evento.key);
                                                        const [año, mes, diaNum] = dia.split('-').map(Number);
                                                        const fecha = new Date(año, mes - 1, diaNum);
                                                        const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
                                                        const esDiaLibre = !horario?.hora_entrada;

                                                        return (
                                                            <td
                                                                key={`${dia}-${evento.key}`}
                                                                className={`p-2 text-center ${esFinDeSemana
                                                                        ? 'bg-zinc-900 border-l-2 border-red-800/50'
                                                                        : 'bg-zinc-900 border-l border-zinc-800'
                                                                    } ${esDiaLibre && evento.key === 'hora_entrada' ? 'bg-green-900/10' : ''}`}
                                                            >
                                                                <div className="flex justify-center">
                                                                    {formatHora(valor)}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Resumen del usuario */}
                                <div className="bg-zinc-900 p-3 border-t border-zinc-800">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-zinc-400">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-3 h-3 bg-cyan-600/20 border border-cyan-500/30 rounded"></div>
                                                <span>Horario asignado</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-3 h-3 bg-green-900/20 border border-green-800/50 rounded"></div>
                                                <span>Día libre</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-red-400 font-bold">DOM/SÁB</span>
                                                <span>Fin de semana</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                                <span>Con registro</span>
                                            </div>
                                        </div>

                                        <div className="text-zinc-500">
                                            Actualizado: {new Date().toLocaleTimeString('es-ES', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-zinc-800 text-center text-sm text-zinc-500">
                <div className="mb-2">
                    <span className="font-medium">Sistema de Horarios</span>
                    <span className="mx-2">•</span>
                    <span>Vista semanal de horarios</span>
                </div>
                <div className="flex flex-wrap justify-center gap-3 text-xs">
                    <span>👥 Total usuarios: <span className="text-cyan-400 font-medium">{usuarios.length}</span></span>
                    <span>📅 Período: {diasSemana[0]} - {diasSemana[diasSemana.length - 1]}</span>
                    <span>🕒 {new Date().toLocaleDateString('es-ES')}</span>
                </div>
            </div>
        </div>
    );
}