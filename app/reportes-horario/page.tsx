"use client";

import React, { useState, useEffect } from 'react';

interface ReporteDiario {
  fecha: string;
  diaSemana: string;
  totalEmpleados: number;
  trabajando: number;
  libres: number;
  porcentajeOcupacion: number;
}

interface ReporteHoras {
  hora: string;
  cantidad: number;
  porcentaje: number;
}

interface ReporteJornadas {
  tipo_jornada: string;
  cantidad: number;
  porcentaje: number;
}

interface ReporteResumen {
  total_empleados: number;
  total_dias: number;
  total_registros: number;
  total_trabajando: number;
  total_libres: number;
  porcentaje_ocupacion: number;
  horas_mas_comunes: Array<{ hora: string, cantidad: number }>;
}

const MESES = [
  { value: 0, nombre: 'Enero' },
  { value: 1, nombre: 'Febrero' },
  { value: 2, nombre: 'Marzo' },
  { value: 3, nombre: 'Abril' },
  { value: 4, nombre: 'Mayo' },
  { value: 5, nombre: 'Junio' },
  { value: 6, nombre: 'Julio' },
  { value: 7, nombre: 'Agosto' },
  { value: 8, nombre: 'Septiembre' },
  { value: 9, nombre: 'Octubre' },
  { value: 10, nombre: 'Noviembre' },
  { value: 11, nombre: 'Diciembre' }
];

