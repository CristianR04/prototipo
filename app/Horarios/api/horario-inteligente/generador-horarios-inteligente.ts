// generador-horarios-inteligente.ts
import pool from '@/lib/db';
import {
  CONFIGURACION_PAISES,
  FESTIVOS_2025_2026,
  CASOS_ESPECIALES,
  REGLAS_HORARIOS,
  TurnoConfig,
  CasoEspecial,
  esFestivo,
  esFinDeSemana,
  esDomingo,
  esLunes,
  esDiaLaboral,
  obtenerTurnosDisponibles,
  obtenerCasoEspecial,
  validarTurnoConRestricciones,
  calcularHorasSemana,
  aplicarReduccionHora
} from './horarios-config';

interface Teleoperador {
  employeeid: string;
  nombre: string;
  pais: string;
  estado: string;
  campana_id: number;
}

interface AsignacionTurno {
  employeeid: string;
  fecha: string;
  hora_entrada: string;
  hora_salida: string;
  tipo_turno: 'apertura' | 'cierre' | 'normal';
  es_reducido: boolean;
}

interface EstadoTeleoperador {
  employeeid: string;
  // ─── Ciclo 5x2 global (NO se resetea cada lunes) ───
  diasConsecutivos: number;       // Días seguidos trabajados en el ciclo actual
  diasEnCicloActual: number;      // Días asignados en el ciclo (trabajo+libre) → 0..6
  diasTrabajadosCiclo: number;    // Días de trabajo en el ciclo → 0..5
  diasLibresCiclo: number;        // Días de descanso en el ciclo → 0..2
  // ─── Semana calendario (se resetea cada lunes) ───
  turnosSemanales: AsignacionTurno[];
  tieneDiaReducido: boolean;
  // ─── Mes calendario ───
  ultimaFechaLibre: string | null;
  finesSemanaLibresMes: number;
  domingosLibresMes: number;
  sábadoLibreMesActual: boolean;  // Para rastrear si ya tuvo sábado libre este mes
}

export class GeneradorHorariosInteligente {
  private fechaInicio: Date;
  private fechaFin: Date;
  private teleoperadores: Teleoperador[] = [];
  private asignaciones: Map<string, AsignacionTurno[]> = new Map();
  private estados: Map<string, EstadoTeleoperador> = new Map();

  constructor(fechaInicio: string, fechaFin: string) {
    // Usar UTC para evitar desfases de zona horaria al iterar días
    this.fechaInicio = new Date(fechaInicio + 'T00:00:00Z');
    this.fechaFin = new Date(fechaFin + 'T00:00:00Z');
  }

  // ============================================
  // CARGAR DATOS
  // ============================================

  async cargarTeleoperadores(): Promise<void> {
    const client = await pool.connect();
    try {
      const query = `
        SELECT 
          u.employeeid,
          u.nombre,
          u.estado,
          u.campana_id,
          CASE 
            WHEN c.campana ILIKE '%Chile%' THEN 'Chile'
            WHEN c.campana ILIKE '%Colombia%' THEN 'Colombia'
            ELSE 'Chile'
          END as pais
        FROM usuarios u
        LEFT JOIN campana c ON u.campana_id = c.id
        WHERE u.estado IS DISTINCT FROM 'Inactivo'
        ORDER BY u.pais, u.employeeid
      `;

      const result = await client.query(query);
      this.teleoperadores = result.rows;

      // Inicializar estados con offset aleatorio del ciclo para que no todos
      // descansen el mismo día (distribución natural desde el primer día)
      this.teleoperadores.forEach((t, idx) => {
        // Offset entre 0 y 6: distribuye a los empleados en distintos puntos del ciclo
        const offset = idx % (REGLAS_HORARIOS.PATRON_5X2.diasTrabajo + REGLAS_HORARIOS.PATRON_5X2.diasLibres);
        this.estados.set(t.employeeid, {
          employeeid: t.employeeid,
          diasConsecutivos: offset < REGLAS_HORARIOS.PATRON_5X2.diasTrabajo ? offset : 0,
          diasEnCicloActual: offset,
          diasTrabajadosCiclo: Math.min(offset, REGLAS_HORARIOS.PATRON_5X2.diasTrabajo),
          diasLibresCiclo: Math.max(0, offset - REGLAS_HORARIOS.PATRON_5X2.diasTrabajo),
          turnosSemanales: [],
          tieneDiaReducido: false,
          ultimaFechaLibre: null,
          finesSemanaLibresMes: 0,
          domingosLibresMes: 0,
          sábadoLibreMesActual: false,
        });
      });
    } finally {
      client.release();
    }
  }

