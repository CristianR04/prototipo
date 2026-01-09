'use client';

import { useState } from 'react';

interface GeneradorSimpleProps {
  onGenerar: (meses: number) => Promise<void>;
  isLoading: boolean;
}

export default function GeneradorSimple({ onGenerar, isLoading }: GeneradorSimpleProps) {
  const [meses, setMeses] = useState(2);

  const handleGenerar = async () => {
    await onGenerar(meses);
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
    <div className="bg-white rounded-lg shadow p-4 mb-6 border border-blue-200">
      <h3 className="text-lg font-semibold text-blue-700 mb-3 flex items-center">
        <span className="mr-2">🚀</span>
        Generación Automática de Horarios
      </h3>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-3">
          Genera horarios automáticamente para los próximos meses. Los horarios existentes en ese rango serán reemplazados.
        </p>
        
        <div className="flex items-center space-x-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meses a generar
            </label>
            <select
              value={meses}
              onChange={(e) => setMeses(Number(e.target.value))}
              className="w-32 p-2 border border-gray-300 rounded-lg"
              disabled={isLoading}
            >
              <option value={1}>1 mes</option>
              <option value={2}>2 meses</option>
              <option value={3}>3 meses</option>
            </select>
          </div>
          
          <div className="text-sm text-gray-500">
            <p>Desde hoy hasta:</p>
            <p className="font-semibold">{calcularFechaFin()}</p>
          </div>
        </div>
      </div>
      
      <button
        onClick={handleGenerar}
        disabled={isLoading}
        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
          isLoading
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90 text-white'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Generando...
          </div>
        ) : (
          `Generar horarios para ${meses} mes${meses > 1 ? 'es' : ''}`
        )}
      </button>
      
      <div className="mt-3 p-3 bg-blue-50 rounded text-sm text-blue-700">
        <p className="font-medium mb-1">Características:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Asigna horarios automáticamente</li>
          <li>Respetará días de licencia</li>
          <li>Calculará breaks automáticamente</li>
          <li>Mantendrá consistencia de horarios</li>
        </ul>
      </div>
    </div>
  );
}