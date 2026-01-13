import { TipoJornada } from '../utils/types';
import configService, { CasoEspecial } from './configService';

export class RulesService {
  private static instance: RulesService;
  
  private constructor() {}

  static getInstance(): RulesService {
    if (!RulesService.instance) {
      RulesService.instance = new RulesService();
    }
    return RulesService.instance;
  }

  async aplicarReglasEspeciales(
    employeeid: string,
    nombre: string,
    pais: string,
    fecha: Date,
    horarioPropuesto: { horaEntrada: string; tipoJornada: TipoJornada }
  ): Promise<{ horaEntrada: string; tipoJornada: TipoJornada }> {
    const { casos } = await configService.obtenerConfiguracionCompleta();
    
    // Buscar caso especial para este empleado
    const casoEspecial = casos.find(c => 
      (c.employeeid === employeeid || c.nombre_empleado === nombre) && 
      c.pais === pais.toLowerCase()
    );

    if (!casoEspecial) {
      return horarioPropuesto;
    }

    // IMPORTANTE: Las reglas especiales solo ajustan horarios, no crean días libres
    return this.procesarReglasCasoEspecial(casoEspecial, fecha, horarioPropuesto);
  }

  private procesarReglasCasoEspecial(
    caso: CasoEspecial,
    fecha: Date,
    horario: { horaEntrada: string; tipoJornada: TipoJornada }
  ): { horaEntrada: string; tipoJornada: TipoJornada } {
    const diaSemana = fecha.getDay();
    const hora = horario.horaEntrada === 'Libre' ? 8 : parseInt(horario.horaEntrada.split(':')[0]);

    // Ejemplo de reglas que solo ajustan horarios, NO crean días libres
    for (const regla of caso.reglas) {
      if (regla.tipo === 'rango_horas') {
        if (hora < regla.min) {
          // Ajustar a mínimo permitido, pero NUNCA a "Libre"
          return {
            ...horario,
            horaEntrada: `${regla.min.toString().padStart(2, '0')}:00`
          };
        } else if (hora > regla.max) {
          // Ajustar a máximo permitido
          return {
            ...horario,
            horaEntrada: `${regla.max.toString().padStart(2, '0')}:00`
          };
        }
      } else if (regla.tipo === 'turno_fijo') {
        return {
          ...horario,
          horaEntrada: regla.hora_entrada || '08:00',
          tipoJornada: regla.tipo_jornada || 'normal'
        };
      } else if (regla.tipo === 'dias_especificos') {
        // Aplicar solo en días específicos
        const diasAplicar = regla.dias || [];
        if (diasAplicar.includes(diaSemana)) {
          return {
            ...horario,
            horaEntrada: regla.hora_entrada || horario.horaEntrada
          };
        }
      }
    }

    return horario;
  }

  async validarHorasSemanales(
    employeeid: string,
    semanaNumero: number,
    fechaActual: Date,
    horarios: Array<{ employeeid: string; fecha: string; es_dia_libre: boolean; es_dia_reducido?: boolean }>
  ): Promise<boolean> {
    const { reglas } = await configService.obtenerConfiguracionCompleta();
    
    // Calcular horas trabajadas en la semana actual hasta este día
    const inicioSemana = this.startOfWeek(fechaActual);
    const diasSemana = this.eachDayOfInterval({
      start: inicioSemana,
      end: fechaActual
    });

    let horasTrabajadas = 0;

    for (const dia of diasSemana) {
      const fechaStr = dia.toISOString().split('T')[0];
      const horario = horarios.find(h =>
        h.employeeid === employeeid &&
        h.fecha === fechaStr &&
        !h.es_dia_libre
      );

      if (horario) {
        horasTrabajadas += horario.es_dia_reducido ? 8 : 9;
      }
    }

    // Verificar si necesita día reducido para cumplir límite semanal
    const esViernes = fechaActual.getDay() === 5;
    const horasMaximas = reglas.horasMaxSemanales;

    return esViernes && horasTrabajadas >= (horasMaximas - 8);
  }

  // Helper methods
  private startOfWeek(date: Date): Date {
    const day = date.getDay();
    const diff = (day < 1 ? 7 : 0) + day - 1;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - diff);
  }

  private eachDayOfInterval({ start, end }: { start: Date; end: Date }): Date[] {
    const days: Date[] = [];
    let current = new Date(start);
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  getWeekNumber(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
  }
}

export default RulesService.getInstance();