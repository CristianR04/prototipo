// app/Horarios/components/ConfiguracionCompacta.tsx
"use client";

import React, { useState, useEffect } from 'react';

interface ConfigItem {
  clave: string;
  valor: any;
  descripcion: string;
}

interface CasoEspecial {
  id?: number;
  nombre_empleado: string;
  employeeid?: string;
  pais: 'chile' | 'colombia';
  reglas: Array<{
    tipo: string;
    [key: string]: any;
  }>;
  activo: boolean;
}

interface ConfiguracionCompleta {
  reglas: Record<string, { valor: any; descripcion: string }>;
  horarios: Record<string, { valor: any; descripcion: string }>;
  casos: CasoEspecial[];
  fechas: Record<string, any>;
}

const tiposRegla = [
  { value: 'horario_maximo', label: 'Horario Máximo' },
  { value: 'solo_lunes_viernes', label: 'Solo Lunes-Viernes' },
  { value: 'solo_aperturas', label: 'Solo Aperturas' },
  { value: 'libre_fines_semana', label: 'Libre Fines de Semana' },
  { value: 'rango_horario', label: 'Rango Horario Específico' },
  { value: 'solo_turnos_tempranos', label: 'Solo Turnos Tempranos' },
  { value: 'solo_turnos_tardios', label: 'Solo Turnos Tardíos' }
];

