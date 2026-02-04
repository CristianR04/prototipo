// app/Horarios/components/ConfiguracionCompacta.tsx - VERSIÓN ADAPTADA
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
  reglas: any;
  casos: CasoEspecial[];
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
    casos: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reglas' | 'horarios' | 'distribucion' | 'casos'>('reglas');
  const [editando, setEditando] = useState<{
    tipo: 'regla' | 'horario' | 'caso';
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
        setConfig({
          reglas: data.reglas || {},
          casos: data.casos || []
        });
      } else {
        console.error('Error en la respuesta:', data.message);
        setConfig({
          reglas: {},
          casos: []
        });
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
      setConfig({
        reglas: {},
        casos: []
      });
    } finally {
      setLoading(false);
    }
  };

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
        alert('✅ Configuración guardada exitosamente');
        await cargarConfiguracion();
        setEditando(null);
      } else {
        alert('❌ Error: ' + result.message);
      }
    } catch (error) {
      console.error('Error guardando configuración:', error);
      alert('Error guardando configuración');
    }
  };

  // Eliminar elemento
  const eliminarElemento = async (tipo: string, clave?: string, id?: string) => {
    if (!confirm('¿Está seguro de eliminar este elemento?')) return;

    try {
      const url = `/Horarios/api/configuracion?tipo=${tipo}${
        tipo === 'caso' ? `&id=${id}` : 
        tipo === 'config' ? `&clave=${clave}` : ''
      }`;

      const response = await fetch(url, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        alert('✅ Elemento eliminado');
        await cargarConfiguracion();
      } else {
        alert('❌ Error: ' + result.message);
      }
    } catch (error) {
      console.error('Error eliminando elemento:', error);
      alert('Error eliminando elemento');
    }
  };

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Cargando configuración...</p>
      </div>
    );
  }

  // Extraer reglas para mostrar
  const reglasParaMostrar = {
    diasTrabajo: config.reglas.diasTrabajo,
    diasLibres: config.reglas.diasLibres,
    porcentajeApertura: config.reglas.porcentajeApertura,
    porcentajeCierre: config.reglas.porcentajeCierre,
    horasMaxSemanales: config.reglas.horasMaxSemanales,
    horasTrabajoDiario: config.reglas.horasTrabajoDiario,
    horasPresenciaDiaria: config.reglas.horasPresenciaDiaria
  };

  // Organizar horarios para mostrar
  const horariosParaMostrar = {
    'Horarios Chile LV': config.reglas.horariosChileLV || [],
    'Horarios Chile FS': config.reglas.horariosChileFS || [],
    'Horarios Colombia LV': config.reglas.horariosColombiaLV || [],
    'Horarios Colombia FS': config.reglas.horariosColombiaFS || []
  };

  // Configuración de distribución
  const distribucionParaMostrar = config.reglas.configDistribucion || {};

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl">
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
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {(['reglas', 'horarios', 'distribucion', 'casos'] as const).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-3 font-medium capitalize whitespace-nowrap ${activeTab === tab
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'reglas' && '📋 Reglas'}
            {tab === 'horarios' && '🕐 Horarios'}
            {tab === 'distribucion' && '⚙️ Distribución'}
            {tab === 'casos' && '👤 Casos Especiales'}
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
                onClick={() => setEditando({ 
                  tipo: 'regla', 
                  data: { 
                    clave: 'regla_nueva', 
                    valor: '', 
                    descripcion: '' 
                  } 
                })}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                + Nueva Regla
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(reglasParaMostrar).map(([clave, valor]) => (
                <div key={clave} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">
                        {clave.replace(/([A-Z])/g, ' $1').toUpperCase()}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {clave.includes('porcentaje') ? 'Porcentaje de' : 'Cantidad de'} {clave}
                      </p>
                      <div className="mt-2">
                        <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                          {clave.includes('porcentaje') ? `${(valor * 100).toFixed(0)}%` : valor}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => setEditando({ 
                          tipo: 'regla', 
                          data: { 
                            clave: `regla_${clave.replace(/([A-Z])/g, '_$1').toLowerCase()}`,
                            valor,
                            descripcion: clave.replace(/([A-Z])/g, ' $1')
                          } 
                        })}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Editar
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
                onClick={() => setEditando({ 
                  tipo: 'horario', 
                  data: { 
                    clave: 'horario_nuevo', 
                    valor: [], 
                    descripcion: '' 
                  } 
                })}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                + Nuevo Horario
              </button>
            </div>

            <div className="space-y-4">
              {Object.entries(horariosParaMostrar).map(([nombre, horarios]) => (
                <div key={nombre} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-gray-200 text-lg">
                        {nombre}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {Array.isArray(horarios) ? `${horarios.length} turnos` : 'Sin turnos'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditando({ 
                          tipo: 'horario', 
                          data: { 
                            clave: nombre.toLowerCase().replace(/ /g, '_'),
                            valor: horarios,
                            descripcion: nombre
                          } 
                        })}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        Editar
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700">
                          <th className="px-3 py-2 text-left">Tipo</th>
                          <th className="px-3 py-2 text-left">Entrada</th>
                          <th className="px-3 py-2 text-left">Salida</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(horarios) && horarios.map((turno: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded text-xs ${turno.tipo === 'apertura' ? 'bg-green-100 text-green-800' :
                                turno.tipo === 'cierre' ? 'bg-red-100 text-red-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                {turno.tipo || 'normal'}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-medium">{turno.entrada}</td>
                            <td className="px-3 py-2">{turno.salida}</td>
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

        {/* Tab Distribución */}
        {activeTab === 'distribucion' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Distribución Calculada</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Calculada automáticamente desde los horarios configurados
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Chile */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🇨🇱</span>
                  <h4 className="text-lg font-semibold">Chile</h4>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Apertura:</span>
                    <div className="font-medium">
                      {distribucionParaMostrar.apertura_chile_min} - {distribucionParaMostrar.apertura_chile_max}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Cierre:</span>
                    <div className="font-medium">{distribucionParaMostrar.cierre_chile}</div>
                  </div>
                </div>
              </div>

              {/* Colombia */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🇨🇴</span>
                  <h4 className="text-lg font-semibold">Colombia</h4>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Apertura:</span>
                    <div className="font-medium">
                      {distribucionParaMostrar.apertura_colombia_min} - {distribucionParaMostrar.apertura_colombia_max}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Cierre:</span>
                    <div className="font-medium">{distribucionParaMostrar.cierre_colombia}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                ℹ️ La distribución se calcula automáticamente basándose en los horarios configurados.
                Para cambiarla, modifica los horarios en la pestaña "Horarios".
              </p>
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
                <div key={caso.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750">
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
                          {caso.pais === 'chile' ? '🇨🇱 Chile' : '🇨🇴 Colombia'}
                        </span>
                        {caso.employeeid && (
                          <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                            ID: {caso.employeeid}
                          </span>
                        )}
                      </div>

                      <div className="mt-3">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reglas Especiales:</h5>
                        <div className="flex flex-wrap gap-2">
                          {caso.reglas && caso.reglas.length > 0 ? (
                            caso.reglas.map((regla, idx) => (
                              <div key={idx} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                <div className="font-medium text-sm">{regla.tipo?.replace(/_/g, ' ') || 'Regla'}</div>
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
                            ))
                          ) : (
                            <span className="text-sm text-gray-500">Sin reglas especiales</span>
                          )}
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
                        onClick={() => eliminarElemento('caso', undefined, caso.id?.toString())}
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
              </h3>
              <button
                onClick={() => setEditando(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              {editando.tipo === 'regla' && (
                <ReglaEditor 
                  data={editando.data} 
                  onChange={(newData) => setEditando({ ...editando, data: newData })} 
                />
              )}

              {editando.tipo === 'horario' && (
                <HorarioEditor 
                  data={editando.data} 
                  onChange={(newData) => setEditando({ ...editando, data: newData })} 
                />
              )}

              {editando.tipo === 'caso' && (
                <CasoEditor 
                  data={editando.data} 
                  onChange={(newData) => setEditando({ ...editando, data: newData })} 
                />
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setEditando(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
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

// Componentes de edición
function ReglaEditor({ data, onChange }: { data: any; onChange: (data: any) => void }) {
  const tiposReglaDisponibles = [
    { clave: 'regla_dias_trabajo', label: 'Días de trabajo por semana', tipo: 'number' },
    { clave: 'regla_dias_libres', label: 'Días libres por semana', tipo: 'number' },
    { clave: 'regla_porcentaje_apertura', label: 'Porcentaje de aperturas', tipo: 'number', step: '0.01' },
    { clave: 'regla_porcentaje_cierre', label: 'Porcentaje de cierres', tipo: 'number', step: '0.01' },
    { clave: 'regla_44_horas', label: 'Horas máximas semanales', tipo: 'number' },
    { clave: 'regla_horas_trabajo_diario', label: 'Horas trabajo diario', tipo: 'number' },
    { clave: 'regla_presencia_diaria', label: 'Horas presencia diaria', tipo: 'number' }
  ];

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Tipo de Regla</label>
        <select
          value={data.clave}
          onChange={(e) => {
            const reglaSeleccionada = tiposReglaDisponibles.find(r => r.clave === e.target.value);
            onChange({ 
              ...data, 
              clave: e.target.value,
              descripcion: reglaSeleccionada?.label || ''
            });
          }}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
        >
          <option value="">Seleccionar tipo de regla</option>
          {tiposReglaDisponibles.map(regla => (
            <option key={regla.clave} value={regla.clave}>
              {regla.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Valor</label>
        <input
          type={data.clave.includes('porcentaje') ? 'number' : 'number'}
          step={data.clave.includes('porcentaje') ? '0.01' : '1'}
          value={data.valor}
          onChange={(e) => onChange({ ...data, valor: e.target.value })}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
          placeholder={data.clave.includes('porcentaje') ? 'Ej: 0.2 para 20%' : 'Ej: 5'}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Descripción</label>
        <input
          type="text"
          value={data.descripcion || ''}
          onChange={(e) => onChange({ ...data, descripcion: e.target.value })}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
          placeholder="Descripción de la regla..."
        />
      </div>
    </div>
  );
}

function HorarioEditor({ data, onChange }: { data: any; onChange: (data: any) => void }) {
  const tiposHorarioDisponibles = [
    { clave: 'horario_chile_lv', label: 'Horarios Chile Lunes a Viernes' },
    { clave: 'horario_chile_fs', label: 'Horarios Chile Fin de Semana' },
    { clave: 'horario_colombia_lv', label: 'Horarios Colombia Lunes a Viernes' },
    { clave: 'horario_colombia_fs', label: 'Horarios Colombia Fin de Semana' }
  ];

  const agregarTurno = () => {
    const nuevosTurnos = [...(data.valor || []), {
      tipo: 'normal',
      entrada: '08:00',
      salida: '18:00',
      horasTrabajo: 9,
      horasPresencia: 10
    }];
    onChange({ ...data, valor: nuevosTurnos });
  };

  const actualizarTurno = (index: number, campo: string, valor: any) => {
    const nuevosTurnos = [...data.valor];
    nuevosTurnos[index] = { ...nuevosTurnos[index], [campo]: valor };
    onChange({ ...data, valor: nuevosTurnos });
  };

  const eliminarTurno = (index: number) => {
    const nuevosTurnos = data.valor.filter((_: any, i: number) => i !== index);
    onChange({ ...data, valor: nuevosTurnos });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Tipo de Horario</label>
        <select
          value={data.clave}
          onChange={(e) => {
            const horarioSeleccionado = tiposHorarioDisponibles.find(h => h.clave === e.target.value);
            onChange({ 
              ...data, 
              clave: e.target.value,
              descripcion: horarioSeleccionado?.label || ''
            });
          }}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
        >
          <option value="">Seleccionar tipo de horario</option>
          {tiposHorarioDisponibles.map(horario => (
            <option key={horario.clave} value={horario.clave}>
              {horario.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Descripción</label>
        <input
          type="text"
          value={data.descripcion || ''}
          onChange={(e) => onChange({ ...data, descripcion: e.target.value })}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
          placeholder="Descripción del horario..."
        />
      </div>
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium">Turnos</label>
          <button
            type="button"
            onClick={agregarTurno}
            className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            + Agregar Turno
          </button>
        </div>
        <div className="space-y-2">
          {data.valor && data.valor.map((turno: any, index: number) => (
            <div key={index} className="p-2 border border-gray-200 dark:border-gray-700 rounded flex gap-2 items-center">
              <select
                value={turno.tipo}
                onChange={(e) => actualizarTurno(index, 'tipo', e.target.value)}
                className="p-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
              >
                <option value="normal">Normal</option>
                <option value="apertura">Apertura</option>
                <option value="cierre">Cierre</option>
              </select>
              <input
                type="time"
                value={turno.entrada}
                onChange={(e) => actualizarTurno(index, 'entrada', e.target.value)}
                className="p-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
              />
              <span>a</span>
              <input
                type="time"
                value={turno.salida}
                onChange={(e) => actualizarTurno(index, 'salida', e.target.value)}
                className="p-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
              />
              <button
                onClick={() => eliminarTurno(index)}
                className="text-red-600 hover:text-red-800"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CasoEditor({ data, onChange }: { data: any; onChange: (data: any) => void }) {
  const agregarRegla = () => {
    const nuevasReglas = [...(data.reglas || []), { tipo: 'horario_maximo', entradaMax: '18:00' }];
    onChange({ ...data, reglas: nuevasReglas });
  };

  const actualizarRegla = (index: number, campo: string, valor: any) => {
    const nuevasReglas = [...data.reglas];
    nuevasReglas[index] = { ...nuevasReglas[index], [campo]: valor };
    onChange({ ...data, reglas: nuevasReglas });
  };

  const eliminarRegla = (index: number) => {
    const nuevasReglas = data.reglas.filter((_: any, i: number) => i !== index);
    onChange({ ...data, reglas: nuevasReglas });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre Empleado *</label>
          <input
            type="text"
            value={data.nombre_empleado}
            onChange={(e) => onChange({ ...data, nombre_empleado: e.target.value })}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
            placeholder="Nombre completo"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Employee ID</label>
          <input
            type="text"
            value={data.employeeid || ''}
            onChange={(e) => onChange({ ...data, employeeid: e.target.value })}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded"
            placeholder="Opcional"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">País</label>
          <select
            value={data.pais}
            onChange={(e) => onChange({ ...data, pais: e.target.value })}
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
                checked={data.activo}
                onChange={(e) => onChange({ ...data, activo: e.target.checked })}
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
            onClick={agregarRegla}
            className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            + Agregar Regla
          </button>
        </div>

        <div className="space-y-2">
          {data.reglas && data.reglas.map((regla: any, idx: number) => (
            <div key={idx} className="p-2 border border-gray-200 dark:border-gray-700 rounded flex gap-2 items-center">
              <select
                value={regla.tipo}
                onChange={(e) => actualizarRegla(idx, 'tipo', e.target.value)}
                className="flex-1 p-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
              >
                {tiposRegla.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>

              <input
                type="time"
                value={regla.entradaMax || ''}
                onChange={(e) => actualizarRegla(idx, 'entradaMax', e.target.value)}
                className="w-24 p-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                placeholder="Máx"
              />

              <input
                type="time"
                value={regla.entradaMin || ''}
                onChange={(e) => actualizarRegla(idx, 'entradaMin', e.target.value)}
                className="w-24 p-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                placeholder="Mín"
              />

              <button
                onClick={() => eliminarRegla(idx)}
                className="text-red-600 hover:text-red-800"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}