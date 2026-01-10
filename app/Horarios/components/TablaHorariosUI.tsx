// app/Horarios/components/TablaHorariosUI.tsx
import React, { useState } from 'react';
import { 
  VistaFecha, 
  ModoSeleccion, 
  TipoJornada,
  ConfigFechas 
} from '../utils/types';
import { 
  MESES, 
  MESES_ABR 
} from '../utils/constants';

interface TablaHorariosUIProps {
  configFechas: ConfigFechas;
  modoSeleccion: ModoSeleccion | null;
  celdasSeleccionadas: Array<{ employeeid: string; fecha: string }>;
  textoRangoFechas: string;
  textoSemana: string;
  añosDisponibles: number[];
  todasCeldasSeleccionadas: boolean;
  HORAS_OPCIONES: string[];
  TIPOS_JORNADA: Array<{ value: TipoJornada; label: string; color: string; desc: string }>;
  cambiosPendientes: number;
  isLoading: boolean;
  mensaje: { tipo: string; texto: string } | null;
  
  onCambiarVista: (vista: VistaFecha) => void;
  onCambiarAño: (año: number) => void;
  onCambiarMes: (mes: number) => void;
  onCambiarMesNavigation: (direccion: "anterior" | "siguiente") => void;
  onCambiarAñoNavigation: (direccion: "anterior" | "siguiente") => void;
  onSeleccionarMesActual: () => void;
  onSeleccionarSemanaActual: () => void;
  onToggleModoSeleccion: (modo: ModoSeleccion) => void;
  onToggleSeleccionTodo: () => void;
  onLimpiarSeleccion: () => void;
  onAplicarHoraGlobal: (hora: string) => void;
  onAplicarTipoJornadaGlobal: (tipo: TipoJornada) => void;
  onGuardarHorarios: () => void;
  onGenerarHorariosAutomaticos: (meses?: number) => void;
  onGenerarMalla5x2: (params: { fecha_inicio: string; fecha_fin: string; employeeids?: string[] }) => void;
  onRevertirCambios: () => void;
  onRecargarUsuarios: () => void;
}

