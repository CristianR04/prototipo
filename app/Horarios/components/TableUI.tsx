import React from 'react';
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
  onAplicarTipoJornadaGlobal
}) => {
  const { vista, año, mes } = configFechas;

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

  return (
    <>
      {/* Panel de navegación - Estilo de card del primer diseño */}
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

      {/* Panel de selección - Estilo de card del primer diseño */}
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
                  {/* Selector de hora - Estilo del primer diseño */}
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
                  
                  {/* Selector de tipo de jornada - Estilo del primer diseño */}
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
    </>
  );
};

export default TablaHorariosUI;