export default function ReportesPage() {
  const [reporteDiario, setReporteDiario] = useState<ReporteDiario[]>([]);
  const [reporteHoras, setReporteHoras] = useState<ReporteHoras[]>([]);
  const [reporteJornadas, setReporteJornadas] = useState<ReporteJornadas[]>([]);
  const [reporteResumen, setReporteResumen] = useState<ReporteResumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [tipoReporte, setTipoReporte] = useState<'completo' | 'diario' | 'horas' | 'jornadas' | 'resumen'>('completo');

  // Estados para el selector de mes
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(new Date().getMonth());
  const [añoSeleccionado, setAñoSeleccionado] = useState<number>(new Date().getFullYear());
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');

  // Generar fechas basadas en mes y año seleccionados
  const actualizarFechas = () => {
    const primerDia = new Date(añoSeleccionado, mesSeleccionado, 1);
    const ultimoDia = new Date(añoSeleccionado, mesSeleccionado + 1, 0);

    setFechaInicio(primerDia.toISOString().split('T')[0]);
    setFechaFin(ultimoDia.toISOString().split('T')[0]);
  };

  // Inicializar fechas al cargar
  useEffect(() => {
    actualizarFechas();
  }, []);

  // Actualizar fechas cuando cambia el mes o año
  useEffect(() => {
    actualizarFechas();
  }, [mesSeleccionado, añoSeleccionado]);

  const cargarReportes = async (tipo: string = 'completo') => {
    if (!fechaInicio || !fechaFin) return;

    setLoading(true);
    try {
      const url = `/reportes-horario/api?tipo=${tipo}&fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        if (tipo === 'completo' && data.datos) {
          setReporteDiario(data.datos.diario || []);
          setReporteHoras(data.datos.horas || []);
          setReporteJornadas(data.datos.jornadas || []);
          setReporteResumen(data.datos.resumen || null);
        } else if (tipo === 'diario') {
          setReporteDiario(data.datos || []);
        } else if (tipo === 'horas') {
          setReporteHoras(data.datos || []);
        } else if (tipo === 'jornadas') {
          setReporteJornadas(data.datos || []);
        } else if (tipo === 'resumen') {
          setReporteResumen(data.datos || null);
        }
      }
    } catch (error) {
      console.error('Error cargando reportes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar reportes cuando cambian las fechas o el tipo de reporte
  useEffect(() => {
    if (fechaInicio && fechaFin) {
      cargarReportes(tipoReporte);
    }
  }, [fechaInicio, fechaFin, tipoReporte]);

  // Generar años disponibles (actual, anterior y siguiente)
  const generarAñosDisponibles = () => {
    const añoActual = new Date().getFullYear();
    return [añoActual - 1, añoActual, añoActual + 1];
  };

  // Navegación de meses
  const mesAnterior = () => {
    if (mesSeleccionado === 0) {
      setMesSeleccionado(11);
      setAñoSeleccionado(añoSeleccionado - 1);
    } else {
      setMesSeleccionado(mesSeleccionado - 1);
    }
  };

  const mesSiguiente = () => {
    if (mesSeleccionado === 11) {
      setMesSeleccionado(0);
      setAñoSeleccionado(añoSeleccionado + 1);
    } else {
      setMesSeleccionado(mesSeleccionado + 1);
    }
  };

  const irAMesActual = () => {
    const hoy = new Date();
    setMesSeleccionado(hoy.getMonth());
    setAñoSeleccionado(hoy.getFullYear());
  };

  if (loading) {
    return (
      <div className="text-center p-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-2">Cargando reportes...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div >
        <div className="space-y-8 p-4">
          {/* Selector de mes y año */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">📊 Reportes de Horarios</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Selector de mes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Mes
                </label>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={mesAnterior}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                    title="Mes anterior"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="flex-1">
                    <select
                      value={mesSeleccionado}
                      onChange={(e) => setMesSeleccionado(parseInt(e.target.value))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold"
                    >
                      {MESES.map((mes) => (
                        <option key={mes.value} value={mes.value}>
                          {mes.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={mesSiguiente}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                    title="Mes siguiente"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Selector de año */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Año
                </label>
                <select
                  value={añoSeleccionado}
                  onChange={(e) => setAñoSeleccionado(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold"
                >
                  {generarAñosDisponibles().map((año) => (
                    <option key={año} value={año}>
                      {año}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botón mes actual */}
              <div className="flex items-end">
                <button
                  onClick={irAMesActual}
                  className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Ir al mes actual</span>
                </button>
              </div>
            </div>
          </div>

          {/* Selector de tipo de reporte */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Tipo de Reporte</h3>
            <div className="flex flex-wrap gap-2">
              {['completo', 'diario', 'horas', 'jornadas', 'resumen'].map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => setTipoReporte(tipo as any)}
                  className={`px-4 py-2 rounded transition-colors ${tipoReporte === tipo
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                >
                  {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Reporte Resumen */}
          {reporteResumen && (tipoReporte === 'completo' || tipoReporte === 'resumen') && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-4">📊 Resumen General - {MESES[mesSeleccionado]?.nombre} {añoSeleccionado}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded border border-blue-100">
                  <div className="text-2xl font-bold text-blue-600">{reporteResumen.total_empleados}</div>
                  <div className="text-sm text-gray-600">Total Empleados</div>
                </div>
                <div className="bg-green-50 p-4 rounded border border-green-100">
                  <div className="text-2xl font-bold text-green-600">{reporteResumen.total_trabajando}</div>
                  <div className="text-sm text-gray-600">Días Trabajando</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded border border-yellow-100">
                  <div className="text-2xl font-bold text-yellow-600">{reporteResumen.total_libres}</div>
                  <div className="text-sm text-gray-600">Días Libres</div>
                </div>
                <div className="bg-purple-50 p-4 rounded border border-purple-100">
                  <div className="text-2xl font-bold text-purple-600">{reporteResumen.porcentaje_ocupacion}%</div>
                  <div className="text-sm text-gray-600">Ocupación</div>
                </div>
              </div>

              {/* Horas más comunes */}
              {reporteResumen.horas_mas_comunes && reporteResumen.horas_mas_comunes.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-lg font-semibold mb-2">🕐 Horas más comunes del mes</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {reporteResumen.horas_mas_comunes.map((hora, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded border">
                        <div className="font-bold text-center">
                          {hora.hora?.substring(0, 5) || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600 text-center">
                          {hora.cantidad} turnos
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reporte Diario */}
          {(tipoReporte === 'completo' || tipoReporte === 'diario') && reporteDiario.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-4">📅 Distribución Diaria - {MESES[mesSeleccionado]?.nombre} {añoSeleccionado}</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Día
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trabajando
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Libres
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ocupación
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reporteDiario.map((dia, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {dia.fecha}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {dia.diaSemana}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {dia.totalEmpleados}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                          {dia.trabajando}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-red-600">
                          {dia.libres}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${Math.min(dia.porcentajeOcupacion, 100)}%` }}
                              ></div>
                            </div>
                            <span className="ml-2 text-sm text-gray-900">
                              {dia.porcentajeOcupacion.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resumen del reporte diario */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Promedio de ocupación</div>
                  <div className="text-xl font-bold">
                    {(reporteDiario.reduce((sum, dia) => sum + dia.porcentajeOcupacion, 0) / reporteDiario.length).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Total días analizados</div>
                  <div className="text-xl font-bold">{reporteDiario.length}</div>
                </div>
                <div className="bg-purple-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Días con 100% ocupación</div>
                  <div className="text-xl font-bold">
                    {reporteDiario.filter(dia => dia.porcentajeOcupacion === 100).length}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reporte de Horas */}
          {(tipoReporte === 'completo' || tipoReporte === 'horas') && reporteHoras.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-4">🕐 Distribución de Horas de Entrada - {MESES[mesSeleccionado]?.nombre}</h3>

              <div className="overflow-x-auto mb-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hora
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Porcentaje
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Barra
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reporteHoras.map((hora, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                          {hora.hora}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {hora.cantidad}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {hora.porcentaje.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="w-48 bg-gray-200 rounded-full h-4">
                            <div
                              className="bg-green-600 h-4 rounded-full"
                              style={{ width: `${Math.min(hora.porcentaje * 3, 100)}%` }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Estadísticas del reporte de horas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded border border-green-100">
                  <div className="text-sm text-gray-600">Hora más popular</div>
                  <div className="text-xl font-bold text-green-600">
                    {reporteHoras.length > 0
                      ? reporteHoras.reduce((prev, current) =>
                        (prev.cantidad > current.cantidad) ? prev : current
                      ).hora
                      : 'N/A'
                    }
                  </div>
                </div>
                <div className="bg-blue-50 p-4 rounded border border-blue-100">
                  <div className="text-sm text-gray-600">Total turnos registrados</div>
                  <div className="text-xl font-bold text-blue-600">
                    {reporteHoras.reduce((sum, hora) => sum + hora.cantidad, 0)}
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded border border-purple-100">
                  <div className="text-sm text-gray-600">Horas diferentes</div>
                  <div className="text-xl font-bold text-purple-600">
                    {reporteHoras.length}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reporte de Jornadas */}
          {(tipoReporte === 'completo' || tipoReporte === 'jornadas') && reporteJornadas.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-4">📋 Distribución de Tipos de Jornada - {MESES[mesSeleccionado]?.nombre}</h3>

              <div className="overflow-x-auto mb-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo de Jornada
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Porcentaje
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Barra
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reporteJornadas.map((jornada, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {jornada.tipo_jornada}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {jornada.cantidad}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {jornada.porcentaje.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="w-48 bg-gray-200 rounded-full h-4">
                            <div
                              className="bg-blue-600 h-4 rounded-full"
                              style={{ width: `${Math.min(jornada.porcentaje * 2, 100)}%` }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resumen del reporte de jornadas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded border border-blue-100">
                  <div className="text-sm text-gray-600">Jornada más común</div>
                  <div className="text-xl font-bold text-blue-600">
                    {reporteJornadas.length > 0
                      ? reporteJornadas.reduce((prev, current) =>
                        (prev.cantidad > current.cantidad) ? prev : current
                      ).tipo_jornada
                      : 'N/A'
                    }
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded border border-green-100">
                  <div className="text-sm text-gray-600">Total jornadas registradas</div>
                  <div className="text-xl font-bold text-green-600">
                    {reporteJornadas.reduce((sum, jornada) => sum + jornada.cantidad, 0)}
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded border border-purple-100">
                  <div className="text-sm text-gray-600">Tipos de jornada</div>
                  <div className="text-xl font-bold text-purple-600">
                    {reporteJornadas.length}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mensaje cuando no hay datos */}
          {(!reporteDiario.length && !reporteHoras.length && !reporteJornadas.length && !reporteResumen) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                No hay datos de reporte para {MESES[mesSeleccionado]?.nombre} {añoSeleccionado}
              </h3>
              <p className="text-yellow-600">
                No se encontraron datos para el mes seleccionado.
                <br />
                <button
                  onClick={() => window.location.href = '/Horarios'}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Ir a Generar Horarios
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}