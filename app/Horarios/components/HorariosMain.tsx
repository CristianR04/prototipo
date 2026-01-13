// app/Horarios/components/HorariosMain.tsx
"use client";

import React, { useState } from 'react';
import { useTablaHorarios } from "../hooks/useTablaHorarios";
import TablaHorariosUI from "./TablaHorariosUI";
import TablaHorariosBody from "./TableBody";
import ConfiguracionCompacta from "./ConfiguracionCompacta";

// Componente para generación automática
const GeneradorAutomatico = ({ onGenerar, isLoading }: {
  onGenerar: (meses: number) => Promise<void>;
  isLoading: boolean
}) => {
  const [meses, setMeses] = React.useState(2);

  const handleGenerar = async () => {
    if (confirm(`¿Generar horarios automáticos para los próximos ${meses} meses?\n\nLos horarios existentes en ese rango serán reemplazados.`)) {
      await onGenerar(meses);
    }
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
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-blue-200 dark:border-gray-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <span className="text-xl">🚀</span>
            Generación Automática de Horarios
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Genera horarios automáticamente para los próximos {meses} meses (hasta {calcularFechaFin()})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 dark:text-gray-300">Meses:</label>
            <select
              value={meses}
              onChange={(e) => setMeses(Number(e.target.value))}
              disabled={isLoading}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm cursor-pointer"
            >
              <option value={1}>1 mes</option>
              <option value={2}>2 meses</option>
              <option value={3}>3 meses</option>
            </select>
          </div>

          <button
            onClick={handleGenerar}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${isLoading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white shadow-sm'
              }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generando...
              </>
            ) : (
              'Generar Automáticamente'
            )}
          </button>
        </div>
      </div>

      <div className="mt-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg text-sm">
        <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Características:</p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-1 text-gray-600 dark:text-gray-400">
          <li className="flex items-center gap-1">
            <span className="text-green-500">✓</span>
            <span>Asigna horarios automáticamente</span>
          </li>
          <li className="flex items-center gap-1">
            <span className="text-green-500">✓</span>
            <span>Respetará días de licencia</span>
          </li>
          <li className="flex items-center gap-1">
            <span className="text-green-500">✓</span>
            <span>Calculará breaks automáticamente</span>
          </li>
          <li className="flex items-center gap-1">
            <span className="text-green-500">✓</span>
            <span>Mantendrá consistencia de horarios</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default function HorariosMain() {
  const {
    // Estados
    usuarios,
    fechas,
    horarios,
    horariosOriginales,
    horasEntrada,
    festivos,
    isLoading,
    isLoadingUsuarios,
    mensaje,
    modoSeleccion,
    celdasSeleccionadas,
    configFechas,

    // Valores calculados
    cambiosPendientes,
    todasCeldasSeleccionadas,
    textoRangoFechas,
    textoSemana,

    // Setters
    setMensaje,

    // Funciones de API
    guardarHorarios,
    generarHorariosAutomaticos,

    // Funciones de cambio
    cambiarHoraEntrada,

    // Funciones de selección
    limpiarSeleccion,
    handleMouseDownCelda,
    handleMouseEnterCelda,
    handleMouseUp,
    toggleSeleccionTodo,
    seleccionarFila,
    toggleSeleccionColumna,
    toggleModoSeleccion,
    estaSeleccionada,

    // Funciones globales
    aplicarHoraGlobal,

    // Funciones de fechas
    cambiarVista,
    cambiarAño,
    cambiarMes,
    cambiarMesNavigation,
    cambiarAñoNavigation,
    seleccionarMesActual,
    seleccionarSemanaActual,

    // Funciones principales
    handleRevertir,
    handleRecargarUsuarios,

    // Constantes
    HORAS_OPCIONES,
    HORAS_CHILE,
    HORAS_COLOMBIA,
    HORAS_DEFAULT,
    AÑOS_DISPONIBLES
  } = useTablaHorarios();

  // Estado para mostrar configuración
  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false);

  // Render condicional
  if (isLoadingUsuarios) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400 flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
          <span>Cargando usuarios...</span>
        </div>
      </div>
    );
  }

  if (usuarios.length === 0) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 min-h-screen">
        <div className="max-w-md mx-auto mt-12 p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-100">No hay usuarios</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">No se encontraron usuarios en la base de datos.</p>
          <button
            onClick={handleRecargarUsuarios}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100">Gestión de Horarios</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            <button onClick={handleRecargarUsuarios} className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 hover:underline transition-all" title="Recargar lista de usuarios">
              {usuarios.length} usuarios
            </button>
            <span className="mx-2">•</span>
            <span className="text-gray-700 dark:text-gray-300 font-medium">{textoRangoFechas}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón de Configuración */}
          <button
            onClick={() => setMostrarConfiguracion(true)}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <span>⚙️</span>
            <span>Configuración</span>
          </button>

          {modoSeleccion && celdasSeleccionadas.length > 0 && (
            <div className={`px-3 py-1.5 border rounded-lg text-sm ${modoSeleccion === "rango"
              ? "border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
              : "border-purple-400 text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20"
              }`}>
              {celdasSeleccionadas.length} seleccionadas
            </div>
          )}
          {cambiosPendientes > 0 && (
            <div className="px-3 py-1.5 border border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm">
              {cambiosPendientes} cambios pendientes
            </div>
          )}
        </div>
      </div>

      {/* Mensaje */}
      {mensaje && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-3 text-sm ${mensaje.tipo === "success"
          ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-400"
          : mensaje.tipo === "error"
            ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-400"
            : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 text-blue-700 dark:text-blue-400"
          }`}>
          {mensaje.tipo === "info" && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
          )}
          <span className="flex-1">{mensaje.texto}</span>
          {mensaje.tipo !== "info" && (
            <button onClick={() => setMensaje(null)} className="ml-2 text-xs opacity-70 hover:opacity-100 text-gray-500 dark:text-gray-400">
              ✕
            </button>
          )}
        </div>
      )}

      {/* Componente de generación automática */}
      <GeneradorAutomatico
        onGenerar={generarHorariosAutomaticos}
        isLoading={isLoading}
      />

      {/* Componentes de UI */}
      <TablaHorariosUI
        configFechas={configFechas}
        modoSeleccion={modoSeleccion}
        celdasSeleccionadas={celdasSeleccionadas}
        textoRangoFechas={textoRangoFechas}
        textoSemana={textoSemana}
        añosDisponibles={AÑOS_DISPONIBLES}
        todasCeldasSeleccionadas={todasCeldasSeleccionadas}
        HORAS_OPCIONES={HORAS_OPCIONES}
        festivos={festivos}
        cambiosPendientes={cambiosPendientes}
        isLoading={isLoading}
        mensaje={mensaje}
        onCambiarVista={cambiarVista}
        onCambiarAño={cambiarAño}
        onCambiarMes={cambiarMes}
        onCambiarMesNavigation={cambiarMesNavigation}
        onCambiarAñoNavigation={cambiarAñoNavigation}
        onSeleccionarMesActual={seleccionarMesActual}
        onSeleccionarSemanaActual={seleccionarSemanaActual}
        onToggleModoSeleccion={toggleModoSeleccion}
        onToggleSeleccionTodo={toggleSeleccionTodo}
        onLimpiarSeleccion={limpiarSeleccion}
        onAplicarHoraGlobal={aplicarHoraGlobal}
      />

      {/* Cuerpo de la tabla */}
      <TablaHorariosBody
        usuarios={usuarios}
        fechas={fechas}
        horariosCompletos={horarios}
        horariosOriginales={horariosOriginales}
        horasEntrada={horasEntrada}
        modoSeleccion={modoSeleccion}
        celdasSeleccionadas={celdasSeleccionadas}
        estaSeleccionada={estaSeleccionada}
        HORAS_OPCIONES={HORAS_OPCIONES}
        HORAS_CHILE={HORAS_CHILE}
        HORAS_COLOMBIA={HORAS_COLOMBIA}
        HORAS_DEFAULT={HORAS_DEFAULT}
        festivos={festivos}
        onCambiarHoraEntrada={cambiarHoraEntrada}
        onMouseDownCelda={handleMouseDownCelda}
        onMouseEnterCelda={handleMouseEnterCelda}
        onMouseUp={handleMouseUp}
        onToggleSeleccionColumna={toggleSeleccionColumna}
        onSeleccionarFila={seleccionarFila}
        isLoading={isLoading}
      />

      {/* Footer */}
      <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="text-sm text-gray-600 dark:text-gray-500">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${!modoSeleccion ? "bg-violet-600" : modoSeleccion === "rango" ? "bg-amber-500" : "bg-purple-500"
              }`}></div>
            <span className="text-gray-700 dark:text-gray-300">
              {!modoSeleccion && "Modo edición individual"}
              {modoSeleccion === "rango" && "Modo selección por área"}
              {modoSeleccion === "disperso" && "Modo selección por puntos"}
            </span>
            <span className="mx-2 text-gray-400">•</span>
            <span className="text-gray-600 dark:text-gray-400">{fechas.length} días • {usuarios.length} usuarios</span>
          </div>

          {/* Leyenda simplificada */}
          <div className="mt-2 flex flex-wrap gap-3">
            <div className="text-xs text-gray-600 dark:text-gray-500 font-medium">Festivos:</div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500/20 border border-red-500/50"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Fin semana</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500/20 border border-purple-500/50"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Ambos</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-rose-500/20 border border-rose-500/50"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Chile</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Colombia</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {cambiosPendientes > 0 && (
            <button onClick={handleRevertir} disabled={isLoading} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 order-2 sm:order-1 flex items-center gap-2">
              <span className="text-lg">↶</span>
              <span>Descartar cambios</span>
            </button>
          )}

          <button onClick={guardarHorarios} disabled={isLoading || cambiosPendientes === 0} className={`px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 flex items-center gap-2 ${cambiosPendientes > 0 ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
            }`}>
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <span className="text-lg">💾</span>
                <span>Guardar {cambiosPendientes > 0 ? `(${cambiosPendientes})` : ""}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal de Configuración */}
      {mostrarConfiguracion && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden">
            <ConfiguracionCompacta onClose={() => setMostrarConfiguracion(false)} />
          </div>
        </div>
      )}
    </div>
  );
}