export default function ConfiguracionCompacta({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<ConfiguracionCompleta>({
    reglas: {},
    horarios: {},
    casos: [],
    fechas: {}
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reglas' | 'horarios' | 'casos' | 'fechas' | 'festivos'>('reglas');
  const [editando, setEditando] = useState<{
    tipo: 'regla' | 'horario' | 'caso' | 'fecha';
    data: any;
  } | null>(null);

  // Cargar configuración desde la API
  const cargarConfiguracion = async () => {
    try {
      setLoading(true);
      const response = await fetch('/Horarios/api/configuracion?tipo=todos');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success) {
        // Asegurarnos de que todos los campos tengan valores por defecto
        setConfig({
          reglas: data.configuracion?.reglas || {},
          horarios: data.configuracion?.horarios || {},
          casos: data.configuracion?.casos || [],
          fechas: data.configuracion?.fechas || {}
        });
      } else {
        console.error('Error en la respuesta:', data.message);
        setConfig({
          reglas: {},
          horarios: {},
          casos: [],
          fechas: {}
        });
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
      setConfig({
        reglas: {},
        horarios: {},
        casos: [],
        fechas: {}
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  // Guardar configuración
  const guardarConfig = async (tipo: string, data: any) => {
    try {
      const response = await fetch('/Horarios/api/configuracion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, data })
      });

      const result = await response.json();

      if (result.success) {
        alert('Configuración guardada exitosamente');
        await cargarConfiguracion();
        setEditando(null);
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error guardando configuración');
    }
  };

  // Eliminar elemento
  const eliminarElemento = async (tipo: string, id?: string) => {
    if (!confirm('¿Está seguro de eliminar este elemento?')) return;

    try {
      const url = `/Horarios/api/configuracion?tipo=${tipo}${tipo === 'caso' ? `&id=${id}` : tipo === 'config' ? `&clave=${id}` : ''
        }`;

      const response = await fetch(url, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        alert('Elemento eliminado');
        await cargarConfiguracion();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error eliminando elemento');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Configuración del Sistema</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configura reglas, horarios y casos especiales
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {(['reglas', 'horarios', 'casos', 'fechas', 'festivos'] as const).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-3 font-medium capitalize ${activeTab === tab
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'reglas' && '📋 Reglas'}
            {tab === 'horarios' && '🕐 Horarios'}
            {tab === 'casos' && '👤 Casos Especiales'}
            {tab === 'fechas' && '📅 Fechas Especiales'}
            {tab === 'festivos' && '📅 Cargar Festivos'}
          </button>
        ))}
      </div>

      {/* Contenido de Tabs */}
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        {/* Tab Reglas */}
        {activeTab === 'reglas' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Reglas Generales</h3>
              <button
                onClick={() => setEditando({ tipo: 'regla', data: { clave: '', valor: '', descripcion: '' } })}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                + Nueva Regla
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(config.reglas || {}).map(([clave, item]) => (
                <div key={clave} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">
                        {clave.replace('regla_', '').replace(/_/g, ' ')}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.descripcion}</p>
                      <div className="mt-2">
                        <span className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {JSON.stringify(item.valor)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => setEditando({ tipo: 'regla', data: { clave, valor: item.valor, descripcion: item.descripcion } })}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarElemento('config', clave)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Horarios */}
        {activeTab === 'horarios' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Configuración de Horarios</h3>
              <button
                onClick={() => setEditando({ tipo: 'horario', data: { clave: '', valor: [], descripcion: '' } })}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                + Nuevo Horario
              </button>
            </div>

            <div className="space-y-4">
              {Object.entries(config.horarios || {}).map(([clave, item]) => (
                <div key={clave} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-gray-200 text-lg">
                        {clave.replace('horario_', '').replace(/_/g, ' ').toUpperCase()}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{item.descripcion}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditando({ tipo: 'horario', data: { clave, valor: item.valor, descripcion: item.descripcion } })}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarElemento('config', clave)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700">
                          <th className="px-3 py-2 text-left">Entrada</th>
                          <th className="px-3 py-2 text-left">Salida</th>
                          <th className="px-3 py-2 text-left">Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(item.valor) && item.valor.map((turno: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="px-3 py-2 font-medium">{turno.entrada}</td>
                            <td className="px-3 py-2">{turno.salida}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded text-xs ${turno.tipo === 'apertura' ? 'bg-green-100 text-green-800' :
                                turno.tipo === 'cierre' ? 'bg-red-100 text-red-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                {turno.tipo}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Casos Especiales */}
        {activeTab === 'casos' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Casos Especiales</h3>
              <button
                onClick={() => setEditando({
                  tipo: 'caso',
                  data: {
                    nombre_empleado: '',
                    pais: 'chile',
                    reglas: [],
                    activo: true
                  }
                })}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                + Nuevo Caso
              </button>
            </div>

            <div className="space-y-3">
              {(config.casos || []).map((caso) => (
                <div key={caso.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 text-lg">
                          {caso.nombre_empleado}
                        </h4>
                        <span className={`px-2 py-1 rounded text-xs ${caso.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {caso.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                          {caso.pais}
                        </span>
                        {caso.employeeid && (
                          <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                            ID: {caso.employeeid}
                          </span>
                        )}
                      </div>

                      <div className="mt-3">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reglas:</h5>
                        <div className="flex flex-wrap gap-2">
                          {caso.reglas.map((regla, idx) => (
                            <div key={idx} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                              <div className="font-medium text-sm">{regla.tipo.replace(/_/g, ' ')}</div>
                              {regla.entradaMax && (
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  Máx: {regla.entradaMax}
                                </div>
                              )}
                              {regla.entradaMin && (
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  Mín: {regla.entradaMin}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => setEditando({ tipo: 'caso', data: caso })}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarElemento('caso', caso.id?.toString())}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Fechas Especiales */}
        {activeTab === 'fechas' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Fechas Especiales</h3>
              <button
                onClick={() => setEditando({ tipo: 'fecha', data: { clave: '', valor: {}, descripcion: '' } })}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                + Nueva Fecha
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(config.fechas || {}).map(([clave, valor]) => (
                <div key={clave} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">
                        {clave.replace('fecha_', '').replace(/_/g, '-')}
                      </h4>
                      <div className="mt-2">
                        <pre className="text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                          {JSON.stringify(valor, null, 2)}
                        </pre>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => setEditando({ tipo: 'fecha', data: { clave, valor, descripcion: '' } })}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarElemento('config', clave)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Festivos */}
        {activeTab === 'festivos' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Cargar Festivos Chile y Colombia</h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Año</label>
                  <select
                    id="anio-festivos"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
                    defaultValue={new Date().getFullYear()}
                  >
                    {Array.from({ length: 10 }, (_, i) => 2024 + i).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const anio = (document.getElementById('anio-festivos') as HTMLSelectElement).value;

                      if (!confirm(`¿Cargar festivos para Chile y Colombia en ${anio}?`)) return;

                      try {
                        const button = event?.currentTarget as HTMLButtonElement;
                        const originalText = button.textContent;
                        button.textContent = 'Cargando...';
                        button.disabled = true;

                        const response = await fetch('/Horarios/api/festivos', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ anio: parseInt(anio) })
                        });

                        const result = await response.json();

                        button.textContent = originalText;
                        button.disabled = false;

                        if (result.success) {
                          const chileResult = result.resultados?.find((r: any) => r.pais === 'Chile');
                          const colombiaResult = result.resultados?.find((r: any) => r.pais === 'Colombia');

                          const chileCount = chileResult?.guardados || 0;
                          const colombiaCount = colombiaResult?.guardados || 0;
                          const total = result.total || 0;

                          alert(`✅ Festivos cargados para ${anio}\n\n🇨🇱 Chile: ${chileCount} festivos\n🇨🇴 Colombia: ${colombiaCount} festivos\n\nTotal: ${total} festivos`);

                          await cargarConfiguracion();
                          setActiveTab('fechas');
                        } else {
                          alert(`❌ Error: ${result.message}`);
                        }

                      } catch (error) {
                        alert('Error al cargar festivos');
                        console.error(error);
                      }
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Cargar Festivos Automáticamente
                  </button>

                  <button
                    onClick={async () => {
                      if (!confirm('¿Está seguro de eliminar todos los festivos cargados? Esta acción no se puede deshacer.')) return;

                      try {
                        const response = await fetch('/Horarios/api/festivos', {
                          method: 'DELETE'
                        });

                        const result = await response.json();

                        if (result.success) {
                          alert(`✅ ${result.message}\n\nEliminados: ${result.eliminados} festivos`);
                          await cargarConfiguracion();
                        } else {
                          alert(`❌ Error: ${result.message}`);
                        }
                      } catch (error) {
                        alert('Error al eliminar festivos');
                        console.error(error);
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Eliminar Todos los Festivos
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edición */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                {editando.tipo === 'regla' && 'Editar Regla'}
                {editando.tipo === 'horario' && 'Editar Horario'}
                {editando.tipo === 'caso' && (editando.data.id ? 'Editar Caso' : 'Nuevo Caso')}
                {editando.tipo === 'fecha' && 'Editar Fecha'}
              </h3>
              <button
                onClick={() => setEditando(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              {editando.tipo === 'regla' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Clave</label>
                    <input
                      type="text"
                      value={editando.data.clave}
                      onChange={(e) => setEditando({ ...editando, data: { ...editando.data, clave: e.target.value } })}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
                      placeholder="Ej: regla_dias_trabajo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Valor</label>
                    <textarea
                      value={typeof editando.data.valor === 'object' ? JSON.stringify(editando.data.valor, null, 2) : editando.data.valor}
                      onChange={(e) => {
                        try {
                          const valor = JSON.parse(e.target.value);
                          setEditando({ ...editando, data: { ...editando.data, valor } });
                        } catch {
                          setEditando({ ...editando, data: { ...editando.data, valor: e.target.value } });
                        }
                      }}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded font-mono text-sm"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Descripción</label>
                    <input
                      type="text"
                      value={editando.data.descripcion || ''}
                      onChange={(e) => setEditando({ ...editando, data: { ...editando.data, descripcion: e.target.value } })}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
                      placeholder="Descripción de la regla..."
                    />
                  </div>
                </div>
              )}

              {editando.tipo === 'horario' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Clave (Identificador)</label>
                    <input
                      type="text"
                      value={editando.data.clave}
                      onChange={(e) => setEditando({ ...editando, data: { ...editando.data, clave: e.target.value } })}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
                      placeholder="Ej: horario_chile_lv"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Descripción</label>
                    <input
                      type="text"
                      value={editando.data.descripcion || ''}
                      onChange={(e) => setEditando({ ...editando, data: { ...editando.data, descripcion: e.target.value } })}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
                      placeholder="Ej: Horarios Chile Lunes a Viernes"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium">Turnos (JSON)</label>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setEditando({
                            ...editando,
                            data: {
                              ...editando.data,
                              valor: [
                                { entrada: "08:00", salida: "18:00", tipo: "apertura" },
                                { entrada: "08:30", salida: "18:30", tipo: "normal" },
                                { entrada: "09:00", salida: "19:00", tipo: "normal" }
                              ]
                            }
                          });
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Ejemplo
                      </a>
                    </div>
                    <textarea
                      value={JSON.stringify(editando.data.valor || [], null, 2)}
                      onChange={(e) => {
                        try {
                          const valor = JSON.parse(e.target.value);
                          setEditando({ ...editando, data: { ...editando.data, valor } });
                        } catch {
                          // Mantener el valor actual si hay error
                        }
                      }}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded font-mono text-sm"
                      rows={10}
                      placeholder='[{"entrada": "08:00", "salida": "18:00", "tipo": "apertura"}, ...]'
                    />
                  </div>
                </div>
              )}

              {editando.tipo === 'caso' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Nombre Empleado *</label>
                      <input
                        type="text"
                        value={editando.data.nombre_empleado}
                        onChange={(e) => setEditando({ ...editando, data: { ...editando.data, nombre_empleado: e.target.value } })}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
                        placeholder="Nombre completo"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Employee ID</label>
                      <input
                        type="text"
                        value={editando.data.employeeid || ''}
                        onChange={(e) => setEditando({ ...editando, data: { ...editando.data, employeeid: e.target.value } })}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">País</label>
                      <select
                        value={editando.data.pais}
                        onChange={(e) => setEditando({ ...editando, data: { ...editando.data, pais: e.target.value } })}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
                      >
                        <option value="chile">Chile</option>
                        <option value="colombia">Colombia</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Estado</label>
                      <div className="mt-2">
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={editando.data.activo}
                            onChange={(e) => setEditando({ ...editando, data: { ...editando.data, activo: e.target.checked } })}
                            className="rounded border-gray-300"
                          />
                          <span className="ml-2 text-sm">Activo</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium">Reglas Especiales</label>
                      <button
                        type="button"
                        onClick={() => setEditando({
                          ...editando,
                          data: {
                            ...editando.data,
                            reglas: [...editando.data.reglas, { tipo: 'horario_maximo', entradaMax: '18:00' }]
                          }
                        })}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        + Agregar Regla
                      </button>
                    </div>

                    <div className="space-y-2">
                      {editando.data.reglas.map((regla: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <select
                            value={regla.tipo}
                            onChange={(e) => {
                              const nuevasReglas = [...editando.data.reglas];
                              nuevasReglas[idx] = { ...regla, tipo: e.target.value };
                              setEditando({ ...editando, data: { ...editando.data, reglas: nuevasReglas } });
                            }}
                            className="flex-1 p-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                          >
                            {tiposRegla.map(tipo => (
                              <option key={tipo.value} value={tipo.value}>
                                {tipo.label}
                              </option>
                            ))}
                          </select>

                          <input
                            type="text"
                            value={regla.entradaMax || ''}
                            onChange={(e) => {
                              const nuevasReglas = [...editando.data.reglas];
                              nuevasReglas[idx] = { ...regla, entradaMax: e.target.value };
                              setEditando({ ...editando, data: { ...editando.data, reglas: nuevasReglas } });
                            }}
                            className="w-24 p-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                            placeholder="Ej: 18:00"
                          />

                          <input
                            type="text"
                            value={regla.entradaMin || ''}
                            onChange={(e) => {
                              const nuevasReglas = [...editando.data.reglas];
                              nuevasReglas[idx] = { ...regla, entradaMin: e.target.value };
                              setEditando({ ...editando, data: { ...editando.data, reglas: nuevasReglas } });
                            }}
                            className="w-24 p-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                            placeholder="Ej: 08:00"
                          />

                          <button
                            onClick={() => {
                              const nuevasReglas = editando.data.reglas.filter((_: any, i: number) => i !== idx);
                              setEditando({ ...editando, data: { ...editando.data, reglas: nuevasReglas } });
                            }}
                            className="text-red-600 hover:text-red-800"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {editando.tipo === 'fecha' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Clave (YYYY_MM_DD)</label>
                    <input
                      type="text"
                      value={editando.data.clave}
                      onChange={(e) => setEditando({ ...editando, data: { ...editando.data, clave: e.target.value } })}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
                      placeholder="Ej: fecha_2026_01_01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Configuración (JSON)</label>
                    <textarea
                      value={JSON.stringify(editando.data.valor || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const valor = JSON.parse(e.target.value);
                          setEditando({ ...editando, data: { ...editando.data, valor } });
                        } catch {
                          // Mantener el valor actual si hay error
                        }
                      }}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded font-mono text-sm"
                      rows={6}
                      placeholder='{"tipo": "feriado", "tratarComo": "domingo"}'
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setEditando(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={() => guardarConfig(editando.tipo, editando.data)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}