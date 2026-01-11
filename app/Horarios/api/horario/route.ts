import { dateCalculations } from '@/app/Horarios/utils/calculations';
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

// PUT: Generación automática CON REGLAS 5x2 - USANDO TUS CONFIGURACIONES REALES
export async function PUT(request: NextRequest) {
    const client = await pool.connect();

    try {
        // Leer el cuerpo de la solicitud
        const requestBody = await request.json();
        const meses = Math.min(Math.max(requestBody.meses || 2, 1), 12);

        console.log(`🚀 Iniciando generación para ${meses} meses usando configuraciones reales...`);

        // 1. OBTENER CONFIGURACIÓN REAL DE LA BASE DE DATOS
        const configQuery = await client.query('SELECT clave, valor, descripcion FROM configuracion_horarios');
        const config = new Map<string, any>();

        configQuery.rows.forEach((row: any) => {
            try {
                const clave = row.clave;
                let valor = row.valor;

                // Intentar parsear JSON para ciertas claves
                if (clave.startsWith('horario_') ||
                    clave.startsWith('fecha_') ||
                    clave === 'ejemplo_calculo_44_horas' ||
                    (clave.startsWith('regla_') && (typeof valor === 'string' && (valor.includes('{') || valor.includes('['))))) {

                    try {
                        // Limpiar comillas extra si las hay
                        if (typeof valor === 'string') {
                            const cleaned = valor.trim();
                            if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                                valor = JSON.parse(cleaned);
                            } else if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
                                valor = JSON.parse(cleaned);
                            }
                        }
                    } catch (parseError) {
                        console.warn(`⚠️ No se pudo parsear ${clave}:`, valor);
                        // Mantener como string si no se puede parsear
                    }
                }

                // Convertir a número si es posible
                if (clave.startsWith('regla_') && typeof valor === 'string') {
                    const numVal = parseFloat(valor);
                    if (!isNaN(numVal)) {
                        valor = numVal;
                    }
                }

                config.set(clave, valor);
            } catch (error) {
                console.warn(`⚠️ Error procesando ${row.clave}:`, error);
                config.set(row.clave, row.valor);
            }
        });

        // Extraer reglas IMPORTANTES de tu configuración real
        const reglas = {
            // Reglas básicas 5x2
            diasTrabajo: parseInt(config.get('regla_dias_trabajo') || '5'),
            diasLibres: parseInt(config.get('regla_dias_libres') || '2'),
            maxConsecutivos: parseInt(config.get('regla_max_consecutivos') || '6'),

            // Reglas de domingos
            domingosMin: parseInt(config.get('regla_domingos_min') || '16'),
            domingosMax: parseInt(config.get('regla_domingos_max') || '20'),
            domingosLibresPorEmpleado: parseInt(config.get('regla_domingos_libres') || '2'),

            // Porcentajes de turnos
            porcentajeApertura: parseFloat(config.get('regla_porcentaje_apertura') || '0.2'),
            porcentajeCierre: parseFloat(config.get('regla_porcentaje_cierre') || '0.2'),

            // Reglas de horas
            horasMaxSemanales: parseInt(config.get('regla_44_horas') || '44'),
            horasTrabajoDiario: parseInt(config.get('regla_horas_trabajo_diario') || '9'),
            horasPresenciaDiaria: parseInt(config.get('regla_presencia_diaria') || '10'),

            // Días libres
            finesSemanaLibres: parseInt(config.get('regla_fines_semana_libres') || '1'),

            // Horarios específicos de tu configuración - USA VALORES DIRECTOS
            horariosChileLV: config.get('horario_chile_lv') || [],
            horariosColombiaLV: config.get('horario_colombia_lv') || [],
            horariosChileFS: config.get('horario_chile_fs') || [],
            horariosColombiaFS: config.get('horario_colombia_fs') || []
        };

        // Verificar regla especial para 1 de enero 2026
        const fechaEspecial2026 = config.get('fecha_2026_01_01');
        const tratar2026ComoDomingo = fechaEspecial2026 &&
            typeof fechaEspecial2026 === 'object' &&
            fechaEspecial2026.tratarComo === 'domingo';

        console.log('📋 Configuraciones cargadas:', {
            reglas: Object.keys(reglas).filter(k => !k.startsWith('horarios')),
            tratar2026ComoDomingo
        });

        // 2. Obtener empleados con información de país
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
            return NextResponse.json(
                { success: false, message: 'No hay empleados para generar horarios' },
                { status: 400 }
            );
        }

        console.log(`👥 Empleados encontrados: ${usuariosResult.rows.length} (Chile: ${usuariosResult.rows.filter(u => u.pais === 'chile').length}, Colombia: ${usuariosResult.rows.filter(u => u.pais === 'colombia').length})`);


        // 3. Determinar rango de fechas
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const fechaFin = new Date();
        fechaFin.setMonth(fechaFin.getMonth() + meses);
        fechaFin.setHours(23, 59, 59, 999);

        console.log(`📅 Rango: ${hoy.toISOString().split('T')[0]} - ${fechaFin.toISOString().split('T')[0]}`);

        await client.query('BEGIN');

        // 4. OBTENER HORARIOS EXISTENTES
        const existentesQuery = `
            SELECT 
                id, employeeid, fecha::date as fecha, 
                hora_entrada, hora_salida, break_1, colacion, break_2,
                campana_id, tipo_jornada
            FROM horarios 
            WHERE fecha::date >= $1::date 
            AND fecha::date <= $2::date
            ORDER BY employeeid, fecha
        `;

        const existentesResult = await client.query(existentesQuery, [
            hoy.toISOString().split('T')[0],
            fechaFin.toISOString().split('T')[0]
        ]);

        console.log(`📊 ${existentesResult.rows.length} horarios existentes en el rango`);

        // Crear mapa para búsqueda rápida de existentes
        const existentesMap = new Map();
        existentesResult.rows.forEach((h: any) => {
            const fechaDate = new Date(h.fecha);
            const fechaStr = fechaDate.toISOString().split('T')[0];
            const key = `${h.employeeid}_${fechaStr}`;
            existentesMap.set(key, {
                id: h.id,
                employeeid: h.employeeid,
                fecha: fechaStr,
                hora_entrada: h.hora_entrada,
                hora_salida: h.hora_salida,
                break_1: h.break_1,
                colacion: h.colacion,
                break_2: h.break_2,
                campana_id: h.campana_id,
                tipo_jornada: h.tipo_jornada
            });
        });

        // 5. Obtener horarios base de configuración REALES
        const horariosChileLV: any[] = Array.isArray(config.get('horario_chile_lv'))
            ? config.get('horario_chile_lv')
            : [];

        const horariosColombiaLV: any[] = Array.isArray(config.get('horario_colombia_lv'))
            ? config.get('horario_colombia_lv')
            : [];

        const horariosChileFS: any[] = Array.isArray(config.get('horario_chile_fs'))
            ? config.get('horario_chile_fs')
            : [];

        const horariosColombiaFS: any[] = Array.isArray(config.get('horario_colombia_fs'))
            ? config.get('horario_colombia_fs')
            : [];

        // 6. FUNCIÓN MEJORADA usando tus horarios reales
        const obtenerHorarioParaSemana = (
            empleado: any,
            semanaNumero: number,
            pais: string,
            esFinSemana: boolean
        ): { horaEntrada: string | null; tipoJornada: TipoJornada } => {

            // Determinar qué conjunto de horarios usar según país
            let horariosDisponibles: any[] = [];
            if (pais === 'chile') {
                horariosDisponibles = esFinSemana ? reglas.horariosChileFS : reglas.horariosChileLV;
            } else {
                horariosDisponibles = esFinSemana ? reglas.horariosColombiaFS : reglas.horariosColombiaLV;
            }

            // Si no hay horarios configurados, usar valores por defecto
            if (horariosDisponibles.length === 0) {
                const horaDefault = esFinSemana ? '09:00' : '08:00';
                return { horaEntrada: horaDefault, tipoJornada: 'normal' };
            }

            // CALCULAR ÍNDICE BASADO EN SEMANA Y EMPLEADO
            const empleadoIdNum = parseInt(empleado.employeeid.replace(/\D/g, '')) || 0;
            const seed = (empleadoIdNum + semanaNumero) % 1000;

            // Distribución según porcentajes de tu configuración
            const randomPercent = seed % 100;
            const porcentajeApertura = Math.floor(reglas.porcentajeApertura * 100);
            const porcentajeCierre = Math.floor(reglas.porcentajeCierre * 100);

            // APERTURAS: según porcentaje configurado (20%)
            if (randomPercent < porcentajeApertura) {
                const apertura = horariosDisponibles.find((h: any) => h.tipo === 'apertura');
                if (apertura) {
                    return { horaEntrada: apertura.entrada, tipoJornada: 'apertura' };
                }
            }

            // CIERRES: según porcentaje configurado (20%)
            if (randomPercent >= (100 - porcentajeCierre)) {
                const cierre = horariosDisponibles.find((h: any) => h.tipo === 'cierre');
                if (cierre) {
                    return { horaEntrada: cierre.entrada, tipoJornada: 'cierre' };
                }
            }

            // Horarios normales - usar distribución equitativa
            const horariosNormales = horariosDisponibles.filter((h: any) =>
                !h.tipo || h.tipo === 'normal' || h.tipo === ''
            );

            if (horariosNormales.length > 0) {
                const index = (empleadoIdNum + semanaNumero) % horariosNormales.length;
                const horario = horariosNormales[index];

                // Asignar jornadas especiales ocasionalmente (10% para cada tipo especial)
                const tipoRandom = (seed + empleadoIdNum) % 10;

                if (tipoRandom < 2) { // 20% para entrada tardía
                    return {
                        horaEntrada: horario.entrada,
                        tipoJornada: 'entrada_tardia'
                    };
                } else if (tipoRandom < 3) { // 10% para salida temprana
                    return {
                        horaEntrada: horario.entrada,
                        tipoJornada: 'salida_temprana'
                    };
                }

                return {
                    horaEntrada: horario.entrada,
                    tipoJornada: 'normal'
                };
            }

            // Fallback al primer horario disponible
            return {
                horaEntrada: horariosDisponibles[0]?.entrada || '08:00',
                tipoJornada: 'normal'
            };
        };

        const necesitaDiaReducido = (
            employeeid: string,
            semanaNumero: number,
            fechaActual: Date,
            horariosParaProcesar: any[]
        ): boolean => {
            // Contar horas trabajadas en la semana actual hasta este día
            const inicioSemana = dateCalculations.startOfWeek(fechaActual);
            const diasSemana = dateCalculations.eachDayOfInterval({
                start: inicioSemana,
                end: fechaActual
            });

            let horasTrabajadas = 0;

            for (const dia of diasSemana) {
                const fechaStr = dia.toISOString().split('T')[0];
                const horario = horariosParaProcesar.find(h =>
                    h.employeeid === employeeid &&
                    h.fecha === fechaStr &&
                    !h.es_dia_libre
                );

                if (horario) {
                    // Sumar 9 horas por día normal, 8 por día reducido
                    if (horario.es_dia_reducido) {
                        horasTrabajadas += 8;
                    } else {
                        horasTrabajadas += 9;
                    }
                }
            }

            // Si ya llevamos 36 horas o más, el viernes debe ser reducido
            const esViernes = fechaActual.getDay() === 5;
            if (esViernes && horasTrabajadas >= 36) {
                return true;
            }

            return false;
        };

        // Función auxiliar para obtener número de semana ISO
        const getWeekNumber = (date: Date): number => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + 4 - (d.getDay() || 7));
            const yearStart = new Date(d.getFullYear(), 0, 1);
            const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
            return weekNo;
        };

        // 7. Generar horarios CON TUS REGLAS ESPECÍFICAS
        const horariosParaProcesar: Array<{
            employeeid: string;
            fecha: string;
            hora_entrada: string | null;
            tipo_jornada: TipoJornada;
            campana_id: number;
            es_dia_libre: boolean;
            es_dia_reducido?: boolean;
            semana_numero: number;
            es_existente?: boolean;
            id_existente?: number;
            necesita_actualizar?: boolean;
        }> = [];

        const stats = {
            totalEmpleados: usuariosResult.rows.length,
            semanasGeneradas: 0,
            diasGenerados: 0,
            diasTrabajados: 0,
            diasLibres: 0,
            domingosTrabajados: 0,
            errores: 0,
            actualizados: 0,
            insertados: 0,
            conservados: 0
        };

        // Mapa para almacenar horarios por empleado por semana
        const horariosPorSemana = new Map<string, Map<number, {
            horaEntrada: string | null;
            tipoJornada: TipoJornada;
        }>>();

        // Primera pasada: calcular horarios por semana para cada empleado
        let fechaActual = new Date(hoy);
        const fechaFinTemp = new Date(fechaFin);

        while (fechaActual <= fechaFinTemp) {
            const semanaDelAño = getWeekNumber(fechaActual);

            for (let i = 0; i < usuariosResult.rows.length; i++) {
                const usuario = usuariosResult.rows[i];
                const pais = usuario.pais || 'chile';

                // Inicializar mapa si no existe
                if (!horariosPorSemana.has(usuario.employeeid)) {
                    horariosPorSemana.set(usuario.employeeid, new Map());
                }

                const horariosEmpleado = horariosPorSemana.get(usuario.employeeid)!;

                // Calcular horario para esta semana si no existe
                if (!horariosEmpleado.has(semanaDelAño)) {
                    const diaSemana: number = fechaActual.getDay();
                    const esFinSemana = diaSemana === 0 || diaSemana === 6;

                    const horarioSemanal = obtenerHorarioParaSemana(
                        usuario,
                        semanaDelAño,
                        pais,
                        esFinSemana
                    );

                    horariosEmpleado.set(semanaDelAño, {
                        horaEntrada: horarioSemanal.horaEntrada,
                        tipoJornada: horarioSemanal.tipoJornada
                    });

                    if (diaSemana === 1) { // Solo contar una vez por semana
                        stats.semanasGeneradas++;
                    }
                }
            }

            // Avanzar a la próxima semana
            fechaActual.setDate(fechaActual.getDate() + 7);
        }

        // Segunda pasada: generar todos los días usando los horarios por semana
        fechaActual = new Date(hoy);

        while (fechaActual <= fechaFin) {
            const fechaStr = fechaActual.toISOString().split('T')[0];
            const diaSemana: number = fechaActual.getDay();
            const semanaDelAño = getWeekNumber(fechaActual);

            // Verificar si es fecha especial (1 de enero 2026)
            let esFeriadoEspecial = false;
            if (fechaStr === '2026-01-01') {
                esFeriadoEspecial = true;
                // Según tu configuración, tratar como domingo
                console.log(`🎯 ${fechaStr} es feriado, tratando como domingo`);
            }

            for (let i = 0; i < usuariosResult.rows.length; i++) {
                const usuario = usuariosResult.rows[i];

                try {
                    // Obtener horario para esta semana
                    const horariosEmpleado = horariosPorSemana.get(usuario.employeeid);
                    if (!horariosEmpleado) continue;

                    const horarioSemanal = horariosEmpleado.get(semanaDelAño);
                    if (!horarioSemanal) continue;

                    // Clave para verificar si existe
                    const claveExistente = `${usuario.employeeid}_${fechaStr}`;
                    const existente = existentesMap.get(claveExistente);

                    // REGLAS DE 5x2 SEGÚN TU CONFIGURACIÓN
                    let trabajarHoy = false;
                    let esDiaLibre = false;

                    // Si es feriado especial (1 de enero), tratar como domingo
                    const diaParaReglas = esFeriadoEspecial ? 0 : diaSemana;

                    // REGLA: Lunes obligatorios (diaParaReglas = 1)
                    if (diaParaReglas === 1) {
                        trabajarHoy = true;
                        esDiaLibre = false;
                    }
                    // REGLA: Fines de semana con límites específicos
                    else if (diaParaReglas === 0 || diaParaReglas === 6) {
                        if (diaParaReglas === 0) { // Domingo
                            const teleoperadoresEnDomingo = horariosParaProcesar.filter(h =>
                                h.fecha === fechaStr && !h.es_dia_libre
                            ).length;

                            // Usar tus reglas de domingos_min y domingos_max
                            if (teleoperadoresEnDomingo < reglas.domingosMin) {
                                trabajarHoy = (i % 3 === 0); // ~33% para cumplir mínimo
                                esDiaLibre = !trabajarHoy;
                            } else if (teleoperadoresEnDomingo < reglas.domingosMax) {
                                trabajarHoy = (i % 5 === 0); // ~20% para mantenerse en rango
                                esDiaLibre = !trabajarHoy;
                            } else {
                                trabajarHoy = false;
                                esDiaLibre = true;
                            }
                        } else { // Sábado
                            // Pocos trabajan sábados según tu configuración
                            trabajarHoy = (i % 7 === 0); // ~14%
                            esDiaLibre = !trabajarHoy;
                        }
                    }
                    // REGLA: Días de semana (martes a viernes: 2, 3, 4, 5)
                    else if (diaParaReglas >= 2 && diaParaReglas <= 5) {
                        trabajarHoy = true;
                        esDiaLibre = false;
                    }

                    // REGLA: Día reducido para cumplir 44 horas
                    // Según tu ejemplo_calculo_44_horas, reducir 1 hora los viernes
                    const esViernes = diaParaReglas === 5;
                    const noEsFinSemana = diaParaReglas !== 0 && diaParaReglas !== 6;
                    const noEsFeriado = !esFeriadoEspecial;

                    // Decidir qué día es reducido (viernes según tu ejemplo)
                    let esDiaReducido = false;
                    if (esViernes && noEsFinSemana && noEsFeriado && trabajarHoy) {
                        // Verificar si necesita día reducido para cumplir 44 horas
                        esDiaReducido = necesitaDiaReducido(
                            usuario.employeeid,
                            semanaDelAño,
                            fechaActual,
                            horariosParaProcesar
                        );
                    }

                    const horarioGenerado = {
                        employeeid: usuario.employeeid,
                        fecha: fechaStr,
                        hora_entrada: trabajarHoy ? horarioSemanal.horaEntrada : null,
                        tipo_jornada: trabajarHoy ? horarioSemanal.tipoJornada : 'normal',
                        campana_id: usuario.campana_id || 1,
                        es_dia_libre: esDiaLibre,
                        es_dia_reducido: esDiaReducido,
                        semana_numero: semanaDelAño,
                        es_existente: !!existente,
                        id_existente: existente?.id,
                        necesita_actualizar: false
                    };

                    // Verificar si necesita actualización
                    if (existente) {
                        const horaEntradaExistente = existente.hora_entrada || null;
                        const hayCambios =
                            horarioGenerado.hora_entrada !== horaEntradaExistente ||
                            horarioGenerado.tipo_jornada !== existente.tipo_jornada;

                        horarioGenerado.necesita_actualizar = hayCambios;

                        if (!hayCambios) {
                            stats.conservados++;
                        }
                    }

                    horariosParaProcesar.push(horarioGenerado);
                    stats.diasGenerados++;

                    if (trabajarHoy) {
                        stats.diasTrabajados++;
                        if (diaParaReglas === 0) stats.domingosTrabajados++;
                    } else {
                        stats.diasLibres++;
                    }

                } catch (error: any) {
                    console.error(`Error procesando ${usuario.employeeid} - ${fechaStr}:`, error);
                    stats.errores++;
                }
            }

            fechaActual.setDate(fechaActual.getDate() + 1);
        }

        console.log(`📊 Estadísticas:`, stats);

        // 8. PROCESAR HORARIOS: Actualizar existentes o insertar nuevos
        for (const horario of horariosParaProcesar) {
            try {
                // Calcular horas según tipo de jornada y día reducido
                let horasCalculadas = {
                    break1: null as string | null,
                    colacion: null as string | null,
                    break2: null as string | null,
                    hora_salida: null as string | null
                };

                if (!horario.es_dia_libre && horario.hora_entrada) {
                    horasCalculadas = calcularHorasSegunJornada(
                        horario.hora_entrada,
                        horario.tipo_jornada,
                        horario.es_dia_reducido || false
                    );
                }

                if (horario.es_existente && horario.id_existente) {
                    if (horario.necesita_actualizar) {
                        // ACTUALIZAR registro existente
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

                        const result = await client.query(updateQuery, [
                            horario.hora_entrada,
                            horasCalculadas.break1,
                            horasCalculadas.colacion,
                            horasCalculadas.break2,
                            horasCalculadas.hora_salida,
                            horario.campana_id || 1,
                            horario.tipo_jornada,
                            horario.id_existente
                        ]);

                        if (result.rowCount && result.rowCount > 0) {
                            stats.actualizados++;
                        }
                    }
                } else {
                    // INSERTAR nuevo registro
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

                    stats.insertados++;
                }

            } catch (error: any) {
                console.error(`Error procesando horario ${horario.employeeid} - ${horario.fecha}:`, error.message);
                stats.errores++;

                // Si es error de duplicado, intentar actualizar
                if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
                    try {
                        const findQuery = `
                            SELECT id FROM horarios 
                            WHERE employeeid = $1 AND fecha = $2::date
                        `;

                        const findResult = await client.query(findQuery, [
                            horario.employeeid,
                            horario.fecha
                        ]);

                        if (findResult.rowCount && findResult.rowCount > 0 && findResult.rows[0]?.id) {
                            const updateQuery = `
                                UPDATE horarios 
                                SET hora_entrada = $1, 
                                    tipo_jornada = $2,
                                    updated_at = NOW()
                                WHERE id = $3
                            `;

                            await client.query(updateQuery, [
                                horario.hora_entrada,
                                horario.tipo_jornada,
                                findResult.rows[0].id
                            ]);

                            stats.actualizados++;
                            stats.errores--;
                        }
                    } catch (updateError: any) {
                        console.error(`Error en actualización de respaldo:`, updateError.message);
                    }
                }
            }
        }

        await client.query('COMMIT');

        // REEMPLAZA el return NextResponse.json final con:

        return NextResponse.json({
            success: true,
            message: `Horarios generados para ${meses} meses usando configuraciones del sistema`,
            resumen: {
                totalEmpleados: stats.totalEmpleados,
                semanasGeneradas: stats.semanasGeneradas,
                diasTotalesGenerados: stats.diasGenerados,
                diasTrabajados: stats.diasTrabajados,
                diasLibres: stats.diasLibres,
                domingosTrabajados: stats.domingosTrabajados,
                actualizados: stats.actualizados,
                insertados: stats.insertados,
                conservados: stats.conservados,
                errores: stats.errores,
                rango: {
                    inicio: hoy.toISOString().split('T')[0],
                    fin: fechaFin.toISOString().split('T')[0]
                },
                reglasAplicadas: [
                    `✅ Turno ${reglas.diasTrabajo}x${reglas.diasLibres}`,
                    `✅ Lunes obligatorios para todos`,
                    `✅ Máximo ${reglas.maxConsecutivos} días consecutivos`,
                    `✅ ${reglas.porcentajeApertura * 100}% apertura diaria`,
                    `✅ ${reglas.porcentajeCierre * 100}% cierre diaria`,
                    `✅ ${reglas.domingosMin}-${reglas.domingosMax} teleoperadores los domingos`,
                    `✅ ${reglas.domingosLibresPorEmpleado} domingos libres por mes por empleado`,
                    `✅ ${reglas.finesSemanaLibres} fin de semana libre por mes por empleado`,
                    `✅ Ajuste de ${reglas.horasMaxSemanales} horas semanales (viernes reducido)`,
                    `✅ 1° enero 2026 tratado como ${tratar2026ComoDomingo ? 'domingo' : 'día normal'}`,
                    `✅ Horarios específicos por país (Chile: ${reglas.horariosChileLV.length}, Colombia: ${reglas.horariosColombiaLV.length})`
                ]
            }
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('❌ Error en generación:', error);

        return NextResponse.json(
            {
                success: false,
                message: 'Error al generar horarios',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}

// Función auxiliar para obtener número de semana
function getWeekNumber(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}