import pool from '@/lib/db';
import { TipoJornada } from '../utils/types';
import { calcularHorasSegunJornada } from '../utils/calculations';
import configService from './configService';
import rulesService from './rulesService';

interface HorarioRequest {
    employeeid: string;
    fecha: string;
    hora_entrada: string;
    tipo_jornada?: TipoJornada;
}

interface HorarioGenerado {
    employeeid: string;
    fecha: string;
    hora_entrada: string | null;
    tipo_jornada: TipoJornada;
    campana_id: number;
    es_dia_libre: boolean;
    es_dia_reducido?: boolean;
    semana_numero: number;
}

class HorarioService {
    private static instance: HorarioService;

    private constructor() { }

    static getInstance(): HorarioService {
        if (!HorarioService.instance) {
            HorarioService.instance = new HorarioService();
        }
        return HorarioService.instance;
    }

    async obtenerHorarios(
        fecha_inicio?: string,
        fecha_fin?: string,
        employeeid?: string
    ) {
        const client = await pool.connect();

        try {
            let query = `
        SELECT 
          h.id,
          h.employeeid,
          h.fecha::date::text as fecha,
          h.hora_entrada,
          h.hora_salida,
          h.break_1,
          h.colacion,
          h.break_2,
          h.campana_id,
          h.tipo_jornada,
          u.nombre,
          c.campana
        FROM horarios h
        LEFT JOIN usuarios u ON h.employeeid = u.employeeid
        LEFT JOIN campana c ON h.campana_id = c.id
      `;

            const params: any[] = [];
            let whereConditions: string[] = [];

            if (fecha_inicio && fecha_fin) {
                params.push(fecha_inicio, fecha_fin);
                whereConditions.push(`h.fecha::date >= $${params.length - 1}::date`);
                whereConditions.push(`h.fecha::date <= $${params.length}::date`);
            }

            if (employeeid) {
                params.push(employeeid);
                whereConditions.push(`h.employeeid = $${params.length}`);
            }

            if (whereConditions.length > 0) {
                query += ` WHERE ${whereConditions.join(' AND ')}`;
            }

            query += ` ORDER BY h.employeeid, h.fecha`;

            const result = await client.query(query, params);
            return result.rows;
        } finally {
            client.release();
        }
    }