  // ============================================
  // LÓGICA PRINCIPAL
  // ============================================

  async generarHorarios(): Promise<AsignacionTurno[]> {
    await this.cargarTeleoperadores();

    const fechaActual = new Date(this.fechaInicio);

    while (fechaActual <= this.fechaFin) {
      const fechaStr = this.formatearFecha(fechaActual);
      const diaSemana = fechaActual.getUTCDay(); // 0=Dom … 6=Sáb

      // Resetear contadores semanales al inicio de cada semana (lunes)
      if (diaSemana === 1) {
        this.resetearSemanales();
      }

      // Resetear contadores mensuales al día 1
      if (fechaActual.getUTCDate() === 1) {
        this.resetearMensuales();
      }

      // Procesar cada país
      await this.procesarDiaPorPais(fechaActual, fechaStr, 'Chile');
      await this.procesarDiaPorPais(fechaActual, fechaStr, 'Colombia');

      // Avanzar al siguiente día
      fechaActual.setUTCDate(fechaActual.getUTCDate() + 1);
    }

    const todasAsignaciones: AsignacionTurno[] = [];
    this.asignaciones.forEach(asignaciones => {
      todasAsignaciones.push(...asignaciones);
    });

    return todasAsignaciones;
  }

  private async procesarDiaPorPais(
    fecha: Date,
    fechaStr: string,
    pais: string
  ): Promise<void> {
    const teleoperadoresPais = this.teleoperadores.filter(t => t.pais === pais);
    if (teleoperadoresPais.length === 0) return;

    const turnosDisponibles = obtenerTurnosDisponibles(pais, fecha, fechaStr);
    const esDomingoOFestivo = esDomingo(fecha) || esFestivo(fechaStr);

    // ─── PASO 1: Decidir para cada empleado si trabaja o descansa ────────────
    //
    // Regla fundamental del ciclo 5x2:
    //   • Si un empleado ya completó 5 días de trabajo en su ciclo → DEBE descansar
    //   • Si ya descansó 2 días → su ciclo se reinicia y puede trabajar
    //
    // Además hay restricciones de casos especiales y cuotas mensuales (domingos, fines de semana).

    const trabajadores: Teleoperador[] = [];
    const descansadores: Teleoperador[] = [];

    for (const t of teleoperadoresPais) {
      const estado = this.estados.get(t.employeeid)!;
      const casoEspecial = obtenerCasoEspecial(t.employeeid, t.nombre);

      // Licencias → siempre libre
      if (t.estado === 'Licencia') {
        descansadores.push(t);
        continue;
      }

      // Caso especial: solo lunes-viernes
      if (casoEspecial?.reglas.soloLunesViernes && esFinDeSemana(fecha)) {
        descansadores.push(t);
        continue;
      }

      // Caso especial: excluir festivos
      if (casoEspecial?.reglas.excluirFestivos && esFestivo(fechaStr)) {
        descansadores.push(t);
        continue;
      }

      // Ciclo 5x2: forzar descanso si completó 5 días de trabajo
      if (estado.diasTrabajadosCiclo >= REGLAS_HORARIOS.PATRON_5X2.diasTrabajo) {
        descansadores.push(t);
        continue;
      }

      // Regla de 6 días consecutivos máximo (safety net)
      if (estado.diasConsecutivos >= REGLAS_HORARIOS.MAX_DIAS_CONSECUTIVOS) {
        descansadores.push(t);
        continue;
      }

      // Cuota mensual: el empleado debe tener al menos 2 domingos libres
      // Si este es domingo y aún no los cumplió, tiene prioridad de descansar
      if (esDomingo(fecha) && estado.domingosLibresMes < REGLAS_HORARIOS.DOMINGOS_LIBRES_MES) {
        descansadores.push(t);
        continue;
      }

      // Cuota mensual: 1 fin de semana completo libre (sábado Y domingo)
      // Si es sábado y no ha tenido fin de semana libre este mes → descansar
      if (fecha.getUTCDay() === 6 && !estado.sábadoLibreMesActual &&
          estado.finesSemanaLibresMes < REGLAS_HORARIOS.FINES_SEMANA_LIBRES_MES) {
        descansadores.push(t);
        continue;
      }

      trabajadores.push(t);
    }

    // ─── PASO 2: Lunes = dotación completa (sobreescribe el ciclo si es necesario) ──
    if (esLunes(fecha)) {
      // Empleados que por ciclo debían descansar hoy pero que NO tienen restricciones
      // de caso especial ni licencia se mueven a trabajadores (el lunes es excepción).
      const moverATrabajar = descansadores.filter(t => {
        const estado = this.estados.get(t.employeeid)!;
        const casoEspecial = obtenerCasoEspecial(t.employeeid, t.nombre);
        return (
          t.estado !== 'Licencia' &&
          !casoEspecial?.reglas.soloLunesViernes &&
          !casoEspecial?.reglas.excluirFestivos &&
          estado.diasConsecutivos < REGLAS_HORARIOS.MAX_DIAS_CONSECUTIVOS
        );
      });
      moverATrabajar.forEach(t => {
        const idx = descansadores.indexOf(t);
        descansadores.splice(idx, 1);
        trabajadores.push(t);
      });
    }

    // ─── PASO 3: Domingo/festivo = limitar dotación a DOTACION_DOMINGOS ──────
    if (esDomingoOFestivo && !esLunes(fecha)) {
      const maxDotacion = REGLAS_HORARIOS.DOTACION_DOMINGOS.max;
      // Ordenar trabajadores por quién tiene menos domingos libres (los que más han trabajado domingo van al final)
      trabajadores.sort((a, b) => {
        const ea = this.estados.get(a.employeeid)!;
        const eb = this.estados.get(b.employeeid)!;
        return ea.domingosLibresMes - eb.domingosLibresMes;
      });

      // Excedentes → descansar
      while (trabajadores.length > maxDotacion) {
        const excedente = trabajadores.pop()!;
        descansadores.push(excedente);
      }

      // Verificar mínimo
      if (trabajadores.length < REGLAS_HORARIOS.DOTACION_DOMINGOS.min) {
        console.warn(`⚠️ ${fechaStr} (${pais}): dotación domingo ${trabajadores.length} < mínimo ${REGLAS_HORARIOS.DOTACION_DOMINGOS.min}`);
      }
    }

    // ─── PASO 4: Asignar turnos y días libres ────────────────────────────────
    for (const t of trabajadores) {
      this.asignarTurnoAleatorio(t, fecha, fechaStr, turnosDisponibles);
    }

    for (const t of descansadores) {
      this.asignarLibre(t, fecha, fechaStr);
    }
  }

