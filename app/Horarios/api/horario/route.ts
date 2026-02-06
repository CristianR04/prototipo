import { NextRequest, NextResponse } from 'next/server';
import HorarioService from '@/app/Horarios/services/horarioService';
import ReporteService from '@/app/reportes-horario/reporteService';
import pool from '@/lib/db';

// GET: Obtener horarios existentes y reportes
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const fecha_inicio = searchParams.get('fecha_inicio');
        const fecha_fin = searchParams.get('fecha_fin');
        const employeeid = searchParams.get('employeeid');
        const reporte = searchParams.get('reporte');

        // Si se solicita un reporte específico
        if (reporte && fecha_inicio && fecha_fin) {
            switch (reporte) {
                case 'diario':
                    const reporteDiario = await ReporteService.obtenerReporteDiario(fecha_inicio, fecha_fin);
                    return NextResponse.json({
                        success: true,
                        message: 'Reporte diario generado',
                        reporte: reporteDiario
                    });

                case 'horas':
                    const reporteHoras = await ReporteService.obtenerReporteHoras(fecha_inicio, fecha_fin);
                    return NextResponse.json({
                        success: true,
                        message: 'Reporte de horas generado',
                        reporte: reporteHoras
                    });

                case 'jornadas':
                    const reporteJornadas = await ReporteService.obtenerReporteJornadas(fecha_inicio, fecha_fin);
                    return NextResponse.json({
                        success: true,
                        message: 'Reporte de tipos de jornada generado',
                        reporte: reporteJornadas
                    });

                case 'paises':
                    const reportePaises = await ReporteService.obtenerReportePaises(fecha_inicio, fecha_fin);
                    return NextResponse.json({
                        success: true,
                        message: 'Reporte por países generado',
                        reporte: reportePaises
                    });

                case 'resumen':
                    const reporteResumen = await ReporteService.obtenerReporteResumen(fecha_inicio, fecha_fin);
                    return NextResponse.json({
                        success: true,
                        message: 'Reporte resumen generado',
                        reporte: reporteResumen
                    });

                case 'completo':
                    const [
                        reporteDiarioCompleto,
                        reporteHorasCompleto,
                        reporteJornadasCompleto,
                        reportePaisesCompleto,
                        reporteResumenCompleto
                    ] = await Promise.all([
                        ReporteService.obtenerReporteDiario(fecha_inicio, fecha_fin),
                        ReporteService.obtenerReporteHoras(fecha_inicio, fecha_fin),
                        ReporteService.obtenerReporteJornadas(fecha_inicio, fecha_fin),
                        ReporteService.obtenerReportePaises(fecha_inicio, fecha_fin),
                        ReporteService.obtenerReporteResumen(fecha_inicio, fecha_fin)
                    ]);

                    return NextResponse.json({
                        success: true,
                        message: 'Reporte completo generado',
                        reportes: {
                            diario: reporteDiarioCompleto,
                            horas: reporteHorasCompleto,
                            jornadas: reporteJornadasCompleto,
                            paises: reportePaisesCompleto,
                            resumen: reporteResumenCompleto
                        }
                    });
            }
        }

        // Obtener horarios normales
        const horarios = await HorarioService.obtenerHorarios(
            fecha_inicio || undefined,
            fecha_fin || undefined,
            employeeid || undefined
        );

        return NextResponse.json({
            success: true,
            message: 'Horarios obtenidos',
            horarios
        });
    } catch (error: any) {
        console.error("Error GET:", error);
        return NextResponse.json(
            {
                success: false,
                message: 'Error al obtener horarios/reporte',
                error: error.message
            },
            { status: 500 }
        );
    }
}

// POST: Guardar/Actualizar horarios
export async function POST(request: NextRequest) {
    try {
        const horarios = await request.json();
        const resultado = await HorarioService.guardarHorarios(horarios);

        return NextResponse.json({
            success: true,
            message: `Procesamiento completado`,
            detalle: resultado
        });
    } catch (error: any) {
        console.error("❌ Error al guardar:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Error al guardar: " + error.message
            },
            { status: 500 }
        );
    }
}

