// app/Horarios/api/horario/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

interface HorarioRequest {
    employeeid: string;
    fecha: string;
    hora_entrada: string;
    tipo_jornada?: "normal" | "entrada_tardia" | "salida_temprana";
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

// Función para calcular horas con tipos de jornada
const calcularHorasConJornada = (
    horaEntrada: string | null,
    tipoJornada: string = "normal"
): {
    break1: string | null;
    colacion: string | null;
    break2: string | null;
    hora_salida: string | null;
} => {
    if (!horaEntrada || horaEntrada === "Libre") {
        return {
            break1: null,
            colacion: null,
            break2: null,
            hora_salida: null
        };
    }

    try {
        const [horas, minutos] = horaEntrada.split(':').map(Number);
        const entradaDate = new Date();
        entradaDate.setHours(horas, minutos, 0, 0);

        const sumarHoras = (fecha: Date, horasASumar: number): string => {
            const nuevaFecha = new Date(fecha);
            nuevaFecha.setHours(nuevaFecha.getHours() + horasASumar);

            const horasStr = nuevaFecha.getHours().toString().padStart(2, '0');
            const minutosStr = nuevaFecha.getMinutes().toString().padStart(2, '0');
            return `${horasStr}:${minutosStr}`;
        };

        const calcularBreaksParaDuracion = (entrada: Date, duracion: number) => {
            const proporcion = duracion / 10;

            return {
                break1: sumarHoras(entrada, 2 * proporcion),
                colacion: sumarHoras(entrada, 5 * proporcion),
                break2: sumarHoras(entrada, 8 * proporcion),
                hora_salida: sumarHoras(entrada, duracion)
            };
        };

        switch (tipoJornada) {
            case "entrada_tardia":
                const entradaTardiaDate = new Date(entradaDate);
                entradaTardiaDate.setHours(entradaTardiaDate.getHours() + 1);
                return calcularBreaksParaDuracion(entradaTardiaDate, 9);

            case "salida_temprana":
                return calcularBreaksParaDuracion(entradaDate, 9);

            case "normal":
            default:
                return calcularBreaksParaDuracion(entradaDate, 10);
        }

    } catch (error) {
        console.error('Error al calcular horas:', error);
        return {
            break1: null,
            colacion: null,
            break2: null,
            hora_salida: null
        };
    }
};

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
                const tipoJornada = h.tipo_jornada || "normal";
                const horaEntrada = h.hora_entrada === "Libre" || h.hora_entrada === "" ? null : h.hora_entrada;

                // Calcular horas automáticas
                const horasCalculadas = calcularHorasConJornada(horaEntrada, tipoJornada);

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
                                const horasRecalculadas = calcularHorasConJornada(existing.hora_entrada, tipoJornada);

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

// NUEVO: Endpoint para generación automática de horarios (2 meses)
export async function PUT(request: NextRequest) {
    const client = await pool.connect();

    try {
        const { meses = 2 } = await request.json();

        console.log(`🚀 Iniciando generación automática para ${meses} meses...`);

        // 1. Obtener empleados
        const queryUsuarios = `
            SELECT 
                u.employeeid,
                u.nombre,
                u.campana_id,
                c.campana
            FROM usuarios u
            LEFT JOIN campana c ON u.campana_id = c.id
            ORDER BY u.employeeid
        `;

        const usuariosResult = await client.query(queryUsuarios);

        if (usuariosResult.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: 'No hay empleados activos para generar horarios' },
                { status: 400 }
            );
        }

        // 2. Determinar rango de fechas
        const hoy = new Date();
        const fechaFin = new Date();
        fechaFin.setMonth(fechaFin.getMonth() + meses);

        // 3. Eliminar horarios futuros existentes
        await client.query('BEGIN');

        const deleteQuery = `
            DELETE FROM horarios 
            WHERE fecha::date >= $1::date 
            AND fecha::date <= $2::date
        `;

        await client.query(deleteQuery, [
            hoy.toISOString().split('T')[0],
            fechaFin.toISOString().split('T')[0]
        ]);

        // 4. Generar horarios simples (ejemplo básico)
        // En una implementación real, aquí iría la lógica compleja de asignación
        const horariosGenerados = [];

        for (const usuario of usuariosResult.rows) {
            const fechaActual = new Date(hoy);

            while (fechaActual <= fechaFin) {
                const fechaStr = fechaActual.toISOString().split('T')[0];

                // Si el usuario está en licencia
                if (usuario.estado === 'Licencia') {
                    horariosGenerados.push({
                        employeeid: usuario.employeeid,
                        fecha: fechaStr,
                        hora_entrada: '08:00', // O la lógica que prefieras
                        tipo_jornada: 'normal'
                    });
                } else {
                    // Asignar horario básico (ejemplo simple)
                    // En producción, aquí iría la lógica de asignación inteligente
                    const horaEntrada = '08:00'; // Ejemplo básico
                    const tipoJornada = 'normal';

                    horariosGenerados.push({
                        employeeid: usuario.employeeid,
                        fecha: fechaStr,
                        hora_entrada: horaEntrada,
                        tipo_jornada: tipoJornada
                    });
                }

                // Siguiente día
                fechaActual.setDate(fechaActual.getDate() + 1);
            }
        }

        // 5. Guardar horarios generados
        let insertados = 0;

        for (const horario of horariosGenerados) {
            try {
                const usuarioRes = await client.query(
                    "SELECT campana_id FROM usuarios WHERE employeeid = $1",
                    [horario.employeeid]
                );

                const campana_id = usuarioRes.rows[0]?.campana_id || 1;
                const horaEntrada = horario.hora_entrada === "Libre" ? null : horario.hora_entrada;
                const horasCalculadas = calcularHorasConJornada(horaEntrada, horario.tipo_jornada);

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
                    horaEntrada,
                    horasCalculadas.break1,
                    horasCalculadas.colacion,
                    horasCalculadas.break2,
                    horasCalculadas.hora_salida,
                    campana_id,
                    horario.tipo_jornada
                ]);

                insertados++;

            } catch (error) {
                console.error(`Error insertando horario:`, error);
            }
        }

        await client.query('COMMIT');

        return NextResponse.json({
            success: true,
            message: `Horarios generados automáticamente para ${meses} meses`,
            resumen: {
                totalEmpleados: usuariosResult.rows.length,
                horariosGenerados: horariosGenerados.length,
                insertados: insertados,
                rango: {
                    inicio: hoy.toISOString().split('T')[0],
                    fin: fechaFin.toISOString().split('T')[0]
                }
            }
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('❌ Error en generación automática:', error);

        return NextResponse.json(
            {
                success: false,
                message: 'Error al generar horarios automáticos',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}