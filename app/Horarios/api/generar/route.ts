import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Tipos de jornada
type TipoJornada = "normal" | "entrada_tardia" | "salida_temprana";

// Interfaz para teleoperadores
interface Teleoperador {
  employeeid: string;
  nombre: string;
  pais: string; // 'Chile' o 'Colombia'
  estado: string;
  campana_id: number;
}

// Interfaz para turnos
interface Turno {
  entrada: string;
  salida: string;
  tipo: 'apertura' | 'cierre' | 'normal';
}

// Interfaz para horario generado
interface HorarioGenerado {
  employeeid: string;
  fecha: string;
  hora_entrada: string;
  tipo_jornada?: TipoJornada;
}

// Fechas festivas (ejemplo - completa según tu necesidad)
const FESTIVOS_2026 = [
  '2026-01-01', // Año Nuevo
  '2026-04-10', // Viernes Santo
  '2026-04-11', // Sábado Santo
  '2026-05-01', // Día del Trabajo
  '2026-05-21', // Día de las Glorias Navales
  '2026-06-20', // Corpus Christi
  '2026-06-21', // Día Nacional de los Pueblos Indígenas
  '2026-07-16', // Día de la Virgen del Carmen
  '2026-08-15', // Asunción de la Virgen
  '2026-09-18', // Fiestas Patrias
  '2026-09-19', // Día de las Glorias del Ejército
  '2026-10-12', // Encuentro de Dos Mundos
  '2026-10-31', // Día de las Iglesias Evangélicas y Protestantes
  '2026-11-01', // Día de Todos los Santos
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
];

class GeneradorHorarios {
  private fechaInicio: Date;
  private fechaFin: Date;
  private teleoperadores: Teleoperador[] = [];
  private asignaciones: Map<string, HorarioGenerado[]> = new Map();
  private turnosPorPais: Record<string, Record<string, Turno[]>> = {};

  constructor(fechaInicio: string, fechaFin: string) {
    this.fechaInicio = new Date(fechaInicio);
    this.fechaFin = new Date(fechaFin);
    this.inicializarTurnos();
  }

  // Inicializar los turnos por país y día
  private inicializarTurnos() {
    this.turnosPorPais = {
      'Chile': {
        'Lunes-Viernes': [
          { entrada: '08:00', salida: '18:00', tipo: 'apertura' },
          { entrada: '08:30', salida: '18:30', tipo: 'normal' },
          { entrada: '09:00', salida: '19:00', tipo: 'normal' },
          { entrada: '09:30', salida: '19:30', tipo: 'normal' },
          { entrada: '10:00', salida: '20:00', tipo: 'normal' },
          { entrada: '10:30', salida: '20:30', tipo: 'normal' },
          { entrada: '11:00', salida: '21:00', tipo: 'normal' },
          { entrada: '11:30', salida: '21:30', tipo: 'normal' },
          { entrada: '12:00', salida: '22:00', tipo: 'cierre' }
        ],
        'FinSemana': [
          { entrada: '09:00', salida: '19:00', tipo: 'apertura' },
          { entrada: '09:30', salida: '19:30', tipo: 'normal' },
          { entrada: '10:00', salida: '20:00', tipo: 'normal' },
          { entrada: '10:30', salida: '20:30', tipo: 'normal' },
          { entrada: '11:00', salida: '21:00', tipo: 'normal' },
          { entrada: '11:30', salida: '21:30', tipo: 'normal' },
          { entrada: '12:00', salida: '22:00', tipo: 'cierre' }
        ]
      },
      'Colombia': {
        'Lunes-Viernes': [
          { entrada: '06:00', salida: '16:00', tipo: 'apertura' },
          { entrada: '06:30', salida: '16:30', tipo: 'normal' },
          { entrada: '07:00', salida: '17:00', tipo: 'normal' },
          { entrada: '07:30', salida: '17:30', tipo: 'normal' },
          { entrada: '08:00', salida: '18:00', tipo: 'normal' },
          { entrada: '08:30', salida: '18:30', tipo: 'normal' },
          { entrada: '09:00', salida: '19:00', tipo: 'normal' },
          { entrada: '09:30', salida: '19:30', tipo: 'normal' },
          { entrada: '10:00', salida: '20:00', tipo: 'cierre' }
        ],
        'FinSemana': [
          { entrada: '07:00', salida: '17:00', tipo: 'apertura' },
          { entrada: '07:30', salida: '17:30', tipo: 'normal' },
          { entrada: '08:00', salida: '18:00', tipo: 'normal' },
          { entrada: '08:30', salida: '18:30', tipo: 'normal' },
          { entrada: '09:00', salida: '19:00', tipo: 'normal' },
          { entrada: '09:30', salida: '19:30', tipo: 'normal' },
          { entrada: '10:00', salida: '20:00', tipo: 'cierre' }
        ]
      }
    };
  }

