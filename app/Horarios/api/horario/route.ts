import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { calcularHorasSegunJornada } from '@/app/Horarios/utils/calculations';

// Definir tipos de jornada ACTUALIZADO
type TipoJornada = "normal" | "entrada_tardia" | "salida_temprana" | "apertura" | "cierre";

interface HorarioRequest {
    employeeid: string;
    fecha: string;
    hora_entrada: string;
    tipo_jornada?: TipoJornada;
}

// GET: Obtener horarios existentes
export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const { searchParams } = new URL(request.url);
        const fecha_inicio = searchParams.get('fecha_inicio');
        const fecha_fin = searchParams.get('fecha_fin');

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

        if (fecha_inicio && fecha_fin) {
            query += ` WHERE h.fecha::date >= $1::date AND h.fecha::date <= $2::date`;
            params.push(fecha_inicio, fecha_fin);
        }

        query += ` ORDER BY h.employeeid, h.fecha`;

        const result = await client.query(query, params);

        return NextResponse.json({
            success: true,
            message: 'Horarios obtenidos',
            horarios: result.rows
        });

    } catch (error: any) {
        console.error("Error GET:", error);
        return NextResponse.json(
            {
                success: false,
                message: 'Error al obtener horarios',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}

// POST: Guardar/Actualizar horarios
export async function POST(request: NextRequest) {
    const client = await pool.connect();

    try {
        const horarios: HorarioRequest[] = await request.json();

        if (!horarios || horarios.length === 0) {
            return NextResponse.json(
                { success: false, message: 'No hay datos para guardar' },
                { status: 400 }
            );
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

        console.log(`🔍 Encontrados ${existingHorarios.length} registros existentes en el rango`);

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

                // Calcular horas automáticas usando la función importada
                const horasCalculadas = calcularHorasSegunJornada(horaEntrada, tipoJornada);

                // Clave única
                const key = `${h.employeeid}_${h.fecha}`;
                const existing = existingMap.get(key);

                if (existing) {
                    // Verificar si debe actualizarse
                    const debeActualizar = (
                        horaEntrada !== null ||
                        tipoJornada !== existing.tipo_jornada
                    );

                    if (debeActualizar) {
                        // Actualizar con nueva hora de entrada
                        if (horaEntrada !== null) {
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
                        } else if (tipoJornada !== existing.tipo_jornada) {
                            // Solo cambio de tipo de jornada
                            if (existing.hora_entrada) {
                                const horasRecalculadas = calcularHorasSegunJornada(existing.hora_entrada, tipoJornada);

                                const updateQuery = `
                                    UPDATE horarios 
                                    SET tipo_jornada = $1,
                                        break_1 = $2,
                                        colacion = $3,
                                        break_2 = $4,
                                        hora_salida = $5,
                                        updated_at = NOW()
                                    WHERE id = $6
                                `;

                                await client.query(updateQuery, [
                                    tipoJornada,
                                    horasRecalculadas.break1,
                                    horasRecalculadas.colacion,
                                    horasRecalculadas.break2,
                                    horasRecalculadas.hora_salida,
                                    existing.id
                                ]);

                                actualizados++;
                            } else {
                                // Solo actualizar tipo de jornada
                                const updateQuery = `
                                    UPDATE horarios 
                                    SET tipo_jornada = $1,
                                        updated_at = NOW()
                                    WHERE id = $2
                                `;

                                await client.query(updateQuery, [
                                    tipoJornada,
                                    existing.id
                                ]);

                                actualizados++;
                            }
                        }
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

        return NextResponse.json({
            success: true,
            message: `Procesamiento completado`,
            detalle: {
                insertados,
                actualizados,
                conservados,
                errores
            }
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("❌ Error al guardar:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Error al guardar: " + error.message
            },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}

// DELETE: Eliminar horarios por rango
export async function DELETE(request: NextRequest) {
    const client = await pool.connect();

    try {
        const { searchParams } = new URL(request.url);
        const fecha_inicio = searchParams.get('fecha_inicio');
        const fecha_fin = searchParams.get('fecha_fin');
        const employeeid = searchParams.get('employeeid');

        if (!fecha_inicio || !fecha_fin) {
            return NextResponse.json(
                { success: false, message: 'Fechas requeridas' },
                { status: 400 }
            );
        }

        let query = `DELETE FROM horarios WHERE fecha::date >= $1::date AND fecha::date <= $2::date`;
        const params: any[] = [fecha_inicio, fecha_fin];

        if (employeeid) {
            query += ` AND employeeid = $3`;
            params.push(employeeid);
        }

        query += ` RETURNING *`;

        const result = await client.query(query, params);

        return NextResponse.json({
            success: true,
            message: 'Horarios eliminados',
            registros: result.rowCount || 0
        });

    } catch (error: any) {
        console.error("Error DELETE:", error);
        return NextResponse.json({
            success: false,
            message: 'Error al eliminar',
            error: error.message
        }, { status: 500 });
    } finally {
        client.release();
    }
}

// PUT: Generación automática CON REGLAS 5x2
export async function PUT(request: NextRequest) {
    const client = await pool.connect();

    try {
        // Leer el cuerpo de la solicitud
        const requestBody = await request.json();
        const meses = Math.min(Math.max(requestBody.meses || 2, 1), 12);

        console.log(`🚀 Iniciando generación inteligente para ${meses} meses...`);

        // 1. OBTENER CONFIGURACIÓN DE REGLAS 5x2
        const configQuery = await client.query('SELECT clave, valor FROM configuracion_horarios');
        const config = new Map<string, any>();
        configQuery.rows.forEach((row: any) => {
            try {
                if (row.valor && (row.valor.startsWith('[') || row.valor.startsWith('{'))) {
                    config.set(row.clave, JSON.parse(row.valor));
                } else {
                    config.set(row.clave, row.valor);
                }
            } catch {
                config.set(row.clave, row.valor);
            }
        });

        // Extraer reglas importantes
        const reglas = {
            diasTrabajo: parseInt(config.get('regla_dias_trabajo') || '5'),
            diasLibres: parseInt(config.get('regla_dias_libres') || '2'),
            maxConsecutivos: parseInt(config.get('regla_max_consecutivos') || '6'),
            domingosMin: parseInt(config.get('regla_domingos_min') || '16'),
            domingosMax: parseInt(config.get('regla_domingos_max') || '20'),
            porcentajeApertura: parseFloat(config.get('regla_porcentaje_apertura') || '0.2'),
            porcentajeCierre: parseFloat(config.get('regla_porcentaje_cierre') || '0.2'),
            horasMaxSemanales: parseInt(config.get('regla_44_horas') || '44')
        };

        console.log('📋 Aplicando reglas 5x2 desde configuración:', reglas);

        // 2. Obtener empleados
        const queryUsuarios = `
            SELECT 
                u.employeeid,
                u.nombre,
                u.campana_id,
                u.pais,
                c.campana
            FROM usuarios u
            LEFT JOIN campana c ON u.campana_id = c.id
            WHERE u.role = 'teleoperador' OR u.role IS NULL
            ORDER BY u.employeeid
        `;

        const usuariosResult = await client.query(queryUsuarios);

        if (usuariosResult.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: 'No hay empleados para generar horarios' },
                { status: 400 }
            );
        }

        console.log(`👥 Empleados encontrados: ${usuariosResult.rows.length}`);

        // 3. Determinar rango de fechas
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const fechaFin = new Date();
        fechaFin.setMonth(fechaFin.getMonth() + meses);
        fechaFin.setHours(23, 59, 59, 999);

        console.log(`📅 Rango: ${hoy.toISOString().split('T')[0]} - ${fechaFin.toISOString().split('T')[0]}`);

        // 4. Eliminar horarios futuros existentes
        await client.query('BEGIN');

        const deleteQuery = `
            DELETE FROM horarios 
            WHERE fecha::date >= $1::date 
            AND fecha::date <= $2::date
            RETURNING id
        `;

        const deleteResult = await client.query(deleteQuery, [
            hoy.toISOString().split('T')[0],
            fechaFin.toISOString().split('T')[0]
        ]);

        console.log(`🗑️ Eliminados ${deleteResult.rowCount} registros existentes`);

        // 5. Obtener horarios base de configuración
        const horariosChileLV: any[] = config.get('horario_chile_lv') || [];
        const horariosColombiaLV: any[] = config.get('horario_colombia_lv') || [];
        const horariosChileFS: any[] = config.get('horario_chile_fs') || [];
        const horariosColombiaFS: any[] = config.get('horario_colombia_fs') || [];

        // 6. Función mejorada para obtener horario según país y día
        const obtenerHorarioParaDia = (
            empleado: any,
            fecha: Date,
            teleoperadorIndex: number,
            diaDelMes: number
        ): { horaEntrada: string; tipoJornada: TipoJornada } => {

            const pais = empleado.pais || 'chile';
            const esFinSemana = fecha.getDay() === 0 || fecha.getDay() === 6;

            // Determinar qué conjunto de horarios usar
            let horariosDisponibles: any[] = [];
            if (pais === 'chile') {
                horariosDisponibles = esFinSemana ? horariosChileFS : horariosChileLV;
            } else {
                horariosDisponibles = esFinSemana ? horariosColombiaFS : horariosColombiaLV;
            }

            // Si no hay horarios configurados, usar valores por defecto
            if (horariosDisponibles.length === 0) {
                const horaDefault = esFinSemana ? '09:00' : '08:00';
                return { horaEntrada: horaDefault, tipoJornada: 'normal' };
            }

            // Distribuir aperturas (20%)
            if (diaDelMes % 5 === teleoperadorIndex % 5) {
                const apertura = horariosDisponibles.find((h: any) => h.tipo === 'apertura');
                if (apertura) {
                    return { horaEntrada: apertura.entrada, tipoJornada: 'apertura' };
                }
            }

            // Distribuir cierres (20%)
            if ((diaDelMes + 2) % 5 === teleoperadorIndex % 5) {
                const cierre = horariosDisponibles.find((h: any) => h.tipo === 'cierre');
                if (cierre) {
                    return { horaEntrada: cierre.entrada, tipoJornada: 'cierre' };
                }
            }

            // Horario normal - usar distribución equitativa
            const horariosNormales = horariosDisponibles.filter((h: any) =>
                !h.tipo || h.tipo === 'normal' || h.tipo === ''
            );

            if (horariosNormales.length > 0) {
                const index = (teleoperadorIndex + diaDelMes) % horariosNormales.length;
                const horario = horariosNormales[index];
                return {
                    horaEntrada: horario.entrada,
                    tipoJornada: 'normal'
                };
            }

            // Fallback al primer horario disponible
            return {
                horaEntrada: horariosDisponibles[0].entrada,
                tipoJornada: 'normal'
            };
        };

        // 7. Generar horarios CON REGLAS 5x2
        const horariosGenerados: Array<{
            employeeid: string;
            fecha: string;
            hora_entrada: string;
            tipo_jornada: TipoJornada;
            campana_id: number;
            es_dia_reducido?: boolean;
        }> = [];

        const stats = {
            totalEmpleados: usuariosResult.rows.length,
            diasGenerados: 0,
            diasLibresAsignados: 0,
            domingosTrabajados: 0,
            finesSemanaExcluidos: 0,
            errores: 0
        };

        for (let i = 0; i < usuariosResult.rows.length; i++) {
            const usuario = usuariosResult.rows[i];
            const fechaActual = new Date(hoy);
            let diasTrabajadosEstaSemana = 0;
            let semanaActual = 1;
            let diasConsecutivos = 0;

            while (fechaActual <= fechaFin) {
                try {
                    const diaSemana = fechaActual.getDay();
                    const fechaStr = fechaActual.toISOString().split('T')[0];

                    // Iniciar nueva semana los lunes
                    if (diaSemana === 1) {
                        semanaActual++;
                        diasTrabajadosEstaSemana = 0;
                    }

                    // Determinar si debe trabajar hoy
                    let trabajarHoy = false;

                    // REGLA 1: Lunes obligatorios
                    if (diaSemana === 1) {
                        trabajarHoy = true;
                    }
                    // REGLA 2: Máximo 6 días consecutivos
                    else if (diasConsecutivos >= reglas.maxConsecutivos) {
                        trabajarHoy = false;
                        diasConsecutivos = 0;
                        stats.diasLibresAsignados++;
                    }
                    // REGLA 3: Patrón 5x2
                    else if (diasTrabajadosEstaSemana < reglas.diasTrabajo) {
                        // No trabajar más de 5 días por semana
                        if (diaSemana === 0 || diaSemana === 6) {
                            // Fines de semana: algunos trabajan (para cumplir domingos)
                            if (diaSemana === 0) {
                                // DOMINGOS: Entre 16-20 teleoperadores
                                const teleoperadoresEnDomingo = horariosGenerados.filter(h =>
                                    h.fecha === fechaStr
                                ).length;

                                if (teleoperadoresEnDomingo < reglas.domingosMin) {
                                    trabajarHoy = (i % 3 === 0); // ~33% para cumplir mínimo
                                } else if (teleoperadoresEnDomingo < reglas.domingosMax) {
                                    trabajarHoy = (i % 5 === 0); // ~20% para mantenerse en rango
                                } else {
                                    trabajarHoy = false;
                                }
                            } else {
                                // SÁBADOS: Pocos trabajan
                                trabajarHoy = (i % 7 === 0); // ~14%
                            }
                        } else {
                            // Días de semana (martes a viernes)
                            trabajarHoy = true;
                        }
                    }
                    // REGLA 4: Ya trabajó 5 días esta semana
                    else {
                        trabajarHoy = false;
                        stats.diasLibresAsignados++;
                    }

                    if (trabajarHoy) {
                        const { horaEntrada, tipoJornada } = obtenerHorarioParaDia(
                            usuario,
                            fechaActual,
                            i,
                            fechaActual.getDate()
                        );

                        // Determinar si es día reducido (1 día por semana para cumplir 44 horas)
                        // Elegimos los miércoles (día 3) como día reducido
                        const esDiaReducido = fechaActual.getDay() === 3 &&
                            !(fechaActual.getDay() === 0 || fechaActual.getDay() === 6) &&
                            fechaStr !== '2026-01-01';

                        horariosGenerados.push({
                            employeeid: usuario.employeeid,
                            fecha: fechaStr,
                            hora_entrada: horaEntrada,
                            tipo_jornada: tipoJornada,
                            campana_id: usuario.campana_id || 1,
                            es_dia_reducido: esDiaReducido
                        });

                        stats.diasGenerados++;
                        diasTrabajadosEstaSemana++;
                        diasConsecutivos++;

                        if (diaSemana === 0) stats.domingosTrabajados++;
                        if (diaSemana === 0 || diaSemana === 6) stats.finesSemanaExcluidos++;
                    } else {
                        // Día libre
                        diasConsecutivos = 0;
                    }

                } catch (error: any) {
                    console.error(`Error procesando ${usuario.employeeid} - ${fechaActual}:`, error);
                    stats.errores++;
                }

                fechaActual.setDate(fechaActual.getDate() + 1);
            }
        }

        console.log(`📊 Estadísticas: ${JSON.stringify(stats, null, 2)}`);

        // 8. Guardar horarios generados
        let insertados = 0;

        for (const horario of horariosGenerados) {
            try {
                // Calcular horas CON ajuste para día reducido
                const horasCalculadas = calcularHorasSegunJornada(
                    horario.hora_entrada,
                    horario.tipo_jornada,
                    horario.es_dia_reducido || false
                );

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
                stats.errores++;
            }
        }

        await client.query('COMMIT');

        return NextResponse.json({
            success: true,
            message: `Horarios generados automáticamente para ${meses} meses CON REGLAS 5x2`,
            resumen: {
                totalEmpleados: stats.totalEmpleados,
                horariosGenerados: horariosGenerados.length,
                insertados: insertados,
                diasLibresAsignados: stats.diasLibresAsignados,
                domingosTrabajados: stats.domingosTrabajados,
                finesSemanaExcluidos: stats.finesSemanaExcluidos,
                errores: stats.errores,
                rango: {
                    inicio: hoy.toISOString().split('T')[0],
                    fin: fechaFin.toISOString().split('T')[0]
                },
                reglasAplicadas: [
                    `Turno ${reglas.diasTrabajo}x${reglas.diasLibres}`,
                    `Lunes obligatorios para todos`,
                    `Máximo ${reglas.maxConsecutivos} días consecutivos`,
                    `${reglas.porcentajeApertura * 100}% apertura diaria`,
                    `${reglas.porcentajeCierre * 100}% cierre diario`,
                    `${reglas.domingosMin}-${reglas.domingosMax} teleoperadores los domingos`,
                    `Ajuste de ${reglas.horasMaxSemanales} horas semanales (día reducido miércoles)`,
                    `1° enero 2026 tratado como domingo`
                ]
            }
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('❌ Error en generación 5x2:', error);

        return NextResponse.json(
            {
                success: false,
                message: 'Error al generar horarios 5x2',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}