// Horas disponibles (5:00 a 10:30)
export const HORAS_OPCIONES: string[] = (() => {
  const opciones = ["Libre"];
  for (let i = 0; i < 12; i++) {
    const horaBase = 5 + Math.floor(i / 2);
    const minutos = i % 2 === 0 ? "00" : "30";
    opciones.push(`${horaBase.toString().padStart(2, "0")}:${minutos}`);
  }
  return opciones;
})();

// Tipos de jornada
export const TIPOS_JORNADA = [
  { value: "normal", label: "Normal", color: "bg-cyan-500", desc: "Jornada completa (10h)" },
  { value: "entrada_tardia", label: "Entrada tardía", color: "bg-orange-500", desc: "Entra 1h más tarde (9h desde entrada tardía)" },
  { value: "salida_temprana", label: "Salida temprana", color: "bg-red-500", desc: "Sale 1h más temprano (9h desde entrada original)" },
];

// Fechas
export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const MESES_ABR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Fechas globales
export const HOY = new Date();
export const AÑO_ACTUAL = HOY.getFullYear();
export const AÑOS_DISPONIBLES = Array.from({ length: 6 }, (_, i) => AÑO_ACTUAL + i);