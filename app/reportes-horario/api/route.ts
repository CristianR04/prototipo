import { NextRequest, NextResponse } from 'next/server';
import ReporteService from '@/app/reportes-horario/reporteService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha_inicio = searchParams.get('fecha_inicio');
    const fecha_fin = searchParams.get('fecha_fin');
    const tipo = searchParams.get('tipo') || 'completo';

    if (!fecha_inicio || !fecha_fin) {
      return NextResponse.json(
        { success: false, message: 'Las fechas son requeridas' },
        { status: 400 }
      );
    }

    switch (tipo) {
      case 'diario':
        const reporteDiario = await ReporteService.obtenerReporteDiario(fecha_inicio, fecha_fin);
        return NextResponse.json({
          success: true,
          tipo: 'diario',
          fecha_inicio,
          fecha_fin,
          datos: reporteDiario,
          total: reporteDiario.length
        });

      case 'horas':
        const reporteHoras = await ReporteService.obtenerReporteHoras(fecha_inicio, fecha_fin);
        return NextResponse.json({
          success: true,
          tipo: 'horas',
          fecha_inicio,
          fecha_fin,
          datos: reporteHoras,
          totalHorasDiferentes: reporteHoras.length,
          totalRegistros: reporteHoras.reduce((sum, h) => sum + h.cantidad, 0)
        });

      case 'jornadas':
        const reporteJornadas = await ReporteService.obtenerReporteJornadas(fecha_inicio, fecha_fin);
        return NextResponse.json({
          success: true,
          tipo: 'jornadas',
          fecha_inicio,
          fecha_fin,
          datos: reporteJornadas,
          totalTiposJornada: reporteJornadas.length
        });

      case 'paises':
        const reportePaises = await ReporteService.obtenerReportePaises(fecha_inicio, fecha_fin);
        return NextResponse.json({
          success: true,
          tipo: 'paises',
          fecha_inicio,
          fecha_fin,
          datos: reportePaises
        });

      case 'resumen':
        const reporteResumen = await ReporteService.obtenerReporteResumen(fecha_inicio, fecha_fin);
        return NextResponse.json({
          success: true,
          tipo: 'resumen',
          fecha_inicio,
          fecha_fin,
          datos: reporteResumen
        });

      case 'completo':
      default:
        const [diario, horas, jornadas, paises, resumen] = await Promise.all([
          ReporteService.obtenerReporteDiario(fecha_inicio, fecha_fin),
          ReporteService.obtenerReporteHoras(fecha_inicio, fecha_fin),
          ReporteService.obtenerReporteJornadas(fecha_inicio, fecha_fin),
          ReporteService.obtenerReportePaises(fecha_inicio, fecha_fin),
          ReporteService.obtenerReporteResumen(fecha_inicio, fecha_fin)
        ]);

        return NextResponse.json({
          success: true,
          tipo: 'completo',
          fecha_inicio,
          fecha_fin,
          datos: {
            diario,
            horas,
            jornadas,
            paises,
            resumen
          },
          estadisticas: {
            totalDias: diario.length,
            totalHorasDiferentes: horas.length,
            totalTiposJornada: jornadas.length,
            totalPaises: paises.length
          }
        });
    }
  } catch (error: any) {
    console.error('❌ Error generando reporte:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error al generar reporte',
        error: error.message
      },
      { status: 500 }
    );
  }
}