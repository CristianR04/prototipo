import pool from '@/lib/db';
import { TipoJornada } from '../utils/types';

export interface ConfiguracionHorario {
  id: number;
  clave: string;
  valor: any;
  descripcion: string;
}

export interface ReglaSistema {
  diasTrabajo: number;
  diasLibres: number;
  maxConsecutivos: number;
  domingosMin: number;
  domingosMax: number;
  porcentajeApertura: number;
  porcentajeCierre: number;
  horasMaxSemanales: number;
  horasTrabajoDiario: number;
  horasPresenciaDiaria: number;
  domingosLibresPorEmpleado: number;
  finesSemanaLibres: number;
  horariosChileLV: any[];
  horariosColombiaLV: any[];
  horariosChileFS: any[];
  horariosColombiaFS: any[];
}

export interface CasoEspecial {
  id: number;
  nombre_empleado: string;
  employeeid: string;
  pais: string;
  reglas: any[];
  activo: boolean;
}

class ConfigService {
  private static instance: ConfigService;
  
  private constructor() {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  async obtenerConfiguracionCompleta(): Promise<{
    reglas: ReglaSistema;
    casos: CasoEspecial[];
  }> {
    const client = await pool.connect();
    
    try {
      // Obtener reglas
      const reglas = await this.obtenerReglasSistema();
      
      // Obtener casos especiales
      const casos = await this.obtenerCasosEspeciales();
      
      return { reglas, casos };
    } finally {
      client.release();
    }
  }

  async obtenerReglasSistema(): Promise<ReglaSistema> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT clave, valor 
        FROM configuracion_horarios 
        WHERE clave LIKE 'regla_%' 
           OR clave LIKE 'horario_%'
           OR clave LIKE 'fecha_%'
      `);

      const configMap = new Map<string, any>();
      
      result.rows.forEach((row: any) => {
        try {
          let valor = row.valor;
          if (typeof valor === 'string') {
            const trimmed = valor.trim();
            if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && 
                (trimmed.endsWith('}') || trimmed.endsWith(']'))) {
              valor = JSON.parse(valor);
            }
          }
          configMap.set(row.clave, valor);
        } catch (error) {
          console.warn(`Error parsing config ${row.clave}:`, error);
          configMap.set(row.clave, row.valor);
        }
      });

      return {
        diasTrabajo: parseInt(configMap.get('regla_dias_trabajo') || '5'),
        diasLibres: parseInt(configMap.get('regla_dias_libres') || '2'),
        maxConsecutivos: parseInt(configMap.get('regla_max_consecutivos') || '6'),
        domingosMin: parseInt(configMap.get('regla_domingos_min') || '16'),
        domingosMax: parseInt(configMap.get('regla_domingos_max') || '20'),
        porcentajeApertura: parseFloat(configMap.get('regla_porcentaje_apertura') || '0.2'),
        porcentajeCierre: parseFloat(configMap.get('regla_porcentaje_cierre') || '0.2'),
        horasMaxSemanales: parseInt(configMap.get('regla_44_horas') || '44'),
        horasTrabajoDiario: parseInt(configMap.get('regla_horas_trabajo_diario') || '9'),
        horasPresenciaDiaria: parseInt(configMap.get('regla_presencia_diaria') || '10'),
        domingosLibresPorEmpleado: parseInt(configMap.get('regla_domingos_libres') || '2'),
        finesSemanaLibres: parseInt(configMap.get('regla_fines_semana_libres') || '1'),
        horariosChileLV: Array.isArray(configMap.get('horario_chile_lv')) ? configMap.get('horario_chile_lv') : [],
        horariosColombiaLV: Array.isArray(configMap.get('horario_colombia_lv')) ? configMap.get('horario_colombia_lv') : [],
        horariosChileFS: Array.isArray(configMap.get('horario_chile_fs')) ? configMap.get('horario_chile_fs') : [],
        horariosColombiaFS: Array.isArray(configMap.get('horario_colombia_fs')) ? configMap.get('horario_colombia_fs') : []
      };
    } finally {
      client.release();
    }
  }

  async obtenerCasosEspeciales(): Promise<CasoEspecial[]> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT id, nombre_empleado, employeeid, pais, reglas, activo
        FROM casos_especiales 
        WHERE activo = true
        ORDER BY nombre_empleado
      `);

      return result.rows.map((row: any) => ({
        id: row.id,
        nombre_empleado: row.nombre_empleado,
        employeeid: row.employeeid,
        pais: row.pais,
        reglas: Array.isArray(row.reglas) ? row.reglas : 
               (row.reglas ? [row.reglas] : []),
        activo: row.activo
      }));
    } finally {
      client.release();
    }
  }

  async actualizarConfiguracion(
    tipo: 'regla' | 'horario' | 'fecha' | 'caso',
    data: any
  ): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      if (tipo === 'regla' || tipo === 'horario' || tipo === 'fecha') {
        const { clave, valor, descripcion } = data;
        
        const existe = await client.query(
          'SELECT id FROM configuracion_horarios WHERE clave = $1',
          [clave]
        );

        if (existe.rows.length > 0) {
          await client.query(`
            UPDATE configuracion_horarios 
            SET valor = $1, descripcion = $2, actualizado_en = NOW()
            WHERE clave = $3
          `, [JSON.stringify(valor), descripcion, clave]);
        } else {
          await client.query(`
            INSERT INTO configuracion_horarios (clave, valor, descripcion)
            VALUES ($1, $2, $3)
          `, [clave, JSON.stringify(valor), descripcion]);
        }
      } else if (tipo === 'caso') {
        const { id, nombre_empleado, employeeid, pais, reglas, activo = true } = data;

        if (id) {
          await client.query(`
            UPDATE casos_especiales 
            SET nombre_empleado = $1, employeeid = $2, pais = $3, 
                reglas = $4, activo = $5, actualizado_en = NOW()
            WHERE id = $6
          `, [nombre_empleado, employeeid, pais, JSON.stringify(reglas), activo, id]);
        } else {
          await client.query(`
            INSERT INTO casos_especiales (nombre_empleado, employeeid, pais, reglas, activo)
            VALUES ($1, $2, $3, $4, $5)
          `, [nombre_empleado, employeeid, pais, JSON.stringify(reglas), activo]);
        }
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export default ConfigService.getInstance();