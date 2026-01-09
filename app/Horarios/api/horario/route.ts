// app/Horarios/api/horario/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

interface HorarioRequest {
    employeeid: string;
    fecha: string;
    hora_entrada: string;
    tipo_jornada?: "normal" | "entrada_tardia" | "salida_temprana";
}

// GET: Obtener horarios existentes (se mantiene igual)
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

// Función CORREGIDA para calcular horas con tipos de jornada - REVISIÓN FINAL
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
        // Convertir hora de entrada a Date object
        const [horas, minutos] = horaEntrada.split(':').map(Number);
        const entradaDate = new Date();
        entradaDate.setHours(horas, minutos, 0, 0);
        
        // Función auxiliar para sumar horas
        const sumarHoras = (fecha: Date, horasASumar: number): string => {
            const nuevaFecha = new Date(fecha);
            nuevaFecha.setHours(nuevaFecha.getHours() + horasASumar);
            
            // Formatear a HH:mm
            const horasStr = nuevaFecha.getHours().toString().padStart(2, '0');
            const minutosStr = nuevaFecha.getMinutes().toString().padStart(2, '0');
            return `${horasStr}:${minutosStr}`;
        };
        
        // Función para calcular breaks proporcionales
        const calcularBreaksParaDuracion = (entrada: Date, duracion: number) => {
            // Los breaks se mantienen proporcionales a la duración
            const proporcion = duracion / 10; // 10 es la duración normal
            
            return {
                break1: sumarHoras(entrada, 2 * proporcion),          // Break 1 proporcional
                colacion: sumarHoras(entrada, 5 * proporcion),        // Colación proporcional
                break2: sumarHoras(entrada, 8 * proporcion),          // Break 2 proporcional
                hora_salida: sumarHoras(entrada, duracion)           // Duración total
            };
        };

        // Calcular según tipo de jornada - LOGICA CORREGIDA
        switch (tipoJornada) {
            case "entrada_tardia":
                // Entrada tardía: Suma 1 hora a la entrada configurada
                // Jornada de 9 horas desde la nueva hora de entrada
                const entradaTardiaDate = new Date(entradaDate);
                entradaTardiaDate.setHours(entradaTardiaDate.getHours() + 1);
                
                // Jornada de 9 horas desde la entrada tardía
                return calcularBreaksParaDuracion(entradaTardiaDate, 9);
                
            case "salida_temprana":
                // Salida temprana: Jornada de 9 horas desde la hora de entrada original
                return calcularBreaksParaDuracion(entradaDate, 9);
                
            case "normal":
            default:
                // Jornada normal: 10 horas desde la hora de entrada original
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

// POST: Guardar/Actualizar - VERSIÓN CON TIPOS DE JORNADA CORREGIDA
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

        // 1. OBTENER RANGO DE FECHAS del payload
        const fechas = horarios.map(h => h.fecha);
        const fecha_inicio = fechas.sort()[0];
        const fecha_fin = fechas.sort()[fechas.length - 1];
        
        // 2. OBTENER HORARIOS EXISTENTES en el rango de fechas
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

        // Crear mapa para acceso rápido a registros existentes
        const existingMap = new Map();
        existingHorarios.forEach(h => {
            const key = `${h.employeeid}_${h.fecha.toISOString().split('T')[0]}`;
            existingMap.set(key, h);
        });

        // 3. PROCESAR CADA HORARIO DEL PAYLOAD
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
                
                // Obtener tipo de jornada (por defecto "normal")
                const tipoJornada = h.tipo_jornada || "normal";
                
                // Convertir "Libre" a NULL
                const horaEntrada = h.hora_entrada === "Libre" || h.hora_entrada === "" ? null : h.hora_entrada;
                
                // Calcular horas automáticas basadas en la hora de entrada y tipo de jornada
                const horasCalculadas = calcularHorasConJornada(horaEntrada, tipoJornada);
                
                // Clave única para identificar el registro
                const key = `${h.employeeid}_${h.fecha}`;
                const existing = existingMap.get(key);
                
                // Texto para logs según tipo de jornada
                const tipoJornadaTexto = tipoJornada === "normal" ? "Normal (10h)" :
                                       tipoJornada === "entrada_tardia" ? "Entrada tardía (9h desde entrada+1h)" :
                                       tipoJornada === "salida_temprana" ? "Salida temprana (9h desde entrada)" : "Normal";
                
                // VERIFICACIÓN IMPORTANTE: Si hay hora de entrada en el payload
                const tieneHoraEntradaEnPayload = horaEntrada !== null;
                
                if (existing) {
                    // REGISTRO EXISTENTE: Verificar si debe actualizarse
                    const debeActualizar = (
                        // Si hay una nueva hora de entrada en el payload
                        tieneHoraEntradaEnPayload ||
                        // O si el tipo de jornada es diferente
                        tipoJornada !== existing.tipo_jornada
                    );
                    
                    if (debeActualizar) {
                        // CASO 1: Hay nueva hora de entrada en el payload
                        if (tieneHoraEntradaEnPayload) {
                            // Actualizar con nueva hora de entrada y recalcular todo
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
                            console.log(`✏️ Actualizado con nueva hora: ${key} -> ${tipoJornadaTexto}`);
                            console.log(`   Entrada: ${horaEntrada}, Salida: ${horasCalculadas.hora_salida}`);
                        }
                        // CASO 2: Solo cambio de tipo de jornada (sin nueva hora de entrada)
                        else if (tipoJornada !== existing.tipo_jornada) {
                            // Si el registro ya tiene hora de entrada, recalcular con el nuevo tipo
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
                                console.log(`✏️ Actualizado solo tipo de jornada: ${key} -> ${tipoJornadaTexto}`);
                                console.log(`   Entrada: ${existing.hora_entrada} (mantenida), Salida: ${horasRecalculadas.hora_salida}`);
                            } else {
                                // Si no hay hora de entrada, solo actualizar tipo de jornada
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
                                console.log(`✏️ Actualizado solo tipo de jornada (sin hora): ${key} -> ${tipoJornadaTexto}`);
                            }
                        }
                    } else {
                        conservados++;
                    }
                } else {
                    // NUEVO REGISTRO: Insertar con todas las horas calculadas
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
                    console.log(`➕ Insertado: ${key} -> ${tipoJornadaTexto}`);
                    console.log(`   Entrada: ${horaEntrada}, Salida: ${horasCalculadas.hora_salida}`);
                }
                
            } catch (error: any) {
                console.error(`❌ Error procesando ${h.employeeid} - ${h.fecha}:`, error.message);
                errores++;
            }
        }

        await client.query('COMMIT');
        
        console.log(`
        📊 RESUMEN:
        - Nuevos insertados: ${insertados}
        - Actualizados: ${actualizados}
        - Conservados: ${conservados}
        - Errores: ${errores}
        `);
        
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

// DELETE: Eliminar horarios por rango (se mantiene igual)
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