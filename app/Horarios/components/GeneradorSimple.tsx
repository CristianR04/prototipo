'use client';

import { useState } from 'react';

interface ConfigGeneracion {
  excluirFinesSemana: boolean;
  horariosBase: string[];
  aleatorizarHorarios: boolean;
  patronSemanal: boolean;
}

interface GeneradorInteligenteProps {
  onGenerar: (meses: number, configuracion?: ConfigGeneracion) => Promise<void>;
  isLoading: boolean;
}

export default function GeneradorInteligente({ onGenerar, isLoading }: GeneradorInteligenteProps) {
  const [meses, setMeses] = useState(2);
  const [configuracion, setConfiguracion] = useState<ConfigGeneracion>({
    excluirFinesSemana: true,
    horariosBase: ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30'],
    aleatorizarHorarios: true,
    patronSemanal: true,
  });

  const [horarioNuevo, setHorarioNuevo] = useState('08:00');

  const handleGenerar = async () => {
    await onGenerar(meses, configuracion);
  };

  const agregarHorario = () => {
    if (horarioNuevo && !configuracion.horariosBase.includes(horarioNuevo)) {
      setConfiguracion({
        ...configuracion,
        horariosBase: [...configuracion.horariosBase, horarioNuevo].sort()
      });
      setHorarioNuevo('');
    }
  };

  const eliminarHorario = (horario: string) => {
    setConfiguracion({
      ...configuracion,
      horariosBase: configuracion.horariosBase.filter(h => h !== horario)
    });
  };

  const calcularFechaFin = () => {
    const hoy = new Date();
    const fechaFin = new Date(hoy);
    fechaFin.setMonth(fechaFin.getMonth() + meses);
    return fechaFin.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-blue-100">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <span className="mr-3 text-2xl">🤖</span>
        Generador Inteligente de Horarios
      </h3>
      
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-4">
          Genera horarios automáticamente con lógica inteligente. Los horarios existentes serán reemplazados.
        </p>
        
        {/* Período */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Período de generación
          </label>
          <div className="flex items-center space-x-4">
            <select
              value={meses}
              onChange={(e) => setMeses(Number(e.target.value))}
              className="w-40 p-2 border border-gray-300 rounded-lg bg-white"
              disabled={isLoading}
            >
              <option value={1}>1 mes</option>
              <option value={2}>2 meses</option>
              <option value={3}>3 meses</option>
              <option value={6}>6 meses</option>
            </select>
            
            <div className="text-sm text-gray-600">
              <span className="font-medium">Hasta:</span> {calcularFechaFin()}
            </div>
          </div>
        </div>

        {/* Configuración de horarios */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <label className="block text-sm font-semibold text-blue-700 mb-2">
            Horarios disponibles para asignar
          </label>
          
          <div className="mb-3">
            <div className="flex items-center space-x-2 mb-2">
              <input
                type="time"
                value={horarioNuevo}
                onChange={(e) => setHorarioNuevo(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg"
                disabled={isLoading}
              />
              <button
                onClick={agregarHorario}
                disabled={isLoading || !horarioNuevo}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                + Agregar
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Agrega todos los horarios que pueden ser asignados aleatoriamente
            </p>
          </div>
          
          {/* Lista de horarios */}
          <div className="flex flex-wrap gap-2 mb-4">
            {configuracion.horariosBase.map(horario => (
              <div key={horario} className="flex items-center bg-white px-3 py-1.5 rounded-lg border border-blue-200">
                <span className="font-medium text-blue-700">{horario}</span>
                <button
                  onClick={() => eliminarHorario(horario)}
                  disabled={isLoading}
                  className="ml-2 text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          
          {configuracion.horariosBase.length === 0 && (
            <div className="text-amber-600 text-sm bg-amber-50 p-2 rounded">
              ⚠️ Agrega al menos un horario para generar
            </div>
          )}
        </div>

        {/* Opciones avanzadas */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Opciones de generación
          </label>
          
          <div className="flex items-center justify-between">
            <div>
              <span className="text-gray-700">Excluir fines de semana</span>
              <p className="text-xs text-gray-500">No generar horarios para sábados y domingos</p>
            </div>
            <input
              type="checkbox"
              checked={configuracion.excluirFinesSemana}
              onChange={(e) => setConfiguracion({
                ...configuracion,
                excluirFinesSemana: e.target.checked
              })}
              className="w-5 h-5 text-blue-600 rounded"
              disabled={isLoading}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <span className="text-gray-700">Aleatorizar horarios</span>
              <p className="text-xs text-gray-500">Asignar horarios diferentes aleatoriamente</p>
            </div>
            <input
              type="checkbox"
              checked={configuracion.aleatorizarHorarios}
              onChange={(e) => setConfiguracion({
                ...configuracion,
                aleatorizarHorarios: e.target.checked
              })}
              className="w-5 h-5 text-blue-600 rounded"
              disabled={isLoading}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <span className="text-gray-700">Patrón semanal</span>
              <p className="text-xs text-gray-500">Cambiar horarios cada semana (misma semana = mismo horario)</p>
            </div>
            <input
              type="checkbox"
              checked={configuracion.patronSemanal}
              onChange={(e) => setConfiguracion({
                ...configuracion,
                patronSemanal: e.target.checked
              })}
              disabled={!configuracion.aleatorizarHorarios || isLoading}
              className="w-5 h-5 text-blue-600 rounded disabled:opacity-50"
            />
          </div>
        </div>
      </div>
      
      {/* Botón de generación */}
      <button
        onClick={handleGenerar}
        disabled={isLoading || configuracion.horariosBase.length === 0}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
          isLoading
            ? 'bg-gray-300 cursor-not-allowed'
            : configuracion.horariosBase.length === 0
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white shadow-md'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
            Generando horarios inteligentes...
          </div>
        ) : (
          `Generar ${meses} mes${meses > 1 ? 'es' : ''} de horarios inteligentes`
        )}
      </button>
      
      {/* Información adicional */}
      <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
        <p className="font-medium text-blue-700 mb-2">🎯 ¿Cómo funciona?</p>
        <ul className="text-sm text-blue-600 space-y-1">
          <li>• Asigna horarios aleatorios de la lista configurada</li>
          <li>• Respeta la exclusión de fines de semana</li>
          <li>• Mantiene consistencia semanal si está habilitado</li>
          <li>• Calcula automáticamente breaks y hora de salida</li>
          <li>• Sobrescribe horarios existentes en el rango</li>
        </ul>
      </div>
    </div>
  );
}