  // ============================================
  // ASIGNACIÓN DE TURNOS
  // ============================================

  private asignarTurnoAleatorio(
    teleoperador: Teleoperador,
    fecha: Date,
    fechaStr: string,
    turnosDisponibles: TurnoConfig[]
  ): void {
    const estado = this.estados.get(teleoperador.employeeid)!;
    const casoEspecial = obtenerCasoEspecial(teleoperador.employeeid, teleoperador.nombre);

    // Filtrar turnos según restricciones del empleado
    let turnosFiltrados = turnosDisponibles.filter(turno =>
      validarTurnoConRestricciones(turno, fecha, fechaStr, casoEspecial?.reglas)
    );

    if (turnosFiltrados.length === 0) {
      // Sin turnos válidos para este empleado → libre
      this.asignarLibre(teleoperador, fecha, fechaStr);
      return;
    }

    // Seleccionar turno respetando distribución 20/20/60
    const turno = this.seleccionarTurnoPorDistribucion(turnosFiltrados);

    // Determinar si aplica reducción de hora (ley 44h)
    let turnoFinal = { ...turno };
    const debeReducir = this.debeAplicarReduccion(fecha, fechaStr, estado);

    if (debeReducir) {
      turnoFinal = aplicarReduccionHora(turno, turno.tipo === 'cierre');
      estado.tieneDiaReducido = true;
    }

    const asignacion: AsignacionTurno = {
      employeeid: teleoperador.employeeid,
      fecha: fechaStr,
      hora_entrada: turnoFinal.entrada,
      hora_salida: turnoFinal.salida,
      tipo_turno: turno.tipo,
      es_reducido: debeReducir
    };

    if (!this.asignaciones.has(teleoperador.employeeid)) {
      this.asignaciones.set(teleoperador.employeeid, []);
    }
    this.asignaciones.get(teleoperador.employeeid)!.push(asignacion);

    // ─── Actualizar estado del ciclo ─────────────────────────────────────────
    estado.diasConsecutivos++;
    estado.diasTrabajadosCiclo++;
    estado.diasEnCicloActual++;
    estado.turnosSemanales.push(asignacion);

    // Si completó 5 días de trabajo → el ciclo continúa, los próximos 2 serán libres
    // (no hace falta resetear aquí; filtrarDisponibles lo detecta)
  }

