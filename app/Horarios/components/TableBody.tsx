import React, { useRef } from 'react';
import { 
  Usuario, 
  FechaDia, 
  HorarioCompleto, 
  TipoJornada,
  ModoSeleccion,
  CeldaSeleccionada 
} from '../utils/types';
import { 
  MESES_ABR,
  DIAS_SEMANA 
} from '../utils/constants';

interface TablaHorariosBodyProps {
  usuarios: Usuario[];
  fechas: FechaDia[];
  horariosCompletos: Record<string, HorarioCompleto>;
  horariosOriginales: Record<string, HorarioCompleto>;
  horasEntrada: Record<string, string>;
  tiposJornada: Record<string, TipoJornada>;
  modoSeleccion: ModoSeleccion | null;
  celdasSeleccionadas: CeldaSeleccionada[];
  estaSeleccionada: (employeeid: string, fecha: string) => boolean;
  HORAS_OPCIONES: string[];
  TIPOS_JORNADA: Array<{ value: TipoJornada; label: string; color: string; desc: string }>;
  
  onCambiarTipoJornada: (employeeid: string, fecha: string, tipo: TipoJornada) => void;
  onCambiarHoraEntrada: (employeeid: string, fecha: string, hora: string) => void;
  onMouseDownCelda: (employeeid: string, fecha: string, e: React.MouseEvent) => void;
  onMouseEnterCelda: (employeeid: string, fecha: string) => void;
  onMouseUp: () => void;
  onToggleSeleccionColumna: (fecha: string) => void;
  onSeleccionarFila: (employeeid: string) => void;
  isLoading: boolean;
}