// PUT: Generación automática CON REPORTES INCLUIDOS
export async function PUT(request: NextRequest) {
    try {
        const requestBody = await request.json();
        const meses = Math.min(Math.max(requestBody.meses || 1, 1), 12);

        // Validar que haya empleados
        const client = await pool.connect();
        const empleadosResult = await client.query(
            "SELECT COUNT(*) as count FROM usuarios WHERE pais IS NOT NULL"
        );
        client.release();

        if (parseInt(empleadosResult.rows[0].count) === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'No hay empleados para generar horarios'
                },
                { status: 400 }
            );
        }

        const resultado = await HorarioService.generarHorariosAutomaticos(meses);

        // Generar reportes automáticamente
        const reportes = await Promise.all([
            ReporteService.obtenerReporteDiario(resultado.rango.inicio, resultado.rango.fin),
            ReporteService.obtenerReporteHoras(resultado.rango.inicio, resultado.rango.fin),
            ReporteService.obtenerReporteJornadas(resultado.rango.inicio, resultado.rango.fin),
            ReporteService.obtenerReporteResumen(resultado.rango.inicio, resultado.rango.fin)
        ]);

        const [reporteDiario, reporteHoras, reporteJornadas, reporteResumen] = reportes;

        // Calcular métricas importantes
        const totalEmpleados = resultado.totalEmpleados;
        const diasGenerados = resultado.diasGenerados;
        const cobertura100 = resultado.cobertura?.filter(d => d.porcentajeCobertura === 100).length || 0;

        return NextResponse.json({
            success: true,
            message: `✅ Horarios generados del ${resultado.rango.inicio} al ${resultado.rango.fin}`,
            resumen: {
                totalEmpleados: resultado.totalEmpleados,
                diasGenerados: resultado.diasGenerados,
                horariosInsertados: resultado.insertados,
                rangoFechas: resultado.rango,
                cobertura100: `${cobertura100}/${diasGenerados} días con cobertura total`,
                errores: resultado.errores
            },
            cobertura: resultado.cobertura, // Detalle de cobertura por día
            reportes: {
                diario: {
                    totalDias: reporteDiario.length,
                    diasConCobertura: reporteDiario.filter(d => d.trabajando > 0).length,
                    diasCompletos: reporteDiario.filter(d => d.trabajando === totalEmpleados).length,
                    detalles: reporteDiario.slice(0, 10) // Solo primeros 10 días para no saturar
                },
                horas: {
                    totalRegistros: reporteHoras.reduce((sum, h) => sum + h.cantidad, 0),
                    distribucion: reporteHoras
                },
                jornadas: {
                    distribucion: reporteJornadas
                },
                resumen: reporteResumen
            },
            reglasAplicadas: resultado.reglasAplicadas,
            notaImportante: "✅ TODOS los ejecutivos trabajan TODOS los días. NINGÚN día sin cobertura."
        });
    } catch (error: any) {
        console.error('❌ Error en generación:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Error al generar horarios',
                error: error.message,
                nota: 'Recuerda: Todos deben trabajar todos los días'
            },
            { status: 500 }
        );
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

        await client.query('BEGIN');

        let query = 'DELETE FROM horarios WHERE fecha::date >= $1::date AND fecha::date <= $2::date';
        const params: any[] = [fecha_inicio, fecha_fin];

        if (employeeid) {
            query += ' AND employeeid = $3';
            params.push(employeeid);
        }

        query += ' RETURNING id, employeeid, fecha';

        const result = await client.query(query, params);

        await client.query('COMMIT');

        return NextResponse.json({
            success: true,
            message: 'Horarios eliminados exitosamente',
            eliminados: result.rowCount,
            detalle: result.rows
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        return NextResponse.json({
            success: false,
            message: 'Error al eliminar horarios',
            error: error.message
        }, { status: 500 });
    } finally {
        client.release();
    }
}