const TablaHorariosUI: React.FC<TablaHorariosUIProps> = ({
  configFechas,
  modoSeleccion,
  celdasSeleccionadas,
  textoRangoFechas,
  textoSemana,
  añosDisponibles,
  todasCeldasSeleccionadas,
  HORAS_OPCIONES,
  TIPOS_JORNADA,
  cambiosPendientes,
  isLoading,
  mensaje,
  
  onCambiarVista,
  onCambiarAño,
  onCambiarMes,
  onCambiarMesNavigation,
  onCambiarAñoNavigation,
  onSeleccionarMesActual,
  onSeleccionarSemanaActual,
  onToggleModoSeleccion,
  onToggleSeleccionTodo,
  onLimpiarSeleccion,
  onAplicarHoraGlobal,
  onAplicarTipoJornadaGlobal,
  onGuardarHorarios,
  onGenerarHorariosAutomaticos,
  onGenerarMalla5x2,
  onRevertirCambios,
  onRecargarUsuarios
}) => {
  const { vista, año, mes } = configFechas;
  const [mostrarGenerador5x2, setMostrarGenerador5x2] = useState(false);
  const [fechaInicio5x2, setFechaInicio5x2] = useState('2025-12-29');
  const [fechaFin5x2, setFechaFin5x2] = useState('2026-02-01');
  const [mostrarConfig5x2, setMostrarConfig5x2] = useState(false);

  const renderSelectorVista = () => (
    <div className="flex gap-2">
      {(["mes", "semana", "anual"] as VistaFecha[]).map(v => (
        <button
          key={v}
          onClick={() => onCambiarVista(v)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            vista === v
              ? "bg-violet-600 text-white"
              : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
          title={`Vista ${v}`}
        >
          {v.charAt(0).toUpperCase() + v.slice(1)}
        </button>
      ))}
    </div>
  );

  const renderNavegacionFechas = () => {
    if (vista === "anual") {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCambiarAñoNavigation("anterior")}
            disabled={!añosDisponibles.includes(año - 1)}
            className={`p-2 rounded-lg transition-colors ${
              añosDisponibles.includes(año - 1)
                ? "text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                : "text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 cursor-not-allowed"
            }`}
            title="Año anterior"
          >
            ◀
          </button>
          <select
            value={año}
            onChange={(e) => onCambiarAño(parseInt(e.target.value))}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {añosDisponibles.map(a => (
              <option key={a} value={a}>
                {a} {a === año ? "(Actual)" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => onCambiarAñoNavigation("siguiente")}
            disabled={!añosDisponibles.includes(año + 1)}
            className={`p-2 rounded-lg transition-colors ${
              añosDisponibles.includes(año + 1)
                ? "text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                : "text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 cursor-not-allowed"
            }`}
            title="Año siguiente"
          >
            ▶
          </button>
        </div>
      );
    }

    if (vista === "mes") {
      return (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onCambiarMesNavigation("anterior")} 
            className="p-2 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
            title="Mes anterior"
          >
            ◀
          </button>
          <div className="flex items-center gap-2">
            <select 
              value={año} 
              onChange={(e) => onCambiarAño(parseInt(e.target.value))} 
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {añosDisponibles.map(a => <option key={a} value={a}>{a} {a === año ? "(Actual)" : ""}</option>)}
            </select>
            <select 
              value={mes} 
              onChange={(e) => onCambiarMes(parseInt(e.target.value))} 
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[120px]"
            >
              {MESES.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
            </select>
          </div>
          <button 
            onClick={() => onCambiarMesNavigation("siguiente")} 
            className="p-2 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
            title="Mes siguiente"
          >
            ▶
          </button>
        </div>
      );
    }

    if (vista === "semana") {
      return (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onCambiarMesNavigation("anterior")} 
            className="p-2 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
            title="Semana anterior"
          >
            ◀
          </button>
          <div className="px-4 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200">
            {textoSemana}
          </div>
          <button 
            onClick={() => onCambiarMesNavigation("siguiente")} 
            className="p-2 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
            title="Semana siguiente"
          >
            ▶
          </button>
        </div>
      );
    }

    return null;
  };

  const renderSelectorMesAnual = vista === "anual" && (
    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
        {MESES.map((m, idx) => {
          const esMesActual = idx === mes && año === new Date().getFullYear();
          return (
            <button
              key={m}
              onClick={() => onCambiarMes(idx)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                esMesActual
                  ? "bg-violet-600 text-white"
                  : "text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              title={`${m} ${año}${esMesActual ? ' (Mes actual)' : ''}`}
            >
              {MESES_ABR[idx]}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderSelectorModo = () => (
    <div className="flex gap-2">
      {(["rango", "disperso"] as ModoSeleccion[]).map(modo => (
        <button
          key={modo}
          onClick={() => onToggleModoSeleccion(modo)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
            modoSeleccion === modo
              ? modo === "rango" 
                ? "bg-amber-600 text-white" 
                : "bg-purple-600 text-white"
              : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          <span className="text-lg">{modo === "rango" ? "⬜" : "🔘"}</span>
          {modo === "rango" ? "Rango" : "Disperso"}
        </button>
      ))}
    </div>
  );

  const renderPanelAcciones = () => (
    <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800">
      <div className="space-y-4">
        {/* Mensajes del sistema */}
        {mensaje && (
          <div className={`p-4 rounded-lg border ${
            mensaje.tipo === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : mensaje.tipo === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-lg">
                {mensaje.tipo === 'success' ? '✅' : 
                 mensaje.tipo === 'error' ? '❌' : 'ℹ️'}
              </span>
              <span className="font-medium">{mensaje.texto}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Botones de gestión */}
            <button
              onClick={onGuardarHorarios}
              disabled={cambiosPendientes === 0 || isLoading}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                cambiosPendientes > 0 && !isLoading
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              }`}
            >
              💾 Guardar Cambios
              {cambiosPendientes > 0 && (
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
                  {cambiosPendientes}
                </span>
              )}
            </button>

            <button
              onClick={onRevertirCambios}
              disabled={cambiosPendientes === 0 || isLoading}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                cambiosPendientes > 0 && !isLoading
                  ? "bg-amber-600 text-white hover:bg-amber-700"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              }`}
            >
              ↩️ Revertir
            </button>

            <button
              onClick={onRecargarUsuarios}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
            >
              🔄 Recargar
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Botones de generación */}
            <button
              onClick={() => onGenerarHorariosAutomaticos(2)}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors flex items-center gap-2"
            >
              ⚡ Generar 2 Meses
            </button>

            <button
              onClick={() => setMostrarGenerador5x2(true)}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-2"
            >
              🗓️ Malla 5x2
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderModalGenerador5x2 = () => {
    if (!mostrarGenerador5x2) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                🗓️ Generador de Malla 5x2
              </h3>
              <button
                onClick={() => setMostrarGenerador5x2(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fecha Inicio *
                  </label>
                  <input
                    type="date"
                    value={fechaInicio5x2}
                    onChange={(e) => setFechaInicio5x2(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fecha Fin *
                  </label>
                  <input
                    type="date"
                    value={fechaFin5x2}
                    onChange={(e) => setFechaFin5x2(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMostrarConfig5x2(!mostrarConfig5x2)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
              >
                {mostrarConfig5x2 ? '▲' : '▼'} Ver reglas de configuración
              </button>

              {mostrarConfig5x2 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                  <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">📋 Reglas que se aplicarán:</h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                    <li>• Turno 5x2 (5 días trabajo / 2 libres)</li>
                    <li>• Lunes obligatorios para todos</li>
                    <li>• Máximo 6 días consecutivos trabajados</li>
                    <li>• 20% apertura / 20% cierre diario</li>
                    <li>• 1 fin de semana libre por mes por empleado</li>
                    <li>• 2 domingos libres por mes por empleado</li>
                    <li>• 16-20 teleoperadores los domingos</li>
                    <li>• Ajuste de 44 horas semanales</li>
                    <li>• 1° enero 2026 tratado como domingo</li>
                  </ul>
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Las reglas se obtienen automáticamente de la tabla <code>configuracion_horarios</code>
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setMostrarGenerador5x2(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!fechaInicio5x2 || !fechaFin5x2) {
                      return;
                    }

                    await onGenerarMalla5x2({
                      fecha_inicio: fechaInicio5x2,
                      fecha_fin: fechaFin5x2
                    });
                  }}
                  disabled={isLoading}
                  className="px-6 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generando...
                    </>
                  ) : (
                    '🚀 Generar Malla 5x2'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Panel de acciones */}
      {renderPanelAcciones()}

      {/* Panel de navegación */}
      <div className="mb-6 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Vista:</span>
              {renderSelectorVista()}
            </div>

            <div className="flex items-center gap-3">
              {renderNavegacionFechas()}
              <button
                onClick={vista === "semana" ? onSeleccionarSemanaActual : onSeleccionarMesActual}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
                title="Ir al período actual"
              >
                Hoy
              </button>
            </div>
          </div>
          {renderSelectorMesAnual}
        </div>
      </div>

      {/* Panel de selección */}
      <div className="mb-6 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Selección:</span>
              {renderSelectorModo()}
            </div>

            {modoSeleccion && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={onToggleSeleccionTodo} 
                  className={`p-2 rounded-lg transition-colors ${
                    todasCeldasSeleccionadas
                      ? "bg-emerald-600 text-white"
                      : "text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`} 
                  title={todasCeldasSeleccionadas ? "Deseleccionar todo" : "Seleccionar todas las celdas"}
                >
                  <span className="text-lg">✓✓</span>
                </button>
                <button 
                  onClick={onLimpiarSeleccion} 
                  className="p-2 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
                  title="Limpiar selección"
                >
                  <span className="text-lg">✕</span>
                </button>
              </div>
            )}
          </div>

          {modoSeleccion && celdasSeleccionadas.length > 0 && (
            <>
              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent"></div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${modoSeleccion === "rango" ? "bg-amber-500" : "bg-purple-500"}`}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold text-gray-800 dark:text-gray-100">{celdasSeleccionadas.length}</span> celdas seleccionadas
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  <select 
                    onChange={(e) => onAplicarHoraGlobal(e.target.value)} 
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[160px]" 
                    defaultValue=""
                  >
                    <option value="" disabled>Aplicar hora...</option>
                    <option value="Libre">Libre</option>
                    {HORAS_OPCIONES.filter(h => h !== "Libre").map(hora => (
                      <option key={hora} value={hora}>{hora}</option>
                    ))}
                  </select>
                  
                  <select 
                    onChange={(e) => onAplicarTipoJornadaGlobal(e.target.value as TipoJornada)} 
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[180px]" 
                    defaultValue=""
                  >
                    <option value="" disabled>Tipo de jornada...</option>
                    {TIPOS_JORNADA.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label} ({tipo.desc})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal del generador 5x2 */}
      {renderModalGenerador5x2()}
    </>
  );
};

export default TablaHorariosUI;