  // Cargar teleoperadores desde la base de datos
  async cargarTeleoperadores() {
    const client = await pool.connect();
    try {
      // Obtener usuarios con su país y estado
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
      
    } finally {
      client.release();
    }
  }

  // Determinar si es fin de semana o festivo
  private esFinDeSemanaOFestivo(fecha: Date): boolean {
    const diaSemana = fecha.getDay();
    const fechaStr = fecha.toISOString().split('T')[0];
    
    // Es domingo (0), sábado (6) o festivo
    return diaSemana === 0 || diaSemana === 6 || FESTIVOS_2026.includes(fechaStr);
  }

  // Determinar tipo de día
  private tipoDeDia(fecha: Date): 'Lunes-Viernes' | 'FinSemana' {
    return this.esFinDeSemanaOFestivo(fecha) ? 'FinSemana' : 'Lunes-Viernes';
  }

  // Obtener teleoperadores por país
  private obtenerTeleoperadoresPorPais(pais: string): Teleoperador[] {
    return this.teleoperadores.filter(t => t.pais === pais && t.estado !== 'Licencia');
  }

  // Asignar turnos para un día específico
  private asignarTurnosParaDia(fecha: Date) {
    const fechaStr = fecha.toISOString().split('T')[0];
    const tipoDia = this.tipoDeDia(fecha);
    const diaSemana = fecha.getDay();
    
    // Para cada país
    ['Chile', 'Colombia'].forEach(pais => {
      const teleoperadores = this.obtenerTeleoperadoresPorPais(pais);
      const turnosDisponibles = this.turnosPorPais[pais][tipoDia];
      
      // Aplicar reglas especiales
      let asignados = this.asignarConReglasEspeciales(
        teleoperadores, 
        turnosDisponibles, 
        fecha, 
        pais
      );
      
      // Completar con asignación normal
      asignados = this.completarAsignacion(
        teleoperadores,
        turnosDisponibles,
        asignados,
        fecha
      );
      
      // Guardar asignaciones
      asignados.forEach(asignacion => {
        if (!this.asignaciones.has(asignacion.employeeid)) {
          this.asignaciones.set(asignacion.employeeid, []);
        }
        this.asignaciones.get(asignacion.employeeid)?.push(asignacion);
      });
    });
  }