  private asignarLibre(
    teleoperador: Teleoperador,
    fecha: Date,
    fechaStr: string
  ): void {
    const estado = this.estados.get(teleoperador.employeeid)!;
    const diaSemana = fecha.getUTCDay();

    const asignacion: AsignacionTurno = {
      employeeid: teleoperador.employeeid,
      fecha: fechaStr,
      hora_entrada: 'Libre',
      hora_salida: 'Libre',
      tipo_turno: 'normal',
      es_reducido: false
    };

    if (!this.asignaciones.has(teleoperador.employeeid)) {
      this.asignaciones.set(teleoperador.employeeid, []);
    }
    this.asignaciones.get(teleoperador.employeeid)!.push(asignacion);

    // ─── Actualizar estado del ciclo ─────────────────────────────────────────
    estado.diasConsecutivos = 0;
    estado.ultimaFechaLibre = fechaStr;
    estado.diasLibresCiclo++;
    estado.diasEnCicloActual++;

    // Al completar los 2 días libres del ciclo → reiniciar el ciclo 5x2
    if (estado.diasLibresCiclo >= REGLAS_HORARIOS.PATRON_5X2.diasLibres) {
      estado.diasTrabajadosCiclo = 0;
      estado.diasLibresCiclo = 0;
      estado.diasEnCicloActual = 0;
    }

    // ─── Cuotas mensuales ────────────────────────────────────────────────────
    if (diaSemana === 0) { // Domingo
      estado.domingosLibresMes++;
    }
    if (diaSemana === 6) { // Sábado libre → marcar fin de semana
      estado.sábadoLibreMesActual = true;
    }
    if (diaSemana === 0 && estado.sábadoLibreMesActual) {
      // Domingo libre después de sábado libre → fin de semana completo libre
      estado.finesSemanaLibresMes++;
      estado.sábadoLibreMesActual = false;
    }
  }

  // ============================================
  // SELECCIÓN DE TURNO
  // ============================================

  private seleccionarTurnoPorDistribucion(turnos: TurnoConfig[]): TurnoConfig {
    const rand = Math.random();

    const aperturas = turnos.filter(t => t.tipo === 'apertura');
    const cierres = turnos.filter(t => t.tipo === 'cierre');
    const normales = turnos.filter(t => t.tipo === 'normal');

    if (rand < REGLAS_HORARIOS.PORCENTAJE_APERTURA && aperturas.length > 0) {
      return aperturas[Math.floor(Math.random() * aperturas.length)];
    }
    if (rand < REGLAS_HORARIOS.PORCENTAJE_APERTURA + REGLAS_HORARIOS.PORCENTAJE_CIERRE && cierres.length > 0) {
      return cierres[Math.floor(Math.random() * cierres.length)];
    }
    if (normales.length > 0) {
      return normales[Math.floor(Math.random() * normales.length)];
    }

    return turnos[Math.floor(Math.random() * turnos.length)];
  }

  // ============================================
  // REDUCCIÓN 44H
  // ============================================

  private debeAplicarReduccion(
    fecha: Date,
    fechaStr: string,
    estado: EstadoTeleoperador
  ): boolean {
    const config = REGLAS_HORARIOS.REDUCCION_HORAS_44;

    if (esFinDeSemana(fecha)) return false;
    if (config.excluirFestivos && esFestivo(fechaStr)) return false;
    if (!config.aplicaEnDias.includes(fecha.getUTCDay())) return false;
    if (estado.tieneDiaReducido) return false;

    const horasSemana = calcularHorasSemana(
      estado.turnosSemanales
        .filter(t => t.hora_entrada !== 'Libre')
        .map(t => ({ entrada: t.hora_entrada, salida: t.hora_salida }))
    );

    // Si al añadir otro turno completo (10h) superaría 44h → reducir
    return horasSemana + 10 > REGLAS_HORARIOS.HORAS_SEMANALES_MAX;
  }

  // ============================================
  // RESETEOS
  // ============================================

  private resetearSemanales(): void {
    this.estados.forEach(estado => {
      estado.turnosSemanales = [];
      estado.tieneDiaReducido = false;
    });
  }

  private resetearMensuales(): void {
    this.estados.forEach(estado => {
      estado.finesSemanaLibresMes = 0;
      estado.domingosLibresMes = 0;
      estado.sábadoLibreMesActual = false;
    });
  }

  // ============================================
  // UTILIDADES
  // ============================================

  private formatearFecha(fecha: Date): string {
    const año = fecha.getUTCFullYear();
    const mes = (fecha.getUTCMonth() + 1).toString().padStart(2, '0');
    const dia = fecha.getUTCDate().toString().padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }
}