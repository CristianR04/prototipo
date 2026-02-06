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
  diasConsecutivos: number;
  diasTrabajadosSemana: number;
  diasLibresSemana: number;
  ultimaFechaLibre: string | null;
  finesSemanaLibresMes: number;
  domingosLibresMes: number;
  turnosSemanales: AsignacionTurno[];
  tieneDiaReducido: boolean;
}

export class GeneradorHorariosInteligente {
  private fechaInicio: Date;
  private fechaFin: Date;
  private teleoperadores: Teleoperador[] = [];
  private asignaciones: Map<string, AsignacionTurno[]> = new Map();
  private estados: Map<string, EstadoTeleoperador> = new Map();

  constructor(fechaInicio: string, fechaFin: string) {
    this.fechaInicio = new Date(fechaInicio);
    this.fechaFin = new Date(fechaFin);
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
      
      // Inicializar estados
      this.teleoperadores.forEach(t => {
        this.estados.set(t.employeeid, {
          employeeid: t.employeeid,
          diasConsecutivos: 0,
          diasTrabajadosSemana: 0,
          diasLibresSemana: 0,
          ultimaFechaLibre: null,
          finesSemanaLibresMes: 0,
          domingosLibresMes: 0,
          turnosSemanales: [],
          tieneDiaReducido: false
        });
      });
      
    } finally {
      client.release();
    }
  }

  // ============================================
  // LÓGICA DE GENERACIÓN
  // ============================================

  async generarHorarios(): Promise<AsignacionTurno[]> {
    await this.cargarTeleoperadores();
    
    const fechaActual = new Date(this.fechaInicio);
    
    while (fechaActual <= this.fechaFin) {
      const fechaStr = this.formatearFecha(fechaActual);
      
      // Procesar por país
      await this.procesarDiaPorPais(fechaActual, fechaStr, 'Chile');
      await this.procesarDiaPorPais(fechaActual, fechaStr, 'Colombia');
      
      // Avanzar al siguiente día
      fechaActual.setDate(fechaActual.getDate() + 1);
      
      // Resetear contadores semanales si es lunes
      if (esLunes(fechaActual)) {
        this.resetearSemanales();
      }
      
      // Resetear contadores mensuales si es día 1
      if (fechaActual.getDate() === 1) {
        this.resetearMensuales();
      }
    }
    
    // Convertir asignaciones a array
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
    const turnosDisponibles = obtenerTurnosDisponibles(pais, fecha, fechaStr);
    
    // Determinar dotación necesaria
    const dotacionNecesaria = this.calcularDotacionNecesaria(
      fecha,
      fechaStr,
      teleoperadoresPais.length
    );
    
    // Filtrar teleoperadores disponibles
    const disponibles = this.filtrarDisponibles(
      teleoperadoresPais,
      fecha,
      fechaStr
    );
    
    // Si es lunes, todos deben trabajar (dotación completa)
    if (esLunes(fecha)) {
      disponibles.forEach(t => {
        this.asignarTurnoAleatorio(t, fecha, fechaStr, turnosDisponibles);
      });
      return;
    }
    
    // Si es domingo, limitar dotación
    if (esDomingo(fecha) || esFestivo(fechaStr)) {
      const dotacionDomingo = this.seleccionarParaDomingo(
        disponibles,
        Math.min(dotacionNecesaria, REGLAS_HORARIOS.DOTACION_DOMINGOS.max)
      );
      
      dotacionDomingo.forEach(t => {
        this.asignarTurnoAleatorio(t, fecha, fechaStr, turnosDisponibles);
      });
      
      return;
    }
    
    // Día normal: aplicar patrón 5x2
    const trabajadores = this.seleccionarTrabajadores(
      disponibles,
      dotacionNecesaria
    );
    
    trabajadores.forEach(t => {
      this.asignarTurnoAleatorio(t, fecha, fechaStr, turnosDisponibles);
    });
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
    
    // Filtrar turnos según restricciones
    let turnosFiltrados = turnosDisponibles.filter(turno =>
      validarTurnoConRestricciones(
        turno,
        fecha,
        fechaStr,
        casoEspecial?.reglas
      )
    );
    
    if (turnosFiltrados.length === 0) {
      // Si no hay turnos válidos, dar libre
      this.asignarLibre(teleoperador, fechaStr);
      return;
    }
    
    // Seleccionar turno según distribución
    const turno = this.seleccionarTurnoPorDistribucion(turnosFiltrados, estado);
    
    // Determinar si debe aplicarse reducción de hora (ley 44h)
    let turnoFinal = { ...turno };
    const debeReducir = this.debeAplicarReduccion(fecha, fechaStr, estado);
    
    if (debeReducir) {
      turnoFinal = aplicarReduccionHora(turno, turno.tipo === 'cierre');
      estado.tieneDiaReducido = true;
    }
    
    // Crear asignación
    const asignacion: AsignacionTurno = {
      employeeid: teleoperador.employeeid,
      fecha: fechaStr,
      hora_entrada: turnoFinal.entrada,
      hora_salida: turnoFinal.salida,
      tipo_turno: turno.tipo,
      es_reducido: debeReducir
    };
    
    // Guardar asignación
    if (!this.asignaciones.has(teleoperador.employeeid)) {
      this.asignaciones.set(teleoperador.employeeid, []);
    }
    this.asignaciones.get(teleoperador.employeeid)!.push(asignacion);
    
    // Actualizar estado
    estado.diasConsecutivos++;
    estado.diasTrabajadosSemana++;
    estado.turnosSemanales.push(asignacion);
  }

  private asignarLibre(teleoperador: Teleoperador, fechaStr: string): void {
    const estado = this.estados.get(teleoperador.employeeid)!;
    
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
    
    // Actualizar estado
    estado.diasConsecutivos = 0;
    estado.diasLibresSemana++;
    estado.ultimaFechaLibre = fechaStr;
  }

  // ============================================
  // SELECCIÓN Y FILTRADO
  // ============================================

  private filtrarDisponibles(
    teleoperadores: Teleoperador[],
    fecha: Date,
    fechaStr: string
  ): Teleoperador[] {
    return teleoperadores.filter(t => {
      // Excluir licencias
      if (t.estado === 'Licencia') return false;
      
      const estado = this.estados.get(t.employeeid)!;
      const casoEspecial = obtenerCasoEspecial(t.employeeid, t.nombre);
      
      // Validar restricciones de casos especiales
      if (casoEspecial) {
        // Solo lunes a viernes
        if (casoEspecial.reglas.soloLunesViernes && esFinDeSemana(fecha)) {
          return false;
        }
        
        // Excluir festivos
        if (casoEspecial.reglas.excluirFestivos && esFestivo(fechaStr)) {
          return false;
        }
      }
      
      // No puede trabajar más de 6 días consecutivos
      if (estado.diasConsecutivos >= REGLAS_HORARIOS.MAX_DIAS_CONSECUTIVOS) {
        return false;
      }
      
      // Patrón 5x2: si ya trabajó 5 días, necesita descanso
      if (estado.diasTrabajadosSemana >= REGLAS_HORARIOS.PATRON_5X2.diasTrabajo) {
        return false;
      }
      
      return true;
    });
  }

  private seleccionarTrabajadores(
    disponibles: Teleoperador[],
    cantidad: number
  ): Teleoperador[] {
    // Priorizar a quienes:
    // 1. Tienen menos días trabajados en la semana
    // 2. No han tenido días libres recientemente
    // 3. Necesitan cumplir cuotas mensuales
    
    const conPrioridad = disponibles.map(t => {
      const estado = this.estados.get(t.employeeid)!;
      let prioridad = 0;
      
      // Menos días trabajados = mayor prioridad
      prioridad += (5 - estado.diasTrabajadosSemana) * 100;
      
      // Necesita más domingos libres
      if (estado.domingosLibresMes < REGLAS_HORARIOS.DOMINGOS_LIBRES_MES) {
        prioridad -= 50;
      }
      
      // Necesita fin de semana libre
      if (estado.finesSemanaLibresMes < REGLAS_HORARIOS.FINES_SEMANA_LIBRES_MES) {
        prioridad -= 30;
      }
      
      return { teleoperador: t, prioridad };
    });
    
    // Ordenar por prioridad y seleccionar
    conPrioridad.sort((a, b) => b.prioridad - a.prioridad);
    
    return conPrioridad.slice(0, cantidad).map(p => p.teleoperador);
  }

  private seleccionarParaDomingo(
    disponibles: Teleoperador[],
    cantidad: number
  ): Teleoperador[] {
    // Rotar quienes trabajan domingos para equidad
    const conDomingos = disponibles.map(t => {
      const estado = this.estados.get(t.employeeid)!;
      return {
        teleoperador: t,
        domingosLibres: estado.domingosLibresMes
      };
    });
    
    // Priorizar a quienes tienen menos domingos libres
    conDomingos.sort((a, b) => a.domingosLibres - b.domingosLibres);
    
    return conDomingos.slice(0, cantidad).map(d => d.teleoperador);
  }

  private seleccionarTurnoPorDistribucion(
    turnos: TurnoConfig[],
    estado: EstadoTeleoperador
  ): TurnoConfig {
    // Distribuir según porcentajes: 20% apertura, 20% cierre, 60% normales
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
    
    // Fallback: cualquier turno disponible
    return turnos[Math.floor(Math.random() * turnos.length)];
  }

  // ============================================
  // VALIDACIONES Y CÁLCULOS
  // ============================================

  private calcularDotacionNecesaria(
    fecha: Date,
    fechaStr: string,
    totalTeleoperadores: number
  ): number {
    if (esDomingo(fecha) || (esFestivo(fechaStr) && !esFinDeSemana(fecha))) {
      // Domingos y festivos: entre 16-20
      return Math.min(
        REGLAS_HORARIOS.DOTACION_DOMINGOS.max,
        Math.max(REGLAS_HORARIOS.DOTACION_DOMINGOS.min, Math.floor(totalTeleoperadores * 0.6))
      );
    }
    
    // Días normales: dotación completa menos los que están en ciclo de descanso
    return Math.floor(totalTeleoperadores * 0.7);
  }

  private debeAplicarReduccion(
    fecha: Date,
    fechaStr: string,
    estado: EstadoTeleoperador
  ): boolean {
    const config = REGLAS_HORARIOS.REDUCCION_HORAS_44;
    
    // No aplica en fines de semana
    if (esFinDeSemana(fecha)) return false;
    
    // No aplica en festivos
    if (config.excluirFestivos && esFestivo(fechaStr)) return false;
    
    // Solo en días laborales especificados
    if (!config.aplicaEnDias.includes(fecha.getDay())) return false;
    
    // Ya tiene un día reducido esta semana
    if (estado.tieneDiaReducido) return false;
    
    // Validar que necesita reducción para cumplir 44h
    const horasSemana = calcularHorasSemana(
      estado.turnosSemanales.map(t => ({
        entrada: t.hora_entrada,
        salida: t.hora_salida
      }))
    );
    
    // Si ya está cerca de 44h, aplicar reducción
    return horasSemana + 10 > REGLAS_HORARIOS.HORAS_SEMANALES_MAX;
  }

  // ============================================
  // RESETEOS DE CONTADORES
  // ============================================

  private resetearSemanales(): void {
    this.estados.forEach(estado => {
      estado.diasTrabajadosSemana = 0;
      estado.diasLibresSemana = 0;
      estado.turnosSemanales = [];
      estado.tieneDiaReducido = false;
    });
  }

  private resetearMensuales(): void {
    this.estados.forEach(estado => {
      estado.finesSemanaLibresMes = 0;
      estado.domingosLibresMes = 0;
    });
  }

  // ============================================
  // UTILIDADES
  // ============================================

  private formatearFecha(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const dia = fecha.getDate().toString().padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }
}