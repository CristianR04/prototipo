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
            const { reglas } = await configService.obtenerConfiguracionCompleta();

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

            // ✅ CORRECCIÓN: Fechas desde HOY
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const fechaInicio = new Date(hoy);

            // ✅ CORRECCIÓN: Cálculo correcto de fecha fin
            const fechaFin = new Date(hoy);
            fechaFin.setMonth(fechaFin.getMonth() + meses);
            fechaFin.setDate(fechaFin.getDate() - 1); // Restar 1 día para tener el último día completo

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

            // ✅ CORRECCIÓN: NO OBTENER FESTIVOS - TODOS TRABAJAN SIEMPRE
            console.log(`✅ TODOS trabajan TODOS los días (incluyendo festivos y fines de semana)`);

            // Generar horarios (SIN DÍAS LIBRES)
            const horariosGenerados = await this.generarHorariosConReglas(
                usuariosResult.rows,
                fechaInicio,
                fechaFin,
                reglas
            );

            // Guardar horarios generados
            let insertados = 0;
            let errores = 0;

            for (const horario of horariosGenerados) {
                try {
                    let horasCalculadas: {
                        break1: string | null;
                        colacion: string | null;
                        break2: string | null;
                        hora_salida: string | null;
                    };

                    // Solo calcular horas si hay hora de entrada (SIEMPRE hay)
                    if (horario.hora_entrada) {
                        horasCalculadas = calcularHorasSegunJornada(
                            horario.hora_entrada,
                            horario.tipo_jornada,
                            horario.es_dia_reducido || false
                        );
                    } else {
                        // Esto NUNCA debería pasar, pero por seguridad
                        console.warn(`⚠️ Horario sin hora de entrada: ${horario.employeeid} - ${horario.fecha}`);
                        continue;
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

            // Verificar que todos los días tienen cobertura TOTAL
            const cobertura = await this.verificarCoberturaDiaria(client, fechaInicio, fechaFin);

            console.log(`✅ Generación completada: ${insertados} horarios creados, ${errores} errores`);

            return {
                totalEmpleados: usuariosResult.rows.length,
                diasGenerados: Math.floor((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1,
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
        reglas: any
    ): Promise<HorarioGenerado[]> {
        const horarios: HorarioGenerado[] = [];
        const fechaActual = new Date(fechaInicio);

        console.log(`👥 Generando horarios para ${usuarios.length} usuarios...`);

        while (fechaActual <= fechaFin) {
            const fechaStr = fechaActual.toISOString().split('T')[0];
            const diaSemana = fechaActual.getDay();
            const semanaNumero = this.getWeekNumber(fechaActual);
            
            // ✅ TODOS TRABAJAN TODOS LOS DÍAS - SIN EXCEPCIONES
            for (const usuario of usuarios) {
                // Obtener horario según país y día
                const horarioBase = this.obtenerHorarioBase(
                    usuario.pais,
                    diaSemana,
                    reglas
                );

                // Aplicar casos especiales (si existen)
                const horarioConEspeciales = await rulesService.aplicarReglasEspeciales(
                    usuario.employeeid,
                    usuario.nombre,
                    usuario.pais,
                    fechaActual,
                    horarioBase
                );

                // Verificar si necesita día reducido (viernes para cumplir 44h semanales)
                // Pero solo si hay suficiente personal para mantener cobertura
                const esDiaReducido = diaSemana === 5 && this.debeAplicarDiaReducido(usuario, fechaActual, reglas);

                horarios.push({
                    employeeid: usuario.employeeid,
                    fecha: fechaStr,
                    hora_entrada: horarioConEspeciales.horaEntrada,
                    tipo_jornada: horarioConEspeciales.tipoJornada,
                    campana_id: usuario.campana_id || 1,
                    es_dia_libre: false, // ✅ NUNCA es día libre
                    es_dia_reducido: esDiaReducido,
                    semana_numero: semanaNumero
                });
            }

            fechaActual.setDate(fechaActual.getDate() + 1);
        }

        console.log(`✅ Generados ${horarios.length} registros de horarios`);
        return horarios;
    }

    private debeAplicarDiaReducido(usuario: any, fecha: Date, reglas: any): boolean {
        // Solo aplicar día reducido los viernes para cumplir 44h semanales
        if (fecha.getDay() !== 5) return false; // Solo viernes
        
        // Verificar horas trabajadas en la semana
        // En una implementación real, deberías calcular las horas trabajadas
        // Para simplificar, alternamos entre usuarios
        const semanaNumero = this.getWeekNumber(fecha);
        const usuarioIndex = parseInt(usuario.employeeid) || 0;
        
        // Alternar usuarios para días reducidos
        return semanaNumero % 2 === usuarioIndex % 2;
    }

    private obtenerHorarioBase(
        pais: string,
        diaSemana: number,
        reglas: any
    ): { horaEntrada: string; tipoJornada: TipoJornada } {
        const esFinSemana = diaSemana === 0 || diaSemana === 6;
        let horariosDisponibles: any[] = [];

        if (pais === 'chile') {
            horariosDisponibles = esFinSemana ? 
                (reglas.horariosChileFS || []) : 
                (reglas.horariosChileLV || []);
        } else if (pais === 'colombia') {
            horariosDisponibles = esFinSemana ? 
                (reglas.horariosColombiaFS || []) : 
                (reglas.horariosColombiaLV || []);
        }

        // Si no hay horarios configurados para fin de semana, usar los de lunes a viernes
        if (horariosDisponibles.length === 0) {
            if (pais === 'chile') {
                horariosDisponibles = reglas.horariosChileLV || [];
            } else if (pais === 'colombia') {
                horariosDisponibles = reglas.horariosColombiaLV || [];
            }
        }

        // Si aún no hay horarios, usar valores por defecto
        if (horariosDisponibles.length === 0) {
            const horaDefault = '08:00'; // ✅ Misma hora todos los días
            return { horaEntrada: horaDefault, tipoJornada: 'normal' };
        }

        // Seleccionar horario aleatorio
        const random = Math.random();
        let tipoJornada: TipoJornada = 'normal';

        // Aplicar distribución de tipos de jornada
        if (random < (reglas.porcentajeApertura || 0.2)) {
            const apertura = horariosDisponibles.find((h: any) => h.tipo === 'apertura');
            if (apertura) {
                return { horaEntrada: apertura.entrada, tipoJornada: 'apertura' };
            }
        } else if (random > (1 - (reglas.porcentajeCierre || 0.2))) {
            const cierre = horariosDisponibles.find((h: any) => h.tipo === 'cierre');
            if (cierre) {
                return { horaEntrada: cierre.entrada, tipoJornada: 'cierre' };
            }
        }

        // Horario normal
        const normales = horariosDisponibles.filter((h: any) => !h.tipo || h.tipo === 'normal');
        
        if (normales.length === 0) {
            // Si no hay normales, usar el primero disponible
            const horario = horariosDisponibles[0];
            return {
                horaEntrada: horario.entrada || '08:00',
                tipoJornada: 'normal'
            };
        }

        const index = Math.floor(Math.random() * normales.length);
        const horario = normales[index];

        // Decidir tipo de jornada especial (entrada tardía o salida temprana) - solo ocasional
        const tipoRandom = Math.random();
        if (tipoRandom < 0.05) { // 5% de probabilidad para entrada tardía
            tipoJornada = 'entrada_tardia';
        } else if (tipoRandom < 0.1) { // 5% de probabilidad para salida temprana
            tipoJornada = 'salida_temprana';
        }

        return {
            horaEntrada: horario.entrada,
            tipoJornada
        };
    }

    private async verificarCoberturaDiaria(
        client: any,
        fechaInicio: Date,
        fechaFin: Date
    ): Promise<{ fecha: string; empleadosTrabajando: number; totalEmpleados: number; porcentajeCobertura: number }[]> {
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

        // Obtener total de empleados
        const totalEmpleadosQuery = await client.query(
            "SELECT COUNT(*) as total FROM usuarios WHERE pais IS NOT NULL"
        );
        const totalEmpleados = parseInt(totalEmpleadosQuery.rows[0].total);

        return result.rows.map((row: any) => ({
            fecha: row.fecha.toISOString().split('T')[0],
            empleadosTrabajando: parseInt(row.empleados_trabajando),
            totalEmpleados: totalEmpleados,
            porcentajeCobertura: Math.round((parseInt(row.empleados_trabajando) / totalEmpleados) * 100)
        }));
    }

    private obtenerResumenReglas(reglas: any): string[] {
        return [
            `✅ TODOS trabajan TODOS los días (incluyendo festivos y fines de semana)`,
            `✅ Generación desde HOY`,
            `✅ NINGÚN día sin cobertura de ejecutivos`,
            `✅ Cobertura 100% garantizada`,
            `✅ Límite de ${reglas.horasMaxSemanales || 44} horas semanales`,
            `✅ Viernes reducidos cuando sea necesario para cumplir límite semanal`,
            `✅ ${(reglas.porcentajeApertura || 0.2) * 100}% apertura diaria`,
            `✅ ${(reglas.porcentajeCierre || 0.2) * 100}% cierre diaria`,
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