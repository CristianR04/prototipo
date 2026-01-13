import pool from '@/lib/db';

interface ReporteDiario {
  fecha: string;
  diaSemana: string;
  totalEmpleados: number;
  trabajando: number;
  libres: number;
  porcentajeOcupacion: number;
}

interface ReporteHoras {
  hora: string;
  cantidad: number;
  porcentaje: number;
}

interface ReporteJornadas {
  tipo_jornada: string;
  cantidad: number;
  porcentaje: number;
}

interface ReportePais {
  pais: string;
  trabajando: number;
  libres: number;
  total: number;
}

class ReporteService {
  private static instance: ReporteService;
  
  private constructor() {}

  static getInstance(): ReporteService {
    if (!ReporteService.instance) {
      ReporteService.instance = new ReporteService();
    }
    return ReporteService.instance;
  }

  async obtenerReporteDiario(fecha_inicio: string, fecha_fin: string): Promise<ReporteDiario[]> {
    const client = await pool.connect();
    
    try {
      const query = `
        WITH empleados_por_fecha AS (
          SELECT 
            h.fecha::date as fecha,
            TO_CHAR(h.fecha, 'Dy') as dia_semana,
            COUNT(DISTINCT h.employeeid) as total_empleados,
            COUNT(DISTINCT CASE WHEN h.hora_entrada IS NOT NULL THEN h.employeeid END) as trabajando,
            COUNT(DISTINCT CASE WHEN h.hora_entrada IS NULL THEN h.employeeid END) as libres
          FROM horarios h
          WHERE h.fecha::date >= $1::date 
            AND h.fecha::date <= $2::date
          GROUP BY h.fecha::date
          ORDER BY h.fecha::date
        )
        SELECT 
          fecha,
          dia_semana,
          total_empleados,
          trabajando,
          libres,
          ROUND((trabajando::decimal / NULLIF(total_empleados, 0)) * 100, 2) as porcentaje_ocupacion
        FROM empleados_por_fecha
      `;

      const result = await client.query(query, [fecha_inicio, fecha_fin]);

      return result.rows.map((row: any) => ({
        fecha: row.fecha.toISOString().split('T')[0],
        diaSemana: this.formatearDiaSemana(row.dia_semana),
        totalEmpleados: parseInt(row.total_empleados),
        trabajando: parseInt(row.trabajando),
        libres: parseInt(row.libres),
        porcentajeOcupacion: parseFloat(row.porcentaje_ocupacion) || 0
      }));
    } finally {
      client.release();
    }
  }

  async obtenerReporteHoras(fecha_inicio: string, fecha_fin: string): Promise<ReporteHoras[]> {
    const client = await pool.connect();
    
    try {
      const query = `
        WITH total_registros AS (
          SELECT COUNT(*) as total FROM horarios 
          WHERE fecha::date >= $1::date 
            AND fecha::date <= $2::date
            AND hora_entrada IS NOT NULL
        ),
        horas_agrupadas AS (
          SELECT 
            hora_entrada as hora,
            COUNT(*) as cantidad
          FROM horarios 
          WHERE fecha::date >= $1::date 
            AND fecha::date <= $2::date
            AND hora_entrada IS NOT NULL
          GROUP BY hora_entrada
          ORDER BY hora_entrada
        )
        SELECT 
          h.hora,
          h.cantidad,
          ROUND((h.cantidad::decimal / NULLIF(t.total, 0)) * 100, 2) as porcentaje
        FROM horas_agrupadas h
        CROSS JOIN total_registros t
      `;

      const result = await client.query(query, [fecha_inicio, fecha_fin]);

      return result.rows.map((row: any) => ({
        hora: row.hora.substring(0, 5), // Extraer solo HH:MM
        cantidad: parseInt(row.cantidad),
        porcentaje: parseFloat(row.porcentaje) || 0
      }));
    } finally {
      client.release();
    }
  }