  // Aplicar reglas especiales para teleoperadores específicos
  private asignarConReglasEspeciales(
    teleoperadores: Teleoperador[], 
    turnosDisponibles: Turno[], 
    fecha: Date, 
    pais: string
  ): HorarioGenerado[] {
    const fechaStr = fecha.toISOString().split('T')[0];
    const asignados: HorarioGenerado[] = [];
    const tipoDia = this.tipoDeDia(fecha);
    
    teleoperadores.forEach(teleoperador => {
      // Casos especiales para Colombia
      if (pais === 'Colombia') {
        switch (teleoperador.nombre) {
          case 'Nadia Maria Caro Vargas':
            // Solo asignar turnos entre 07:00 y 21:00
            const turnosNadia = turnosDisponibles.filter(t => {
              const horaEntrada = parseInt(t.entrada.split(':')[0]);
              return horaEntrada >= 7 && horaEntrada <= 20;
            });
            if (turnosNadia.length > 0) {
              const turno = turnosNadia[Math.floor(Math.random() * turnosNadia.length)];
              asignados.push({
                employeeid: teleoperador.employeeid,
                fecha: fechaStr,
                hora_entrada: turno.entrada
              });
            }
            break;
            
          case 'Sophia Lopera Parra':
          case 'Maria Alejandra Medina Paredes':
            // Solo lunes a viernes de 07:00 a 17:00
            if (tipoDia === 'Lunes-Viernes') {
              const turnoEspecial = turnosDisponibles.find(t => 
                t.entrada === '07:00' && t.salida === '17:00'
              );
              if (turnoEspecial) {
                asignados.push({
                  employeeid: teleoperador.employeeid,
                  fecha: fechaStr,
                  hora_entrada: turnoEspecial.entrada
                });
              }
            }
            break;
            
          case 'Maria Valentina Diaz Hincapié':
            // Solo turnos de apertura o hasta 07:30
            const turnosValentina = turnosDisponibles.filter(t => 
              t.tipo === 'apertura' || t.entrada <= '07:30'
            );
            if (turnosValentina.length > 0) {
              const turno = turnosValentina[Math.floor(Math.random() * turnosValentina.length)];
              asignados.push({
                employeeid: teleoperador.employeeid,
                fecha: fechaStr,
                hora_entrada: turno.entrada
              });
            }
            break;
        }
      }
    });
    
    return asignados;
  }

  // Completar asignación normal
  private completarAsignacion(
    teleoperadores: Teleoperador[],
    turnosDisponibles: Turno[],
    yaAsignados: HorarioGenerado[],
    fecha: Date
  ): HorarioGenerado[] {
    const fechaStr = fecha.toISOString().split('T')[0];
    const asignaciones = [...yaAsignados];
    
    // Teleoperadores no asignados aún
    const yaAsignadosIds = new Set(yaAsignados.map(a => a.employeeid));
    const teleoperadoresNoAsignados = teleoperadores.filter(t => 
      !yaAsignadosIds.has(t.employeeid) && t.estado !== 'Licencia'
    );
    
    // Determinar cuántos necesitamos por turno
    const totalNecesarios = teleoperadoresNoAsignados.length;
    const necesariosApertura = Math.ceil(totalNecesarios * 0.2); // 20% apertura
    const necesariosCierre = Math.ceil(totalNecesarios * 0.2);   // 20% cierre
    const necesariosNormales = totalNecesarios - necesariosApertura - necesariosCierre;
    
    // Filtrar turnos por tipo
    const turnosApertura = turnosDisponibles.filter(t => t.tipo === 'apertura');
    const turnosCierre = turnosDisponibles.filter(t => t.tipo === 'cierre');
    const turnosNormales = turnosDisponibles.filter(t => t.tipo === 'normal');
    
    // Asignar apertura
    for (let i = 0; i < necesariosApertura && teleoperadoresNoAsignados.length > 0; i++) {
      const teleoperador = teleoperadoresNoAsignados.shift()!;
      const turno = turnosApertura[Math.floor(Math.random() * turnosApertura.length)];
      
      asignaciones.push({
        employeeid: teleoperador.employeeid,
        fecha: fechaStr,
        hora_entrada: turno.entrada
      });
    }
    
    // Asignar cierre
    for (let i = 0; i < necesariosCierre && teleoperadoresNoAsignados.length > 0; i++) {
      const teleoperador = teleoperadoresNoAsignados.shift()!;
      const turno = turnosCierre[Math.floor(Math.random() * turnosCierre.length)];
      
      asignaciones.push({
        employeeid: teleoperador.employeeid,
        fecha: fechaStr,
        hora_entrada: turno.entrada
      });
    }
    
    // Asignar normales
    for (let i = 0; i < necesariosNormales && teleoperadoresNoAsignados.length > 0; i++) {
      const teleoperador = teleoperadoresNoAsignados.shift()!;
      const turno = turnosNormales[Math.floor(Math.random() * turnosNormales.length)];
      
      asignaciones.push({
        employeeid: teleoperador.employeeid,
        fecha: fechaStr,
        hora_entrada: turno.entrada
      });
    }
    
    return asignaciones;
  }