const TablaHorariosBody: React.FC<TablaHorariosBodyProps> = ({
  usuarios,
  fechas,
  horariosCompletos,
  horariosOriginales,
  horasEntrada,
  tiposJornada,
  modoSeleccion,
  celdasSeleccionadas,
  estaSeleccionada,
  HORAS_OPCIONES,
  TIPOS_JORNADA,
  
  onCambiarTipoJornada,
  onCambiarHoraEntrada,
  onMouseDownCelda,
  onMouseEnterCelda,
  onMouseUp,
  onToggleSeleccionColumna,
  onSeleccionarFila,
  isLoading
}) => {
  const tablaRef = useRef<HTMLDivElement>(null);

  const renderCelda = (usuario: Usuario, fecha: FechaDia) => {
    const key = `${usuario.employeeid}-${fecha.fullDate}`;
    const horario = horariosCompletos[key];
    const horaEntradaActual = horasEntrada[key] || "Libre";
    const tipoJornadaActual = tiposJornada[key] || "normal";
    
    const horarioOriginal = horariosOriginales[key];
    const hayCambio = horario && horarioOriginal && (
      horario.hora_entrada !== horarioOriginal.hora_entrada ||
      horario.tipo_jornada !== horarioOriginal.tipo_jornada
    );
    
    const seleccionada = estaSeleccionada(usuario.employeeid, fecha.fullDate);
    
    const getEstiloSeleccion = () => {
      if (!seleccionada) return '';
      if (modoSeleccion === "rango") return 'ring-1 ring-amber-500/30 bg-amber-500/10';
      if (modoSeleccion === "disperso") return 'ring-1 ring-purple-500/30 bg-purple-500/10';
      return '';
    };

    const getBackgroundColor = () => {
      if (fecha.esFinDeSemana) return 'bg-blue-50/50 dark:bg-blue-900/10';
      return 'bg-white dark:bg-gray-800';
    };

    const getSelectStyles = (isChanged: boolean) => {
      const baseStyles = "w-full border rounded px-2 py-1.5 text-xs transition-all cursor-pointer z-10";
      const modeStyles = modoSeleccion ? 'pointer-events-none opacity-70' : 'hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700';
      
      if (isChanged) {
        return `${baseStyles} border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 ${modeStyles}`;
      }
      
      if (fecha.esFinDeSemana) {
        return `${baseStyles} border-blue-200 dark:border-blue-700/50 bg-blue-50/30 dark:bg-blue-900/10 text-gray-800 dark:text-gray-200 ${modeStyles}`;
      }
      
      return `${baseStyles} border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 ${modeStyles}`;
    };

    const getTextColor = (tipo: TipoJornada) => {
      switch (tipo) {
        case "normal": return "text-cyan-600 dark:text-cyan-400";
        case "entrada_tardia": return "text-orange-600 dark:text-orange-400";
        default: return "text-gray-600 dark:text-gray-400";
      }
    };

    return (
      <td 
        key={key} 
        className={`p-2 ${getBackgroundColor()} transition-colors duration-150`}
        onMouseDown={(e) => onMouseDownCelda(usuario.employeeid, fecha.fullDate, e)}
        onMouseEnter={() => onMouseEnterCelda(usuario.employeeid, fecha.fullDate)}
        onMouseUp={onMouseUp}
      >
        <div className="relative">
          <div className={`absolute inset-0 rounded ${getEstiloSeleccion()} ${
            modoSeleccion ? 'cursor-pointer' : ''
          }`}></div>
          
          <div className="relative flex flex-col gap-2">
            {/* Selector de tipo de jornada */}
            <select
              value={tipoJornadaActual}
              onChange={(e) => onCambiarTipoJornada(usuario.employeeid, fecha.fullDate, e.target.value as TipoJornada)}
              className={`${getSelectStyles(hayCambio)} ${getTextColor(tipoJornadaActual)}`}
              disabled={isLoading || modoSeleccion !== null}
            >
              {TIPOS_JORNADA.map(tipo => (
                <option key={tipo.value} value={tipo.value} className={getTextColor(tipo.value)}>
                  {tipo.label}
                </option>
              ))}
            </select>
            
            {/* Selector de hora de entrada */}
            <select
              value={horaEntradaActual}
              onChange={(e) => onCambiarHoraEntrada(usuario.employeeid, fecha.fullDate, e.target.value)}
              className={`${getSelectStyles(hayCambio)} ${horaEntradaActual !== "Libre" ? "text-cyan-600 dark:text-cyan-400" : "text-gray-500 dark:text-gray-400"}`}
              disabled={isLoading || modoSeleccion !== null}
            >
              {HORAS_OPCIONES.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>


          
          {/* Información de horas calculadas (tooltip) */}
          {horaEntradaActual !== "Libre" && horario && (
            <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 rounded shadow-sm opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
              <div className="font-medium text-gray-800 dark:text-gray-100">Horarios calculados:</div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">Break 1:</span>
                <span className="font-medium">{horario.break_1 || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">Colación:</span>
                <span className="font-medium">{horario.colacion || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">Break 2:</span>
                <span className="font-medium">{horario.break_2 || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">Salida:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{horario.hora_salida || "-"}</span>
              </div>
            </div>
          )}
        </div>
      </td>
    );
  };

  return (
    <div ref={tablaRef} className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-xl select-none bg-white dark:bg-gray-900" onMouseUp={onMouseUp}>
      <table className="w-full border-collapse text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-20">
          <tr>
            <th className="p-3 sticky left-0 bg-violet-600 text-white z-30 min-w-[180px] border-r border-violet-700">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Usuario</span>
              </div>
            </th>
            {fechas.map(f => (
              <th key={f.id} className="p-3 text-center min-w-[90px] border-l border-gray-200 dark:border-gray-700">
                <div className="flex flex-col items-center relative group">
                  <div className={`font-semibold ${f.esFinDeSemana ? "text-red-500 dark:text-red-400" : "text-gray-800 dark:text-gray-100"}`}>
                    {DIAS_SEMANA[new Date(f.fullDate).getDay()]}
                  </div>
                  <div className={`text-xs mt-1 ${f.esHoy ? "bg-violet-600 text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto" : f.esFinDeSemana ? "text-red-500 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
                    {f.diaNumero}
                  </div>
                  {modoSeleccion && (
                    <button 
                      onClick={() => onToggleSeleccionColumna(f.fullDate)} 
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" 
                      title="Alternar selección de columna"
                    >
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${
                        usuarios.every(usuario => estaSeleccionada(usuario.employeeid, f.fullDate))
                          ? "bg-cyan-600/20 ring-1 ring-cyan-500/30"
                          : "bg-white/90 dark:bg-gray-700/90 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                      }`}>
                        <span className="text-xs text-gray-700 dark:text-gray-300">↓</span>
                      </div>
                    </button>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {usuarios.map(usuario => (
            <tr key={usuario.employeeid} className="border-t border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors duration-150 group">
              <td className="p-3 sticky left-0 bg-white dark:bg-gray-900 z-10 border-r border-gray-200 dark:border-gray-700 group-hover:bg-gray-50 dark:group-hover:bg-gray-800/50 relative min-w-[180px]">
                <div className="flex items-center justify-between pr-2">
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-100 text-sm">{usuario.nombre}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{usuario.employeeid}</div>
                  </div>
                  {modoSeleccion && (
                    <button 
                      onClick={() => onSeleccionarFila(usuario.employeeid)} 
                      className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-all duration-150 border border-transparent hover:border-gray-200 dark:hover:border-gray-600" 
                      title="Seleccionar fila completa"
                    >
                      <span className="text-lg">→</span>
                    </button>
                  )}
                </div>
              </td>
              {fechas.map(fecha => renderCelda(usuario, fecha))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TablaHorariosBody;