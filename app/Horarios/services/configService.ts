// app/Horarios/services/configService.ts - VERSIÓN CORREGIDA
import pool from '@/lib/db';
import { TipoJornada } from '../utils/types';

export interface HorarioConfig {
  tipo: string; // 'apertura', 'normal', 'cierre'
  entrada: string; // '08:00'
  salida: string; // '18:00'
  horasTrabajo: number;
  horasPresencia: number;
}

export interface ReglaSistema {
  // Reglas generales
  diasTrabajo: number;
  diasLibres: number;
  maxConsecutivos: number;
  domingosMin: number;
  domingosMax: number;

  // Porcentajes de distribución
  porcentajeApertura: number;
  porcentajeCierre: number;

  // Horas
  horasMaxSemanales: number;
  horasTrabajoDiario: number;
  horasPresenciaDiaria: number;

  // Días libres
  domingosLibresPorEmpleado: number;
  finesSemanaLibres: number;

  // Configuración de horarios por país y tipo de día
  horariosChileLV: HorarioConfig[];
  horariosChileFS: HorarioConfig[];
  horariosColombiaLV: HorarioConfig[];
  horariosColombiaFS: HorarioConfig[];

  // Configuración de distribución (nuevo)
  configDistribucion: {
    apertura_chile_min: string;
    apertura_chile_max: string;
    apertura_colombia_min: string;
    apertura_colombia_max: string;
    cierre_chile: string;
    cierre_colombia: string;
  };
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

  private constructor() { }

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
      // Inicializar configuración básica si no existe
      await this.inicializarConfiguracionBasica();

      // Obtener reglas con todos los horarios
      const reglas = await this.obtenerReglasSistemaCompletas();

      // Obtener casos especiales
      const casos = await this.obtenerCasosEspeciales();

