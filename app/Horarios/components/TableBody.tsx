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
  festivos: Array<{
    fecha: string;
    nombre: string;
    pais: 'chile' | 'colombia' | 'ambos';
    nacional?: boolean;
    observaciones?: string;
  }>;
  
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
  festivos = [], // Asegurar que tenga un valor por defecto
  
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

  // Función para determinar si una fecha es festivo y para qué país
  const esFestivo = (fechaStr: string) => {
    return festivos.find(f => f.fecha === fechaStr);
  };

  // Obtener estilo de fondo según tipo de día
  const getBackgroundColor = (fecha: FechaDia) => {
    const festivo = esFestivo(fecha.fullDate);
    
    if (festivo) {
      if (festivo.pais === 'ambos') {
        return 'bg-purple-50/70 dark:bg-purple-900/20';
      } else if (festivo.pais === 'chile') {
        return 'bg-rose-50/70 dark:bg-rose-900/20';
      } else if (festivo.pais === 'colombia') {
        return 'bg-yellow-50/70 dark:bg-yellow-900/20';
      }
    }
    
    if (fecha.esFinDeSemana) {
      return 'bg-blue-50/50 dark:bg-blue-900/15';
    }
    
    return 'bg-white dark:bg-gray-800';
  };

  // Obtener color de borde según tipo de día
  const getBorderColor = (fecha: FechaDia) => {
    const festivo = esFestivo(fecha.fullDate);
    
    if (festivo) {
      if (festivo.pais === 'ambos') {
        return 'border-purple-200 dark:border-purple-700/60';
      } else if (festivo.pais === 'chile') {
        return 'border-rose-200 dark:border-rose-700/60';
      } else if (festivo.pais === 'colombia') {
        return 'border-yellow-200 dark:border-yellow-700/60';
      }
    }
    
    if (fecha.esFinDeSemana) {
      return 'border-blue-200 dark:border-blue-700/50';
    }
    
    return 'border-gray-200 dark:border-gray-600';
  };

  // Obtener color de texto para el día
  const getDayTextColor = (fecha: FechaDia) => {
    const festivo = esFestivo(fecha.fullDate);
    
    if (festivo) {
      if (festivo.pais === 'ambos') {
        return 'text-purple-700 dark:text-purple-300 font-bold';
      } else if (festivo.pais === 'chile') {
        return 'text-rose-700 dark:text-rose-300 font-bold';
      } else if (festivo.pais === 'colombia') {
        return 'text-yellow-700 dark:text-yellow-300 font-bold';
      }
    }
    
    if (fecha.esFinDeSemana) {
      return 'text-red-600 dark:text-red-400';
    }
    
    return 'text-gray-800 dark:text-gray-100';
  };

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
    const festivo = esFestivo(fecha.fullDate);
    
    const getEstiloSeleccion = () => {
      if (!seleccionada) return '';
      if (modoSeleccion === "rango") return 'ring-1 ring-amber-500/30 bg-amber-500/10';
      if (modoSeleccion === "disperso") return 'ring-1 ring-purple-500/30 bg-purple-500/10';
      return '';
    };

    const getSelectStyles = (isChanged: boolean) => {
      const baseStyles = "w-full border rounded px-2 py-1.5 text-xs transition-all cursor-pointer z-10";
      const modeStyles = modoSeleccion ? 'pointer-events-none opacity-70' : 'hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700';
      
      // Si es festivo
      if (festivo) {
        const festivoStyles = festivo.pais === 'ambos' 
          ? 'border-purple-300 dark:border-purple-600 bg-purple-50/50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
          : festivo.pais === 'chile'
          ? 'border-rose-300 dark:border-rose-600 bg-rose-50/50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300'
          : 'border-yellow-300 dark:border-yellow-600 bg-yellow-50/50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300';
        
        if (isChanged) {
          return `${baseStyles} border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 ${modeStyles}`;
        }
        return `${baseStyles} ${festivoStyles} ${modeStyles}`;
      }
      
      // Si es fin de semana
      if (fecha.esFinDeSemana) {
        if (isChanged) {
          return `${baseStyles} border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 ${modeStyles}`;
        }
        return `${baseStyles} border-blue-200 dark:border-blue-700/50 bg-blue-50/30 dark:bg-blue-900/10 text-gray-800 dark:text-gray-200 ${modeStyles}`;
      }
      
      // Día normal
      if (isChanged) {
        return `${baseStyles} border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 ${modeStyles}`;
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
        className={`p-2 ${getBackgroundColor(fecha)} transition-colors duration-150 border-l ${getBorderColor(fecha)}`}
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
          
          {/* Indicador visual de festivo */}
          {festivo && (
            <div className="absolute -top-1 -right-1">
              <div className={`
                w-2 h-2 rounded-full 
                ${festivo.pais === 'ambos' ? 'bg-purple-500 ring-1 ring-purple-300' : ''}
                ${festivo.pais === 'chile' ? 'bg-rose-500 ring-1 ring-rose-300' : ''}
                ${festivo.pais === 'colombia' ? 'bg-yellow-500 ring-1 ring-yellow-300' : ''}
              `}></div>
            </div>
          )}
          
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

  // Función para renderizar el encabezado de fecha con información de festivo
  const renderHeaderFecha = (fecha: FechaDia) => {
    const festivo = esFestivo(fecha.fullDate);
    const esHoy = fecha.esHoy;
    
    return (
      <th key={fecha.id} className="p-3 text-center min-w-[90px] border-l border-gray-200 dark:border-gray-700 relative">
        <div className="flex flex-col items-center relative group">
          {/* Nombre del día */}
          <div className={`font-semibold ${getDayTextColor(fecha)}`}>
            {DIAS_SEMANA[new Date(fecha.fullDate).getDay()]}
          </div>
          
          {/* Número del día */}
          <div className={`
            text-xs mt-1 flex items-center justify-center mx-auto 
            ${esHoy ? 'bg-violet-600 text-white rounded-full w-6 h-6' : ''}
            ${festivo ? '' : fecha.esFinDeSemana ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}
          `}>
            {fecha.diaNumero}
          </div>
          
          {/* Indicador de festivo */}
          {festivo && (
            <div className="mt-1 flex flex-col items-center">
              <div className={`
                text-[9px] font-medium px-1 py-0.5 rounded 
                ${festivo.pais === 'ambos' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : ''}
                ${festivo.pais === 'chile' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' : ''}
                ${festivo.pais === 'colombia' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' : ''}
              `}>
                {festivo.pais === 'ambos' ? 'Ambos' : festivo.pais === 'chile' ? 'CL' : 'CO'}
              </div>
            </div>
          )}
          
          {/* Botón para seleccionar columna */}
          {modoSeleccion && (
            <button 
              onClick={() => onToggleSeleccionColumna(fecha.fullDate)} 
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" 
              title="Alternar selección de columna"
            >
              <div className={`w-6 h-6 rounded flex items-center justify-center ${
                usuarios.every(usuario => estaSeleccionada(usuario.employeeid, fecha.fullDate))
                  ? "bg-cyan-600/20 ring-1 ring-cyan-500/30"
                  : "bg-white/90 dark:bg-gray-700/90 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}>
                <span className="text-xs text-gray-700 dark:text-gray-300">↓</span>
              </div>
            </button>
          )}
          
          {/* Tooltip con nombre completo del festivo */}
          {festivo && (
            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
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
              {festivo.observaciones && (
                <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 italic">
                  {festivo.observaciones}
                </div>
              )}
            </div>
          )}
        </div>
      </th>
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
            {fechas.map(renderHeaderFecha)}
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
      
      {/* Leyenda de colores */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/50"></div>
            <span>Fin de semana</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/50"></div>
            <span>Festivo ambos países</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/50"></div>
            <span>Festivo solo Chile</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/50"></div>
            <span>Festivo solo Colombia</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-violet-600"></div>
            <span>Hoy</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TablaHorariosBody;