  // Generar horarios completos
  async generarHorarios(): Promise<HorarioGenerado[]> {
    await this.cargarTeleoperadores();
    
    // Limpiar asignaciones previas
    this.asignaciones.clear();
    
    // Generar para cada día del rango
    const currentDate = new Date(this.fechaInicio);
    while (currentDate <= this.fechaFin) {
      this.asignarTurnosParaDia(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Aplicar regla de 5x2 y días libres
    this.aplicarReglas5x2();
    
    // Convertir Map a array
    const todosHorarios: HorarioGenerado[] = [];
    this.asignaciones.forEach(horarios => {
      todosHorarios.push(...horarios);
    });
    
    return todosHorarios;
  }

  // Aplicar regla de 5 días trabajados, 2 libres
  private aplicarReglas5x2() {
    this.asignaciones.forEach((horarios, employeeid) => {
      // Ordenar por fecha
      horarios.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      
      // Aplicar lógica de 5x2
      const nuevosHorarios = this.calcularDiasLibres(horarios);
      this.asignaciones.set(employeeid, nuevosHorarios);
    });
  }

  // Calcular días libres según reglas
  private calcularDiasLibres(horarios: HorarioGenerado[]): HorarioGenerado[] {
    // Implementar lógica compleja de asignación de días libres
    // Considerando: 5x2, máximo 6 días seguidos, 1 fin de semana libre al mes,
    // 2 domingos libres al mes, lunes siempre con dotación completa
    
    // Esta es una implementación simplificada - necesitarás expandirla
    const resultado: HorarioGenerado[] = [];
    let diasTrabajadosConsecutivos = 0;
    
    horarios.forEach(horario => {
      const fecha = new Date(horario.fecha);
      const diaSemana = fecha.getDay();
      
      // No trabajar lunes - siempre se trabaja
      if (diaSemana === 1) { // Lunes
        resultado.push(horario);
        diasTrabajadosConsecutivos++;
        return;
      }
      
      // Lógica simplificada de 5x2
      if (diasTrabajadosConsecutivos < 5) {
        resultado.push(horario);
        diasTrabajadosConsecutivos++;
      } else {
        // Marcar como libre
        resultado.push({
          ...horario,
          hora_entrada: "Libre"
        });
        if (diasTrabajadosConsecutivos >= 5) {
          diasTrabajadosConsecutivos = 0;
        }
      }
    });
    
    return resultado;
  }
}

// POST: Endpoint para generar horarios automáticos
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fecha_inicio, fecha_fin } = body;
    
    if (!fecha_inicio || !fecha_fin) {
      return NextResponse.json(
        { success: false, message: 'Fechas de inicio y fin requeridas' },
        { status: 400 }
      );
    }
    
    // Crear generador
    const generador = new GeneradorHorarios(fecha_inicio, fecha_fin);
    
    // Generar horarios
    const horariosGenerados = await generador.generarHorarios();
    
    // Guardar en base de datos
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Eliminar horarios existentes en el rango
      await client.query(
        'DELETE FROM horarios WHERE fecha::date >= $1::date AND fecha::date <= $2::date',
        [fecha_inicio, fecha_fin]
      );
      
      // Insertar nuevos horarios
      for (const horario of horariosGenerados) {
        await client.query(
          `INSERT INTO horarios (employeeid, fecha, hora_entrada, created_at)
           VALUES ($1, $2::date, $3, NOW())`,
          [horario.employeeid, horario.fecha, horario.hora_entrada]
        );
      }
      
      await client.query('COMMIT');
      
      return NextResponse.json({
        success: true,
        message: `Horarios generados exitosamente`,
        total: horariosGenerados.length,
        horarios: horariosGenerados.slice(0, 10) // Mostrar solo primeros 10 para preview
      });
      
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error: any) {
    console.error('Error al generar horarios:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error al generar horarios: ' + error.message 
      },
      { status: 500 }
    );
  }
}