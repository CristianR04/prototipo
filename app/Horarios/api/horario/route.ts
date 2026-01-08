// app/Horarios/api/horario/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

interface HorarioRequest {
    employeeid: string;
    fecha: string;
    hora_entrada: string;
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
                h.campana_id,
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

// POST: Guardar/Actualizar - VERSIÓN MEJORADA CON CÁLCULO AUTOMÁTICO DE HORARIOS
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
                   hora_entrada, hora_salida, break_1, colacion, break_2, campana_id
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

        // Función para calcular horas automáticamente basadas en la hora de entrada
        const calcularHorasAutomaticas = (horaEntrada: string | null) => {
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
                
                // Calcular horarios según las reglas
                return {
                    break1: sumarHoras(entradaDate, 2),      // 2 horas después de entrada
                    colacion: sumarHoras(entradaDate, 5),    // 5 horas después de entrada
                    break2: sumarHoras(entradaDate, 8),      // 8 horas después de entrada
                    hora_salida: sumarHoras(entradaDate, 10) // 10 horas después de entrada
                };
                
            } catch (error) {
                console.error('Error al calcular horas automáticas:', error);
                return {
                    break1: null,
                    colacion: null,
                    break2: null,
                    hora_salida: null
                };
            }
        };

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
                
                // Convertir "Libre" a NULL
                const horaEntrada = h.hora_entrada === "Libre" || h.hora_entrada === "" ? null : h.hora_entrada;
                
                // Calcular horas automáticas basadas en la hora de entrada
                const horasCalculadas = calcularHorasAutomaticas(horaEntrada);
                
                // Clave única para identificar el registro
                const key = `${h.employeeid}_${h.fecha}`;
                const existing = existingMap.get(key);
                
                if (existing) {
                    // REGISTRO EXISTENTE: Verificar si debe actualizarse
                    const debeActualizar = (
                        // Si el nuevo valor es diferente del existente
                        horaEntrada !== existing.hora_entrada ||
                        // O si hay una campana_id diferente
                        campana_id !== existing.campana_id
                    );
                    
                    if (debeActualizar) {
                        // Solo actualizar si el registro actual tiene hora_entrada nula
                        if (existing.hora_entrada !== null) {
                            // Mantener el valor existente (no se actualiza)
                            conservados++;
                            console.log(`🔒 Conservado: ${key} (tenía valor no nulo: ${existing.hora_entrada})`);
                        } else {
                            // Actualizar registro (valor existente es nulo)
                            const updateQuery = `
                                UPDATE horarios 
                                SET hora_entrada = $1, 
                                    break_1 = $2,
                                    colacion = $3,
                                    break_2 = $4,
                                    hora_salida = $5,
                                    campana_id = $6, 
                                    updated_at = NOW()
                                WHERE id = $7
                            `;
                            
                            await client.query(updateQuery, [
                                horaEntrada,
                                horasCalculadas.break1,
                                horasCalculadas.colacion,
                                horasCalculadas.break2,
                                horasCalculadas.hora_salida,
                                campana_id,
                                existing.id
                            ]);
                            
                            actualizados++;
                            console.log(`✏️ Actualizado: ${key}`);
                            console.log(`   Entrada: ${horaEntrada}, Break1: ${horasCalculadas.break1}, Colación: ${horasCalculadas.colacion}, Break2: ${horasCalculadas.break2}, Salida: ${horasCalculadas.hora_salida}`);
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
                            created_at
                        )
                        VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, NOW())
                    `;
                    
                    await client.query(insertQuery, [
                        h.employeeid,
                        h.fecha,
                        horaEntrada,
                        horasCalculadas.break1,
                        horasCalculadas.colacion,
                        horasCalculadas.break2,
                        horasCalculadas.hora_salida,
                        campana_id
                    ]);
                    
                    insertados++;
                    console.log(`➕ Insertado: ${key}`);
                    console.log(`   Entrada: ${horaEntrada}, Break1: ${horasCalculadas.break1}, Colación: ${horasCalculadas.colacion}, Break2: ${horasCalculadas.break2}, Salida: ${horasCalculadas.hora_salida}`);
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