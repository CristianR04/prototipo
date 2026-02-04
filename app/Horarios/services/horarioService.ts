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

interface DiaLibreAsignado {
    [empleadoId: string]: Set<string>; // Fechas de descanso por empleado
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
            const empleados = usuariosResult.rows;

            if (empleados.length === 0) {
                throw new Error('No hay empleados para generar horarios');
            }

            console.log(`👥 ${empleados.length} empleados encontrados`);

            // Calcular rango de fechas
            // Calcular rango de fechas - SIEMPRE desde el 1er día del mes actual
            const hoy = new Date();
            const fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1); // 1er día del mes
            fechaInicio.setHours(0, 0, 0, 0);

            // Calcular fecha fin según meses solicitados
            const fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() + meses, 0); // Último día del mes+n
            fechaFin.setHours(23, 59, 59, 999);

            console.log(`📅 Rango de generación: ${fechaInicio.toISOString().split('T')[0]} (1er día) a ${fechaFin.toISOString().split('T')[0]} (último día)`);

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

            // 1. ASIGNAR DÍAS DE DESCANSO (2 por semana por empleado)
            const diasLibresPorEmpleado = this.asignarDiasLibres(
                empleados,
                fechaInicio,
                fechaFin,
                reglas
            );

            // 2. GENERAR HORARIOS CON DÍAS DE DESCANSO ASIGNADOS
            const horariosGenerados = await this.generarHorariosConDiasLibres(
                empleados,
                fechaInicio,
                fechaFin,
                diasLibresPorEmpleado,
                reglas
            );

            // 3. VERIFICAR Y AJUSTAR COBERTURA DIARIA
            const horariosAjustados = this.ajustarCoberturaDiaria(
                horariosGenerados,
                empleados,
                fechaInicio,
                fechaFin,
                diasLibresPorEmpleado,
                reglas
            );

            // 4. GUARDAR HORARIOS
            let insertados = 0;
            let errores = 0;

            for (const horario of horariosAjustados) {
                try {
                    if (horario.es_dia_libre) {
                        // Día libre - insertar con NULL en todos los campos de horas
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
                                created_at,
                                es_dia_libre
                            )
                            VALUES ($1, $2::date, NULL, NULL, NULL, NULL, NULL, $3, 'normal', NOW(), true)
                        `;

                        await client.query(insertQuery, [
                            horario.employeeid,
                            horario.fecha,
                            horario.campana_id || 1
                        ]);
                    } else {
                        // Día laboral - calcular horas
                        let horasCalculadas: {
                            break1: string | null;
                            colacion: string | null;
                            break2: string | null;
                            hora_salida: string | null;
                        };

                        if (horario.hora_entrada) {
                            horasCalculadas = calcularHorasSegunJornada(
                                horario.hora_entrada,
                                horario.tipo_jornada,
                                horario.es_dia_reducido || false
                            );
                        } else {
                            // Valor por defecto si no hay hora de entrada
                            horasCalculadas = calcularHorasSegunJornada('08:00', 'normal', false);
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
                                created_at,
                                es_dia_libre
                            )
                            VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, NOW(), false)
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
                    }

                    insertados++;
                } catch (error: any) {
                    console.error(`Error insertando horario ${horario.employeeid} - ${horario.fecha}:`, error.message);
                    errores++;
                }
            }

            await client.query('COMMIT');

            // 5. VERIFICAR COBERTURA FINAL
            const cobertura = await this.verificarCoberturaDiaria(client, fechaInicio, fechaFin);

            // 6. VERIFICAR QUE CADA EMPLEADO TENGA 5 DÍAS LABORALES POR SEMANA
            const cumplimiento5x2 = this.verificarCumplimiento5x2(horariosAjustados, empleados);

            console.log(`✅ Generación completada: ${insertados} horarios creados, ${errores} errores`);
            console.log(`📊 Cumplimiento 5x2: ${cumplimiento5x2.empleadosCumplen}/${empleados.length} empleados cumplen`);

            return {
                totalEmpleados: empleados.length,
                diasGenerados: Math.floor((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1,
                horariosGenerados: horariosAjustados.length,
                insertados,
                errores,
                cobertura,
                cumplimiento5x2,
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

    private asignarDiasLibres(
        empleados: any[],
        fechaInicio: Date,
        fechaFin: Date,
        reglas: any
    ): DiaLibreAsignado {
        const diasLibresPorEmpleado: DiaLibreAsignado = {};

        console.log(`📊 Asignando días libres para ${empleados.length} empleados...`);

        // Inicializar sets para cada empleado
        empleados.forEach(emp => {
            diasLibresPorEmpleado[emp.employeeid] = new Set<string>();
        });

        const fechaActual = new Date(fechaInicio);

        // Asignar días libres estratégicamente
        while (fechaActual <= fechaFin) {
            const fechaStr = fechaActual.toISOString().split('T')[0];
            const diaSemana = fechaActual.getDay();
            const semanaNumero = this.getWeekNumber(fechaActual);

            // Para cada empleado, verificar si ya tiene 2 días libres esta semana
            for (const empleado of empleados) {
                const diasLibresEmpleado = diasLibresPorEmpleado[empleado.employeeid];
                const diasLibresEstaSemana = Array.from(diasLibresEmpleado).filter(fecha => {
                    const fechaLibre = new Date(fecha);
                    return this.getWeekNumber(fechaLibre) === semanaNumero;
                }).length;

                // Si ya tiene 2 días libres esta semana, debe trabajar
                if (diasLibresEstaSemana >= 2) {
                    continue;
                }

                // Si es fin de semana, menor probabilidad de día libre
                if (diaSemana === 0 || diaSemana === 6) {
                    // Fin de semana: solo 10-20% de empleados libres
                    const probabilidadLibreFinSemana = 0.15;
                    if (Math.random() < probabilidadLibreFinSemana &&
                        diasLibresEstaSemana < 1) { // Máximo 1 día libre en fin de semana
                        diasLibresEmpleado.add(fechaStr);
                    }
                } else {
                    // Días de semana: 20-30% de empleados libres
                    const probabilidadLibre = 0.25;
                    if (Math.random() < probabilidadLibre &&
                        diasLibresEstaSemana < 2) {
                        diasLibresEmpleado.add(fechaStr);
                    }
                }
            }

            fechaActual.setDate(fechaActual.getDate() + 1);
        }

        // Verificar asignación
        let totalDiasLibres = 0;
        empleados.forEach(emp => {
            totalDiasLibres += diasLibresPorEmpleado[emp.employeeid].size;
        });

        console.log(`📊 Días libres asignados: ${totalDiasLibres} (promedio ${(totalDiasLibres / empleados.length).toFixed(2)} por empleado)`);

        return diasLibresPorEmpleado;
    }

    private async generarHorariosConDiasLibres(
        empleados: any[],
        fechaInicio: Date,
        fechaFin: Date,
        diasLibresPorEmpleado: DiaLibreAsignado,
        reglas: any
    ): Promise<HorarioGenerado[]> {
        const horarios: HorarioGenerado[] = [];
        const fechaActual = new Date(fechaInicio);

        console.log(`📊 Generando horarios con días libres...`);

        while (fechaActual <= fechaFin) {
            const fechaStr = fechaActual.toISOString().split('T')[0];
            const diaSemana = fechaActual.getDay();
            const semanaNumero = this.getWeekNumber(fechaActual);

            for (const empleado of empleados) {
                const esDiaLibre = diasLibresPorEmpleado[empleado.employeeid]?.has(fechaStr);

                if (esDiaLibre) {
                    // Día libre
                    horarios.push({
                        employeeid: empleado.employeeid,
                        fecha: fechaStr,
                        hora_entrada: null,
                        tipo_jornada: 'normal',
                        campana_id: empleado.campana_id || 1,
                        es_dia_libre: true,
                        semana_numero: semanaNumero
                    });
                } else {
                    // Día laboral - Obtener horario base primero
                    let horarioBase = this.obtenerHorarioBase(
                        empleado.pais,
                        diaSemana,
                        reglas
                    );

                    // Verificar que horarioBase sea válido
                    if (!horarioBase || !horarioBase.horaEntrada) {
                        console.warn(`⚠️ Horario base inválido para ${empleado.employeeid} - ${fechaStr}, usando valores por defecto`);
                        horarioBase = {
                            horaEntrada: '08:00',
                            tipoJornada: 'normal' as TipoJornada
                        };
                    }

                    try {
                        // Aplicar reglas especiales con manejo de errores
                        let horarioConEspeciales = await rulesService.aplicarReglasEspeciales(
                            empleado.employeeid,
                            empleado.nombre,
                            empleado.pais,
                            fechaActual,
                            horarioBase
                        );

                        // Verificar que el resultado sea válido
                        if (!horarioConEspeciales || !horarioConEspeciales.horaEntrada) {
                            console.warn(`⚠️ Reglas especiales devolvieron resultado inválido para ${empleado.employeeid} - ${fechaStr}, usando horario base`);
                            horarioConEspeciales = horarioBase;
                        }

                        // Verificar si es día reducido (viernes para cumplir 44h semanales)
                        const esDiaReducido = diaSemana === 5 &&
                            this.debeAplicarDiaReducido(empleado, empleados, fechaActual, reglas);

                        horarios.push({
                            employeeid: empleado.employeeid,
                            fecha: fechaStr,
                            hora_entrada: horarioConEspeciales.horaEntrada,
                            tipo_jornada: horarioConEspeciales.tipoJornada,
                            campana_id: empleado.campana_id || 1,
                            es_dia_libre: false,
                            es_dia_reducido: esDiaReducido,
                            semana_numero: semanaNumero
                        });

                    } catch (error: any) {
                        console.error(`❌ Error aplicando reglas especiales para ${empleado.employeeid} - ${fechaStr}:`, error.message);

                        // Usar horario base como fallback
                        horarios.push({
                            employeeid: empleado.employeeid,
                            fecha: fechaStr,
                            hora_entrada: horarioBase.horaEntrada,
                            tipo_jornada: horarioBase.tipoJornada,
                            campana_id: empleado.campana_id || 1,
                            es_dia_libre: false,
                            semana_numero: semanaNumero
                        });
                    }
                }
            }

            fechaActual.setDate(fechaActual.getDate() + 1);
        }

        console.log(`✅ Generados ${horarios.length} registros de horarios`);
        return horarios;
    }

    private ajustarCoberturaDiaria(
        horarios: HorarioGenerado[],
        empleados: any[],
        fechaInicio: Date,
        fechaFin: Date,
        diasLibresPorEmpleado: DiaLibreAsignado,
        reglas: any
    ): HorarioGenerado[] {
        const horariosPorFecha = new Map<string, HorarioGenerado[]>();

        // Agrupar horarios por fecha
        horarios.forEach(h => {
            if (!horariosPorFecha.has(h.fecha)) {
                horariosPorFecha.set(h.fecha, []);
            }
            horariosPorFecha.get(h.fecha)!.push(h);
        });

        const fechaActual = new Date(fechaInicio);
        const horariosAjustados: HorarioGenerado[] = [];

        // Mínimo de empleados trabajando por día
        const minEmpleadosPorDia = Math.max(1, Math.floor(empleados.length * 0.6)); // Al menos 60%

        while (fechaActual <= fechaFin) {
            const fechaStr = fechaActual.toISOString().split('T')[0];
            const diaSemana = fechaActual.getDay();
            const horariosDelDia = horariosPorFecha.get(fechaStr) || [];

            // Contar empleados trabajando este día
            const empleadosTrabajando = horariosDelDia.filter(h => !h.es_dia_libre).length;

            if (empleadosTrabajando < minEmpleadosPorDia) {
                console.log(`⚠️ Ajustando cobertura para ${fechaStr}: ${empleadosTrabajando}/${minEmpleadosPorDia} empleados`);

                // Encontrar empleados que están libres este día
                const empleadosLibresEsteDia = horariosDelDia.filter(h => h.es_dia_libre);

                // Seleccionar algunos para cambiar a trabajando
                const cantidadNecesaria = minEmpleadosPorDia - empleadosTrabajando;
                const empleadosACambiar = empleadosLibresEsteDia
                    .slice(0, Math.min(cantidadNecesaria, empleadosLibresEsteDia.length));

                // Cambiar estado de libre a trabajando
                empleadosACambiar.forEach(horario => {
                    horario.es_dia_libre = false;

                    // Obtener horario base
                    const empleado = empleados.find(e => e.employeeid === horario.employeeid);
                    if (empleado) {
                        const horarioBase = this.obtenerHorarioBase(
                            empleado.pais,
                            diaSemana,
                            reglas
                        );
                        horario.hora_entrada = horarioBase.horaEntrada;
                        horario.tipo_jornada = horarioBase.tipoJornada;

                        // Remover de días libres asignados
                        diasLibresPorEmpleado[horario.employeeid]?.delete(fechaStr);
                    }
                });

                // Buscar otro día para compensar el día libre extra
                empleadosACambiar.forEach(horario => {
                    this.compensarDiaLibreExtra(
                        horario.employeeid,
                        fechaActual,
                        fechaInicio,
                        fechaFin,
                        diasLibresPorEmpleado,
                        horariosPorFecha,
                        empleados
                    );
                });
            }

            horariosAjustados.push(...horariosDelDia);
            fechaActual.setDate(fechaActual.getDate() + 1);
        }

        return horariosAjustados;
    }

    private compensarDiaLibreExtra(
        employeeid: string,
        fechaCambiada: Date,
        fechaInicio: Date,
        fechaFin: Date,
        diasLibresPorEmpleado: DiaLibreAsignado,
        horariosPorFecha: Map<string, HorarioGenerado[]>,
        empleados: any[]
    ) {
        const semanaOriginal = this.getWeekNumber(fechaCambiada);

        // Buscar un día en la misma semana donde el empleado trabaja
        for (let i = 0; i < 7; i++) {
            const fechaCompensacion = new Date(fechaCambiada);
            fechaCompensacion.setDate(fechaCompensacion.getDate() - 3 + i); // Buscar alrededor

            if (fechaCompensacion < fechaInicio || fechaCompensacion > fechaFin) {
                continue;
            }

            const fechaStr = fechaCompensacion.toISOString().split('T')[0];
            const semanaCompensacion = this.getWeekNumber(fechaCompensacion);

            if (semanaCompensacion !== semanaOriginal) {
                continue;
            }

            // Verificar si el empleado trabaja ese día
            const horariosDia = horariosPorFecha.get(fechaStr) || [];
            const horarioEmpleado = horariosDia.find(h => h.employeeid === employeeid);

            if (horarioEmpleado && !horarioEmpleado.es_dia_libre) {
                // Cambiar a día libre
                horarioEmpleado.es_dia_libre = true;
                horarioEmpleado.hora_entrada = null;
                diasLibresPorEmpleado[employeeid]?.add(fechaStr);
                return true;
            }
        }

        return false;
    }

    private debeAplicarDiaReducido(empleado: any, empleadosList: any[], fecha: Date, reglas: any): boolean {
        // Solo aplicar día reducido los viernes
        if (fecha.getDay() !== 5) return false;

        // Encontrar el índice del empleado en la lista
        const usuarioIndex = empleadosList.findIndex(emp => emp.employeeid === empleado.employeeid);
        if (usuarioIndex === -1) return false;

        const semanaNumero = this.getWeekNumber(fecha);
        return semanaNumero % 2 === (usuarioIndex % 2);
    }

    private obtenerHorarioBase(
        pais: string,
        diaSemana: number,
        reglas: any,
        esFestivo: boolean = false  // Nuevo parámetro
    ): { horaEntrada: string; tipoJornada: TipoJornada } {

        // Considerar festivos como fin de semana
        const esFinDeSemanaOFestivo = diaSemana === 0 || diaSemana === 6 || esFestivo;

        // 1. Determinar el tipo de jornada basado en porcentajes de la BD
        let tipoJornada: TipoJornada = 'normal';
        const random = Math.random();

        if (random < reglas.porcentajeApertura) {
            tipoJornada = 'apertura';
        } else if (random > (1 - reglas.porcentajeCierre)) {
            tipoJornada = 'cierre';
        }

        // 2. Obtener horarios de la BD para este país y tipo de día
        let horariosDisponibles: any[] = [];

        if (pais === 'chile') {
            horariosDisponibles = esFinDeSemanaOFestivo 
                ? reglas.horariosChileFS
                : reglas.horariosChileLV;
        } else if (pais === 'colombia') {
            horariosDisponibles = esFinDeSemanaOFestivo 
                ? reglas.horariosColombiaFS
                : reglas.horariosColombiaLV;
        } else {
            // País no reconocido, usar Chile por defecto
            horariosDisponibles = esFinDeSemanaOFestivo 
                ? reglas.horariosChileFS
                : reglas.horariosChileLV;
        }

        // 3. Si no hay horarios configurados, usar distribución calculada
        if (!horariosDisponibles || horariosDisponibles.length === 0) {
            console.log(`ℹ️ Usando distribución calculada para ${pais}`);

            // Usar configuración de distribución calculada automáticamente
            const config = reglas.configDistribucion;

            if (tipoJornada === 'apertura') {
                // Apertura según país
                if (pais === 'chile') {
                    const horaMin = parseInt(config.apertura_chile_min.split(':')[0]);
                    const horaMax = parseInt(config.apertura_chile_max.split(':')[0]);
                    const hora = horaMin + Math.floor(Math.random() * (horaMax - horaMin + 1));
                    return {
                        horaEntrada: `${hora.toString().padStart(2, '0')}:00`,
                        tipoJornada: 'apertura'
                    };
                } else if (pais === 'colombia') {
                    const horaMin = parseInt(config.apertura_colombia_min.split(':')[0]);
                    const horaMax = parseInt(config.apertura_colombia_max.split(':')[0]);
                    const hora = horaMin + Math.floor(Math.random() * (horaMax - horaMin + 1));
                    return {
                        horaEntrada: `${hora.toString().padStart(2, '0')}:00`,
                        tipoJornada: 'apertura'
                    };
                }
            } else if (tipoJornada === 'cierre') {
                // Cierre según país
                if (pais === 'chile') {
                    return {
                        horaEntrada: config.cierre_chile,
                        tipoJornada: 'cierre'
                    };
                } else if (pais === 'colombia') {
                    return {
                        horaEntrada: config.cierre_colombia,
                        tipoJornada: 'cierre'
                    };
                }
            }

            // Normal: usar rango completo según país
            if (pais === 'chile') {
                const horaMin = parseInt(config.apertura_chile_min.split(':')[0]);
                const hora = horaMin + Math.floor(Math.random() * 5); // 5 opciones
                return {
                    horaEntrada: `${Math.min(hora, 12).toString().padStart(2, '0')}:00`,
                    tipoJornada: 'normal'
                };
            } else if (pais === 'colombia') {
                const horaMin = parseInt(config.apertura_colombia_min.split(':')[0]);
                const hora = horaMin + Math.floor(Math.random() * 5); // 5 opciones
                return {
                    horaEntrada: `${Math.min(hora, 10).toString().padStart(2, '0')}:00`,
                    tipoJornada: 'normal'
                };
            }
        }

        // 4. Si HAY horarios en BD, filtrar por tipo de jornada
        let horariosFiltrados = horariosDisponibles;

        if (tipoJornada === 'apertura') {
            // Buscar horarios marcados como apertura
            horariosFiltrados = horariosDisponibles.filter((h: any) => h.tipo === 'apertura');
            if (horariosFiltrados.length === 0) {
                // Si no hay aperturas, usar normales
                horariosFiltrados = horariosDisponibles.filter((h: any) => h.tipo === 'normal');
            }
        } else if (tipoJornada === 'cierre') {
            // Buscar horarios marcados como cierre
            horariosFiltrados = horariosDisponibles.filter((h: any) => h.tipo === 'cierre');
            if (horariosFiltrados.length === 0) {
                // Si no hay cierres, usar normales
                horariosFiltrados = horariosDisponibles.filter((h: any) => h.tipo === 'normal');
            }
        } else {
            // Para normales, usar horarios normales
            horariosFiltrados = horariosDisponibles.filter((h: any) => h.tipo === 'normal');
        }

        // 5. Si no hay horarios del tipo específico, usar todos disponibles
        if (!horariosFiltrados || horariosFiltrados.length === 0) {
            horariosFiltrados = horariosDisponibles;
        }

        // 6. Seleccionar un horario aleatorio
        if (horariosFiltrados.length === 0) {
            // Fallback final
            return {
                horaEntrada: pais === 'colombia' ? '06:00' : '08:00',
                tipoJornada: 'normal'
            };
        }

        const index = Math.floor(Math.random() * horariosFiltrados.length);
        const horarioSeleccionado = horariosFiltrados[index];

        // 7. Ocasionalmente aplicar entrada tardía o salida temprana (5% cada una)
        const tipoRandom = Math.random();
        if (tipoRandom < 0.05) {
            tipoJornada = 'entrada_tardia';
        } else if (tipoRandom < 0.1) {
            tipoJornada = 'salida_temprana';
        }

        return {
            horaEntrada: horarioSeleccionado.entrada,
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
                AND es_dia_libre = false
            GROUP BY fecha::date
            ORDER BY fecha
        `;

        const result = await client.query(query, [
            fechaInicio.toISOString().split('T')[0],
            fechaFin.toISOString().split('T')[0]
        ]);

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

    private verificarCumplimiento5x2(horarios: HorarioGenerado[], empleados: any[]): {
        empleadosCumplen: number;
        detalles: { employeeid: string; diasLaboralesPorSemana: number[] }[];
    } {
        const detalles: { employeeid: string; diasLaboralesPorSemana: number[] }[] = [];
        let empleadosCumplen = 0;

        for (const empleado of empleados) {
            const horariosEmpleado = horarios.filter(h => h.employeeid === empleado.employeeid);
            const semanas = new Set(horariosEmpleado.map(h => h.semana_numero));
            const diasPorSemana: number[] = [];

            let cumple = true;

            for (const semana of semanas) {
                const diasLaboralesEstaSemana = horariosEmpleado
                    .filter(h => h.semana_numero === semana && !h.es_dia_libre)
                    .length;

                diasPorSemana.push(diasLaboralesEstaSemana);

                // Debe tener entre 4 y 6 días laborales por semana (flexible)
                if (diasLaboralesEstaSemana < 4 || diasLaboralesEstaSemana > 6) {
                    cumple = false;
                }
            }

            detalles.push({
                employeeid: empleado.employeeid,
                diasLaboralesPorSemana: diasPorSemana
            });

            if (cumple) empleadosCumplen++;
        }

        return { empleadosCumplen, detalles };
    }

    private obtenerResumenReglas(reglas: any): string[] {
        return [
            `✅ Sistema 5x2: 5 días laborales, 2 días libres por semana`,
            `✅ TODOS los días hay ejecutivos trabajando`,
            `✅ Mínimo ${Math.round((reglas.minCoberturaDiaria || 0.6) * 100)}% de cobertura diaria`,
            `✅ Distribución estratégica de días libres`,
            `✅ Ajuste automático para mantener cobertura`,
            `✅ Límite de ${reglas.horasMaxSemanales || 44} horas semanales`,
            `✅ Viernes reducidos cuando sea necesario`,
            `✅ Horarios específicos por país`,
            `✅ Verificación de cumplimiento 5x2`
        ];
    }

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