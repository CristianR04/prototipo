// GeneradorInteligenteAvanzado.tsx
'use client';

import { useState } from 'react';

interface EstadisticasGeneracion {
  totalAsignaciones: number;
  totalTeleoperadores: number;
  distribucionTurnos: {
    apertura: number;
    cierre: number;
    normal: number;
  };
  diasLibres: number;
  diasReducidos: number;
}

interface ResumenGeneracion {
  totalGenerado: number;
  insertados: number;
  errores: number;
  eliminados: number;
  rango: {
    inicio: string;
    fin: string;
  };
}

export default function GeneradorInteligenteAvanzado() {
  const [fechaInicio, setFechaInicio] = useState('2025-12-29');
  const [fechaFin, setFechaFin] = useState('2026-02-01');
  const [isLoading, setIsLoading] = useState(false);
  const [mostrarVistaPrevia, setMostrarVistaPrevia] = useState(false);
  const [estadisticas, setEstadisticas] = useState<EstadisticasGeneracion | null>(null);
  const [resumenFinal, setResumenFinal] = useState<ResumenGeneracion | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error' | 'info'; texto: string } | null>(null);

  const handleVistaPrevia = async () => {
    setIsLoading(true);
    setMensaje({ tipo: 'info', texto: 'Generando vista previa...' });
    
    try {
      const response = await fetch('/Horarios/api/horario-inteligente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          vista_previa: true
        })
      });

      const data = await response.json();

      if (data.success) {
        setEstadisticas(data.estadisticas);
        setMostrarVistaPrevia(true);
        setMensaje({ tipo: 'success', texto: 'Vista previa generada exitosamente' });
      } else {
        setMensaje({ tipo: 'error', texto: data.message || 'Error al generar vista previa' });
      }
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerarYGuardar = async () => {
    if (!window.confirm(
      `¿Generar y guardar horarios del ${fechaInicio} al ${fechaFin}?\n\n` +
      `⚠️ ADVERTENCIA: Los horarios existentes en este rango serán eliminados y reemplazados.\n\n` +
      `Esta acción no se puede deshacer.`
    )) {
      return;
    }

    setIsLoading(true);
    setMensaje({ tipo: 'info', texto: 'Generando y guardando horarios inteligentes...' });

    try {
      const response = await fetch('/Horarios/api/horario-inteligente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          vista_previa: false
        })
      });

      const data = await response.json();

      if (data.success) {
        setResumenFinal(data.resumen);
        setMostrarVistaPrevia(false);
        setMensaje({ 
          tipo: 'success', 
          texto: `✅ ${data.message} - ${data.resumen.insertados} horarios guardados` 
        });
      } else {
        setMensaje({ tipo: 'error', texto: data.message || 'Error al generar horarios' });
      }
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const calcularDias = () => {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const diff = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    return diff + 1;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">🤖</span>
          Generador Inteligente de Horarios
        </h2>
        <p className="text-blue-100 mt-2">
          Sistema automatizado con cumplimiento de normativas laborales
        </p>
      </div>

      {/* Contenido */}
      <div className="p-6 space-y-6">
        {/* Mensaje */}
        {mensaje && (
          <div className={`p-4 rounded-lg flex items-start gap-3 ${
            mensaje.tipo === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 text-green-700 dark:text-green-400'
              : mensaje.tipo === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-400'
              : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 text-blue-700 dark:text-blue-400'
          }`}>
            {mensaje.tipo === 'info' && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mt-0.5"></div>
            )}
            <div className="flex-1">
              <p className="font-medium">{mensaje.texto}</p>
            </div>
            <button 
              onClick={() => setMensaje(null)} 
              className="text-current opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Configuración de Fechas */}
        <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span>📅</span>
            Rango de Fechas
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 disabled:opacity-50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fecha Fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700/50">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <span className="font-semibold">Período:</span> {calcularDias()} días
              <span className="mx-2">•</span>
              <span className="font-semibold">Rango:</span> {new Date(fechaInicio).toLocaleDateString('es-ES')} - {new Date(fechaFin).toLocaleDateString('es-ES')}
            </p>
          </div>
        </div>

        {/* Características del Sistema */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-5 rounded-xl border border-purple-200 dark:border-purple-700/50">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span>⚙️</span>
            Reglas Automáticas
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { icon: '📊', texto: 'Patrón 5x2 (5 días trabajo, 2 libres)' },
              { icon: '🚫', texto: 'Máximo 6 días consecutivos' },
              { icon: '⏰', texto: 'Máximo 44 horas semanales' },
              { icon: '📅', texto: '1 fin de semana libre/mes' },
              { icon: '☀️', texto: '2 domingos libres/mes' },
              { icon: '👥', texto: 'Lunes con dotación completa' },
              { icon: '🏖️', texto: 'Domingos: 16-20 teleoperadores' },
              { icon: '🎯', texto: '20% apertura, 20% cierre, 60% normal' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="text-lg">{item.icon}</span>
                <span className="text-gray-700 dark:text-gray-300">{item.texto}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vista Previa de Estadísticas */}
        {mostrarVistaPrevia && estadisticas && (
          <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-xl border border-green-200 dark:border-green-700/50">
            <h3 className="font-semibold text-green-800 dark:text-green-300 mb-4 flex items-center gap-2">
              <span>📊</span>
              Vista Previa de Generación
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                  {estadisticas.totalAsignaciones}
                </div>
                <div className="text-sm text-green-600 dark:text-green-500 mt-1">
                  Asignaciones Totales
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                  {estadisticas.totalTeleoperadores}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-500 mt-1">
                  Teleoperadores
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-700 dark:text-purple-400">
                  {estadisticas.diasLibres}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-500 mt-1">
                  Días Libres
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-700 dark:text-orange-400">
                  {estadisticas.diasReducidos}
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-500 mt-1">
                  Días Reducidos (44h)
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
              <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
                Distribución de Turnos:
              </h4>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Apertura: {estadisticas.distribucionTurnos.apertura}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Cierre: {estadisticas.distribucionTurnos.cierre}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Normal: {estadisticas.distribucionTurnos.normal}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resumen Final */}
        {resumenFinal && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-xl border border-emerald-200 dark:border-emerald-700/50">
            <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-4 flex items-center gap-2">
              <span>✅</span>
              Generación Completada
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                  {resumenFinal.insertados}
                </div>
                <div className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">
                  Horarios Guardados
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                  {resumenFinal.eliminados}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-500 mt-1">
                  Anteriores Eliminados
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-700 dark:text-purple-400">
                  {resumenFinal.totalGenerado}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-500 mt-1">
                  Total Generado
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-red-700 dark:text-red-400">
                  {resumenFinal.errores}
                </div>
                <div className="text-sm text-red-600 dark:text-red-500 mt-1">
                  Errores
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleVistaPrevia}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <span>👁️</span>
                <span>Vista Previa</span>
              </>
            )}
          </button>

          <button
            onClick={handleGenerarYGuardar}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:opacity-90 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Generando...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Generar y Guardar</span>
              </>
            )}
          </button>
        </div>

        {/* Información Adicional */}
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-700/50">
          <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
            <span>ℹ️</span>
            Información Importante
          </h4>
          <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
            <li>• Los horarios se generan cumpliendo todas las normativas laborales</li>
            <li>• Se respetan automáticamente los casos especiales de empleados</li>
            <li>• Las licencias se marcan como "Libre" automáticamente</li>
            <li>• Usa "Vista Previa" para revisar antes de guardar</li>
            <li>• Los horarios guardados reemplazan los existentes en el rango</li>
          </ul>
        </div>
      </div>
    </div>
  );
}