    async guardarHorarios(horarios: HorarioRequest[]) {
        const client = await pool.connect();

        try {
            if (!horarios || horarios.length === 0) {
                throw new Error('No hay datos para guardar');
            }

            await client.query('BEGIN');

            // 1. Obtener rango de fechas
            const fechas = horarios.map(h => h.fecha);
            const fecha_inicio = fechas.sort()[0];
            const fecha_fin = fechas.sort()[fechas.length - 1];

            // 2. Obtener horarios existentes
            const existingQuery = `
        SELECT id, employeeid, fecha::date as fecha, 
               hora_entrada, hora_salida, break_1, colacion, break_2, 
               campana_id, tipo_jornada
        FROM horarios 
        WHERE fecha::date >= $1::date 
        AND fecha::date <= $2::date
      `;

            const existingResult = await client.query(existingQuery, [fecha_inicio, fecha_fin]);
            const existingHorarios = existingResult.rows;

            // Crear mapa para acceso rápido
            const existingMap = new Map();
            existingHorarios.forEach(h => {
                const key = `${h.employeeid}_${h.fecha.toISOString().split('T')[0]}`;
                existingMap.set(key, h);
            });

            // 3. Procesar cada horario
            let insertados = 0;
            let actualizados = 0;
            let conservados = 0;
            let errores = 0;

            for (const h of horarios) {
                try {
                    // Obtener campana_id del usuario
                    const usuarioRes = await client.query(
                        "SELECT campana_id FROM usuarios WHERE employeeid = $1",
                        [h.employeeid]
                    );

                    if (usuarioRes.rows.length === 0) {
                        console.warn(`⚠️ Usuario no encontrado: ${h.employeeid}`);
                        errores++;
                        continue;
                    }

                    const campana_id = usuarioRes.rows[0]?.campana_id || 1;
                    const tipoJornada: TipoJornada = h.tipo_jornada || "normal";
                    const horaEntrada = h.hora_entrada === "Libre" || h.hora_entrada === "" ? null : h.hora_entrada;

                    // Calcular horas automáticas
                    const horasCalculadas = calcularHorasSegunJornada(horaEntrada, tipoJornada);

                    // Clave única
                    const key = `${h.employeeid}_${h.fecha}`;
                    const existing = existingMap.get(key);

                    if (existing) {
                        // Verificar si debe actualizarse
                        const debeActualizar = (
                            horaEntrada !== existing.hora_entrada ||
                            tipoJornada !== existing.tipo_jornada
                        );

                        if (debeActualizar) {
                            // Actualizar con nueva hora de entrada
                            const updateQuery = `
                UPDATE horarios 
                SET hora_entrada = $1, 
                    break_1 = $2,
                    colacion = $3,
                    break_2 = $4,
                    hora_salida = $5,
                    campana_id = $6,
                    tipo_jornada = $7,
                    updated_at = NOW()
                WHERE id = $8
              `;

                            await client.query(updateQuery, [
                                horaEntrada,
                                horasCalculadas.break1,
                                horasCalculadas.colacion,
                                horasCalculadas.break2,
                                horasCalculadas.hora_salida,
                                campana_id,
                                tipoJornada,
                                existing.id
                            ]);

                            actualizados++;
                        } else {
                            conservados++;
                        }
                    } else {
                        // Nuevo registro
                        const insertQuery = `
              INSERT INTO horarios (
                employeeid, 
                fecha, 
                hora_entrada, 
                break_1,
                colacion,
                break_2,
                hora_salida,
                campana_id, 
                tipo_jornada,
                created_at
              )
              VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, NOW())
            `;

                        await client.query(insertQuery, [
                            h.employeeid,
                            h.fecha,
                            horaEntrada,
                            horasCalculadas.break1,
                            horasCalculadas.colacion,
                            horasCalculadas.break2,
                            horasCalculadas.hora_salida,
                            campana_id,
                            tipoJornada
                        ]);

                        insertados++;
                    }

                } catch (error: any) {
                    console.error(`❌ Error procesando ${h.employeeid} - ${h.fecha}:`, error.message);
                    errores++;
                }
            }

            await client.query('COMMIT');

            return {
                insertados,
                actualizados,
                conservados,
                errores
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async generarHorariosAutomaticos(meses: number = 2) {
        const client = await pool.connect();

        try {
            console.log(`🚀 Iniciando generación para ${meses} meses...`);

            // Obtener configuración del sistema
            const { reglas, casos } = await configService.obtenerConfiguracionCompleta();

            // Obtener empleados
            const queryUsuarios = `
        SELECT 
          u.employeeid,
          u.nombre,
          u.campana_id,
          u.pais,
          c.campana
        FROM usuarios u
        LEFT JOIN campana c ON u.campana_id = c.id
        WHERE u.pais IS NOT NULL AND u.pais IN ('chile', 'colombia')
        ORDER BY u.employeeid
      `;

            const usuariosResult = await client.query(queryUsuarios);

            if (usuariosResult.rows.length === 0) {
                throw new Error('No hay empleados para generar horarios');
            }

            // Determinar rango de fechas: desde el primer día del mes actual
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            // Comenzar desde el primer día del mes actual
            const fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

            // Calcular fecha fin: N meses después, último día del mes
            const fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() + meses, 0);
            fechaFin.setHours(23, 59, 59, 999);

            console.log(`📅 Rango de generación: ${fechaInicio.toISOString().split('T')[0]} a ${fechaFin.toISOString().split('T')[0]}`);

            await client.query('BEGIN');

            // Eliminar horarios futuros existentes
            const deleteQuery = `
        DELETE FROM horarios 
        WHERE fecha::date >= $1::date 
        AND fecha::date <= $2::date
        RETURNING id
      `;

            const deleteResult = await client.query(deleteQuery, [
                fechaInicio.toISOString().split('T')[0],
                fechaFin.toISOString().split('T')[0]
            ]);

            console.log(`🗑️ Eliminados ${deleteResult.rowCount} registros existentes`);

            // Generar horarios
            const horariosGenerados = await this.generarHorariosConReglas(
                usuariosResult.rows,
                fechaInicio,
                fechaFin,
                reglas,
                casos
            );

            // Guardar horarios generados
            let insertados = 0;
            let errores = 0;

            for (const horario of horariosGenerados) {
                try {
                    // CORRECCIÓN: Declarar con el tipo correcto de calcularHorasSegunJornada
                    let horasCalculadas: {
                        break1: string | null;
                        colacion: string | null;
                        break2: string | null;
                        hora_salida: string | null;
                    };

                    // Solo calcular horas si hay hora de entrada
                    if (horario.hora_entrada && horario.hora_entrada !== 'Libre') {
                        horasCalculadas = calcularHorasSegunJornada(
                            horario.hora_entrada,
                            horario.tipo_jornada,
                            horario.es_dia_reducido || false
                        );
                    } else {
                        // Inicializar con nulls cuando no hay horario
                        horasCalculadas = {
                            break1: null,
                            colacion: null,
                            break2: null,
                            hora_salida: null
                        };
                    }

                    const insertQuery = `
                        INSERT INTO horarios (
                            employeeid, 
                            fecha, 
                            hora_entrada, 
                            break_1,
                            colacion,
                            break_2,
                            hora_salida,
                            campana_id, 
                            tipo_jornada,
                            created_at
                        )
                        VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, NOW())
                        ON CONFLICT (employeeid, fecha) 
                        DO UPDATE SET
                            hora_entrada = EXCLUDED.hora_entrada,
                            break_1 = EXCLUDED.break_1,
                            colacion = EXCLUDED.colacion,
                            break_2 = EXCLUDED.break_2,
                            hora_salida = EXCLUDED.hora_salida,
                            campana_id = EXCLUDED.campana_id,
                            tipo_jornada = EXCLUDED.tipo_jornada,
                            updated_at = NOW()
                        `;

                    await client.query(insertQuery, [
                        horario.employeeid,
                        horario.fecha,
                        horario.hora_entrada,
                        horasCalculadas.break1,
                        horasCalculadas.colacion,
                        horasCalculadas.break2,
                        horasCalculadas.hora_salida,
                        horario.campana_id || 1,
                        horario.tipo_jornada
                    ]);

                    insertados++;
                } catch (error: any) {
                    console.error(`Error insertando horario ${horario.employeeid} - ${horario.fecha}:`, error.message);
                    errores++;
                }
            }

            await client.query('COMMIT');

            // Verificar que todos los días tienen cobertura
            const cobertura = await this.verificarCoberturaDiaria(client, fechaInicio, fechaFin);

            return {
                totalEmpleados: usuariosResult.rows.length,
                diasGenerados: Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1,
                horariosGenerados: horariosGenerados.length,
                insertados,
                errores,
                cobertura,
                rango: {
                    inicio: fechaInicio.toISOString().split('T')[0],
                    fin: fechaFin.toISOString().split('T')[0]
                },
                reglasAplicadas: this.obtenerResumenReglas(reglas)
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    private async generarHorariosConReglas(
        usuarios: any[],
        fechaInicio: Date,
        fechaFin: Date,
        reglas: any,
        casos: any[]
    ): Promise<HorarioGenerado[]> {
        const horarios: HorarioGenerado[] = [];
        const fechaActual = new Date(fechaInicio);

        while (fechaActual <= fechaFin) {
            const fechaStr = fechaActual.toISOString().split('T')[0];
            const diaSemana = fechaActual.getDay();
            const semanaNumero = this.getWeekNumber(fechaActual);

            for (const usuario of usuarios) {
                // Todos trabajan todos los días
                const trabajarHoy = true;
                const esDiaLibre = false;

                // Obtener horario según país y día
                const horarioBase = this.obtenerHorarioBase(
                    usuario.pais,
                    diaSemana,
                    reglas
                );

                // Aplicar casos especiales
                const horarioConEspeciales = await rulesService.aplicarReglasEspeciales(
                    usuario.employeeid,
                    usuario.nombre,
                    usuario.pais,
                    fechaActual,
                    horarioBase
                );

                // Verificar si necesita día reducido
                const esDiaReducido = diaSemana === 5; // Viernes reducido para cumplir 44h semanales

                horarios.push({
                    employeeid: usuario.employeeid,
                    fecha: fechaStr,
                    hora_entrada: trabajarHoy ? horarioConEspeciales.horaEntrada : null,
                    tipo_jornada: trabajarHoy ? horarioConEspeciales.tipoJornada : 'normal',
                    campana_id: usuario.campana_id || 1,
                    es_dia_libre: esDiaLibre,
                    es_dia_reducido: esDiaReducido && trabajarHoy,
                    semana_numero: semanaNumero
                });
            }

            fechaActual.setDate(fechaActual.getDate() + 1);
        }

        return horarios;
    }

    private obtenerHorarioBase(
        pais: string,
        diaSemana: number,
        reglas: any
    ): { horaEntrada: string; tipoJornada: TipoJornada } {
        const esFinSemana = diaSemana === 0 || diaSemana === 6;
        let horariosDisponibles: any[] = [];

        if (pais === 'chile') {
            horariosDisponibles = esFinSemana ? reglas.horariosChileFS : reglas.horariosChileLV;
        } else {
            horariosDisponibles = esFinSemana ? reglas.horariosColombiaFS : reglas.horariosColombiaLV;
        }

        if (horariosDisponibles.length === 0) {
            const horaDefault = esFinSemana ? '09:00' : '08:00';
            return { horaEntrada: horaDefault, tipoJornada: 'normal' };
        }

        // Seleccionar horario aleatorio con distribución
        const random = Math.random();
        let tipoJornada: TipoJornada = 'normal';

        if (random < reglas.porcentajeApertura) {
            const apertura = horariosDisponibles.find((h: any) => h.tipo === 'apertura');
            if (apertura) {
                return { horaEntrada: apertura.entrada, tipoJornada: 'apertura' };
            }
        } else if (random > (1 - reglas.porcentajeCierre)) {
            const cierre = horariosDisponibles.find((h: any) => h.tipo === 'cierre');
            if (cierre) {
                return { horaEntrada: cierre.entrada, tipoJornada: 'cierre' };
            }
        }

        // Horario normal
        const normales = horariosDisponibles.filter((h: any) => !h.tipo || h.tipo === 'normal');
        const index = Math.floor(Math.random() * normales.length);
        const horario = normales[index];

        // Decidir tipo de jornada
        const tipoRandom = Math.random();
        if (tipoRandom < 0.2) {
            tipoJornada = 'entrada_tardia';
        } else if (tipoRandom < 0.3) {
            tipoJornada = 'salida_temprana';
        }

        return {
            horaEntrada: horario.entrada,
            tipoJornada
        };
    }

    // Nueva función para verificar cobertura diaria
    private async verificarCoberturaDiaria(
        client: any,
        fechaInicio: Date,
        fechaFin: Date
    ): Promise<{ fecha: string; empleadosTrabajando: number }[]> {
        const query = `
      SELECT 
        fecha::date as fecha,
        COUNT(DISTINCT employeeid) as empleados_trabajando
      FROM horarios 
      WHERE fecha::date >= $1::date 
        AND fecha::date <= $2::date
        AND hora_entrada IS NOT NULL
      GROUP BY fecha::date
      ORDER BY fecha
    `;

        const result = await client.query(query, [
            fechaInicio.toISOString().split('T')[0],
            fechaFin.toISOString().split('T')[0]
        ]);

        return result.rows.map((row: any) => ({
            fecha: row.fecha.toISOString().split('T')[0],
            empleadosTrabajando: parseInt(row.empleados_trabajando)
        }));
    }

    private obtenerResumenReglas(reglas: any): string[] {
        return [
            `✅ TODOS trabajan TODOS los días`,
            `✅ Generación desde el 1er día del mes`,
            `✅ Límite de ${reglas.horasMaxSemanales} horas semanales`,
            `✅ Viernes reducidos para cumplir 44h semanales`,
            `✅ ${reglas.porcentajeApertura * 100}% apertura diaria`,
            `✅ ${reglas.porcentajeCierre * 100}% cierre diaria`,
            `✅ Horarios específicos por país`
        ];
    }

    // Helper para número de semana
    private getWeekNumber(date: Date): number {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return weekNo;
    }
}

export default HorarioService.getInstance();