  async obtenerReporteJornadas(fecha_inicio: string, fecha_fin: string): Promise<ReporteJornadas[]> {
    const client = await pool.connect();
    
    try {
      const query = `
        WITH total_registros AS (
          SELECT COUNT(*) as total FROM horarios 
          WHERE fecha::date >= $1::date 
            AND fecha::date <= $2::date
        ),
        jornadas_agrupadas AS (
          SELECT 
            COALESCE(tipo_jornada, 'libre') as tipo_jornada,
            COUNT(*) as cantidad
          FROM horarios 
          WHERE fecha::date >= $1::date 
            AND fecha::date <= $2::date
          GROUP BY tipo_jornada
          ORDER BY tipo_jornada
        )
        SELECT 
          j.tipo_jornada,
          j.cantidad,
          ROUND((j.cantidad::decimal / NULLIF(t.total, 0)) * 100, 2) as porcentaje
        FROM jornadas_agrupadas j
        CROSS JOIN total_registros t
      `;

      const result = await client.query(query, [fecha_inicio, fecha_fin]);

      return result.rows.map((row: any) => ({
        tipo_jornada: this.formatearTipoJornada(row.tipo_jornada),
        cantidad: parseInt(row.cantidad),
        porcentaje: parseFloat(row.porcentaje) || 0
      }));
    } finally {
      client.release();
    }
  }

  async obtenerReportePaises(fecha_inicio: string, fecha_fin: string): Promise<ReportePais[]> {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          COALESCE(u.pais, 'No especificado') as pais,
          COUNT(DISTINCT h.employeeid) as total,
          COUNT(DISTINCT CASE WHEN h.hora_entrada IS NOT NULL THEN h.employeeid END) as trabajando,
          COUNT(DISTINCT CASE WHEN h.hora_entrada IS NULL THEN h.employeeid END) as libres
        FROM horarios h
        LEFT JOIN usuarios u ON h.employeeid = u.employeeid
        WHERE h.fecha::date >= $1::date 
          AND h.fecha::date <= $2::date
        GROUP BY u.pais
        ORDER BY trabajando DESC
      `;

      const result = await client.query(query, [fecha_inicio, fecha_fin]);

      return result.rows.map((row: any) => ({
        pais: row.pais || 'No especificado',
        trabajando: parseInt(row.trabajando),
        libres: parseInt(row.libres),
        total: parseInt(row.total)
      }));
    } finally {
      client.release();
    }
  }

  async obtenerReporteResumen(fecha_inicio: string, fecha_fin: string) {
    const client = await pool.connect();
    
    try {
      const query = `
        WITH datos_generales AS (
          SELECT 
            COUNT(DISTINCT h.employeeid) as total_empleados,
            COUNT(DISTINCT h.fecha) as total_dias,
            COUNT(*) as total_registros,
            COUNT(CASE WHEN h.hora_entrada IS NOT NULL THEN 1 END) as total_trabajando,
            COUNT(CASE WHEN h.hora_entrada IS NULL THEN 1 END) as total_libres
          FROM horarios h
          WHERE h.fecha::date >= $1::date 
            AND h.fecha::date <= $2::date
        ),
        horas_populares AS (
          SELECT 
            hora_entrada as hora,
            COUNT(*) as cantidad
          FROM horarios 
          WHERE fecha::date >= $1::date 
            AND fecha::date <= $2::date
            AND hora_entrada IS NOT NULL
          GROUP BY hora_entrada
          ORDER BY cantidad DESC
          LIMIT 5
        )
        SELECT 
          d.total_empleados,
          d.total_dias,
          d.total_registros,
          d.total_trabajando,
          d.total_libres,
          ROUND((d.total_trabajando::decimal / NULLIF(d.total_registros, 0)) * 100, 2) as porcentaje_ocupacion,
          ARRAY_AGG(JSON_BUILD_OBJECT('hora', hp.hora, 'cantidad', hp.cantidad)) as horas_mas_comunes
        FROM datos_generales d
        CROSS JOIN horas_populares hp
        GROUP BY 
          d.total_empleados,
          d.total_dias,
          d.total_registros,
          d.total_trabajando,
          d.total_libres
      `;

      const result = await client.query(query, [fecha_inicio, fecha_fin]);

      return result.rows[0] || {};
    } finally {
      client.release();
    }
  }

  private formatearDiaSemana(dia: string): string {
    const dias: Record<string, string> = {
      'Mon': 'Lunes',
      'Tue': 'Martes',
      'Wed': 'Miércoles',
      'Thu': 'Jueves',
      'Fri': 'Viernes',
      'Sat': 'Sábado',
      'Sun': 'Domingo'
    };
    return dias[dia] || dia;
  }

  private formatearTipoJornada(tipo: string): string {
    const jornadas: Record<string, string> = {
      'normal': 'Normal',
      'entrada_tardia': 'Entrada Tardía',
      'salida_temprana': 'Salida Temprana',
      'apertura': 'Apertura',
      'cierre': 'Cierre',
      'libre': 'Libre'
    };
    return jornadas[tipo] || tipo;
  }
}

export default ReporteService.getInstance();