      return { reglas, casos };
    } finally {
      client.release();
    }
  }

  async obtenerReglasSistemaCompletas(): Promise<ReglaSistema> {
    const client = await pool.connect();

    try {
      // Obtener TODAS las configuraciones
      const result = await client.query(`
        SELECT clave, valor, descripcion
        FROM configuracion_horarios 
        ORDER BY clave
      `);

      const configMap = new Map<string, { valor: any, descripcion: string }>();

      result.rows.forEach((row: any) => {
        try {
          let valor = row.valor;
          // Si el valor es string, intentar parsear como JSON
          if (typeof valor === 'string') {
            const trimmed = valor.trim();
            // Verificar si parece JSON
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
              (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
              (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
              try {
                valor = JSON.parse(trimmed);
              } catch (e) {
                // Si falla, mantener como string
                console.log(`⚠️ No se pudo parsear ${row.clave} como JSON:`, trimmed);
              }
            }
          }
          configMap.set(row.clave, { valor, descripcion: row.descripcion || '' });
        } catch (error) {
          console.warn(`Error procesando config ${row.clave}:`, error);
          configMap.set(row.clave, { valor: row.valor, descripcion: row.descripcion || '' });
        }
      });

      // Función para obtener horarios
      const obtenerHorarios = (clave: string): HorarioConfig[] => {
        const item = configMap.get(clave);
        if (!item) return [];

        let valor = item.valor;

        // Si es string, intentar parsear
        if (typeof valor === 'string') {
          try {
            valor = JSON.parse(valor);
          } catch {
            return [];
          }
        }

        if (!Array.isArray(valor)) {
          return [];
        }

        return valor.map((h: any) => ({
          tipo: h.tipo || 'normal',
          entrada: h.entrada || '08:00',
          salida: h.salida || '18:00',
          horasTrabajo: typeof h.horasTrabajo === 'number' ? h.horasTrabajo :
            h.horasTrabajo ? parseInt(h.horasTrabajo) : 9,
          horasPresencia: typeof h.horasPresencia === 'number' ? h.horasPresencia :
            h.horasPresencia ? parseInt(h.horasPresencia) : 10
        }));
      };

      // Función para obtener valor numérico
      const obtenerValorNumerico = (clave: string, defaultValue: number): number => {
        const item = configMap.get(clave);
        if (!item) return defaultValue;

        let valor = item.valor;

        // Si es string con comillas dobles
        if (typeof valor === 'string' && valor.startsWith('"') && valor.endsWith('"')) {
          valor = valor.slice(1, -1);
        }

        // Convertir a número
        const num = parseFloat(valor);
        return isNaN(num) ? defaultValue : num;
      };

      // Función para obtener valor de texto/string
      const obtenerValorTexto = (clave: string, defaultValue: string): string => {
        const item = configMap.get(clave);
        if (!item) return defaultValue;

        let valor = item.valor;

        if (typeof valor === 'string') {
          // Si tiene comillas dobles, quitarlas
          if (valor.startsWith('"') && valor.endsWith('"')) {
            return valor.slice(1, -1);
          }
          return valor;
        }

        return defaultValue;
      };

      // Obtener horarios de la BD
      const horariosChileLV = obtenerHorarios('horario_chile_lv');
      const horariosChileFS = obtenerHorarios('horario_chile_fs');
      const horariosColombiaLV = obtenerHorarios('horario_colombia_lv');
      const horariosColombiaFS = obtenerHorarios('horario_colombia_fs');

      // Calcular distribución automáticamente desde los horarios
      const calcularDistribucionDesdeHorarios = (horarios: HorarioConfig[], pais: string) => {
        let aperturaMin = '08:00';
        let aperturaMax = '10:00';
        let cierre = '12:00';

        if (horarios.length > 0) {
          // Encontrar horarios de apertura
          const aperturas = horarios.filter(h => h.tipo === 'apertura');
          if (aperturas.length > 0) {
            const horasApertura = aperturas.map(h => parseInt(h.entrada.split(':')[0]));
            aperturaMin = Math.min(...horasApertura).toString().padStart(2, '0') + ':00';
            aperturaMax = Math.max(...horasApertura).toString().padStart(2, '0') + ':00';
          } else {
            // Si no hay aperturas, usar el horario más temprano
            const horas = horarios.map(h => parseInt(h.entrada.split(':')[0]));
            aperturaMin = Math.min(...horas).toString().padStart(2, '0') + ':00';
            aperturaMax = (Math.min(...horas) + 2).toString().padStart(2, '0') + ':00';
          }

          // Encontrar horarios de cierre - CORRECCIÓN AQUÍ
          const cierres = horarios.filter(h => h.tipo === 'cierre');
          if (cierres.length > 0) {  // <-- Usar 'cierres' no 'cierre'
            const horaCierre = parseInt(cierres[0].entrada.split(':')[0]);  // <-- Usar 'cierres[0]'
            cierre = horaCierre.toString().padStart(2, '0') + ':00';
          }
        }

        // Ajustar para Colombia (2 horas menos)
        if (pais === 'colombia') {
          const ajustarHora = (hora: string, ajuste: number) => {
            const [h, m] = hora.split(':').map(Number);
            const nuevaHora = h - ajuste;
            return nuevaHora.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0');
          };

          return {
            apertura_min: ajustarHora(aperturaMin, 2),
            apertura_max: ajustarHora(aperturaMax, 2),
            cierre: ajustarHora(cierre, 2)
          };
        }

        return { apertura_min: aperturaMin, apertura_max: aperturaMax, cierre };
      };

      // Calcular distribución para cada país
      const distribucionChile = calcularDistribucionDesdeHorarios(horariosChileLV, 'chile');
      const distribucionColombia = calcularDistribucionDesdeHorarios(horariosColombiaLV, 'colombia');

      return {
        // Reglas numéricas
        diasTrabajo: obtenerValorNumerico('regla_dias_trabajo', 5),
        diasLibres: obtenerValorNumerico('regla_dias_libres', 2),
        maxConsecutivos: obtenerValorNumerico('regla_max_consecutivos', 6),
        domingosMin: obtenerValorNumerico('regla_domingos_min', 16),
        domingosMax: obtenerValorNumerico('regla_domingos_max', 20),

        // Porcentajes
        porcentajeApertura: obtenerValorNumerico('regla_porcentaje_apertura', 0.2),
        porcentajeCierre: obtenerValorNumerico('regla_porcentaje_cierre', 0.2),

        // Horas
        horasMaxSemanales: obtenerValorNumerico('regla_44_horas', 44),
        horasTrabajoDiario: obtenerValorNumerico('regla_horas_trabajo_diario', 9),
        horasPresenciaDiaria: obtenerValorNumerico('regla_presencia_diaria', 10),

        // Días libres
        domingosLibresPorEmpleado: obtenerValorNumerico('regla_domingos_libres', 2),
        finesSemanaLibres: obtenerValorNumerico('regla_fines_semana_libres', 1),

        // Horarios
        horariosChileLV,
        horariosChileFS,
        horariosColombiaLV,
        horariosColombiaFS,

        // Configuración de distribución (calculada automáticamente)
        configDistribucion: {
          apertura_chile_min: distribucionChile.apertura_min,
          apertura_chile_max: distribucionChile.apertura_max,
          apertura_colombia_min: distribucionColombia.apertura_min,
          apertura_colombia_max: distribucionColombia.apertura_max,
          cierre_chile: distribucionChile.cierre,
          cierre_colombia: distribucionColombia.cierre
        }
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
        employeeid: row.employeeid || '',
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

        if (!clave) {
          throw new Error('Clave es requerida');
        }

        // Preparar valor para almacenar
        let valorParaGuardar = valor;

        // Si el valor es un objeto o array, convertirlo a JSON string
        if (typeof valor === 'object' || Array.isArray(valor)) {
          valorParaGuardar = JSON.stringify(valor);
        }

        // Verificar si la clave ya existe
        const existe = await client.query(
          'SELECT id FROM configuracion_horarios WHERE clave = $1',
          [clave]
        );

        if (existe.rows.length > 0) {
          await client.query(`
            UPDATE configuracion_horarios 
            SET valor = $1, 
                descripcion = COALESCE($2, descripcion), 
                actualizado_en = NOW()
            WHERE clave = $3
          `, [valorParaGuardar, descripcion, clave]);
        } else {
          await client.query(`
            INSERT INTO configuracion_horarios (clave, valor, descripcion)
            VALUES ($1, $2, $3)
          `, [clave, valorParaGuardar, descripcion || '']);
        }
      } else if (tipo === 'caso') {
        const { id, nombre_empleado, employeeid, pais, reglas, activo = true } = data;

        if (id) {
          await client.query(`
            UPDATE casos_especiales 
            SET nombre_empleado = $1, 
                employeeid = $2, 
                pais = $3, 
                reglas = $4, 
                activo = $5, 
                actualizado_en = NOW()
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

  async inicializarConfiguracionBasica(): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verificar si ya existe configuración básica
      const existe = await client.query(
        "SELECT 1 FROM configuracion_horarios WHERE clave = 'regla_dias_trabajo' LIMIT 1"
      );

      if (existe.rows.length === 0) {
        console.log('⚙️ Inicializando configuración básica...');

        // Insertar configuración básica que falta
        const configs = [
          // Solo agregar configs que no existen
          ['regla_reduccion_semanal', '"Reducir 1 hora trabajada en la semana"', 'Reducción para cumplir límite legal']
        ];

        for (const [clave, valor, descripcion] of configs) {
          await client.query(`
            INSERT INTO configuracion_horarios (clave, valor, descripcion)
            VALUES ($1, $2, $3)
            ON CONFLICT (clave) DO NOTHING
          `, [clave, valor, descripcion]);
        }

        console.log('✅ Configuración verificada');
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async obtenerConfiguracion(clave: string): Promise<any> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        'SELECT valor FROM configuracion_horarios WHERE clave = $1',
        [clave]
      );

      if (result.rows.length === 0) return null;

      const valor = result.rows[0].valor;
      if (typeof valor === 'string') {
        try {
          return JSON.parse(valor);
        } catch {
          // Si tiene comillas dobles, quitarlas
          if (valor.startsWith('"') && valor.endsWith('"')) {
            return valor.slice(1, -1);
          }
          return valor;
        }
      }
      return valor;
    } finally {
      client.release();
    }
  }

  async eliminarConfiguracion(clave: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        'DELETE FROM configuracion_horarios WHERE clave = $1 RETURNING id',
        [clave]
      );

      await client.query('COMMIT');
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async eliminarCasoEspecial(id: number): Promise<boolean> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        'DELETE FROM casos_especiales WHERE id = $1 RETURNING id',
        [id]
      );

      await client.query('COMMIT');
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export default ConfigService.getInstance();