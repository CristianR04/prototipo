import { NextRequest, NextResponse } from 'next/server';
import HorarioService from '@/app/Horarios/services/horarioService';
import pool from '@/lib/db';

// GET: Obtener horarios existentes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha_inicio = searchParams.get('fecha_inicio');
    const fecha_fin = searchParams.get('fecha_fin');
    const employeeid = searchParams.get('employeeid');

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
        message: 'Error al obtener horarios',
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

// PUT: Generación automática
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

    // Verificar que todos los días tengan cobertura
    const diasSinCobertura = resultado.cobertura.filter(
      (d: any) => d.empleadosTrabajando === 0
    );

    if (diasSinCobertura.length > 0) {
      console.warn(`⚠️ ${diasSinCobertura.length} días sin empleados trabajando`);
    }

    return NextResponse.json({
      success: true,
      message: `✅ Horarios generados del ${resultado.rango.inicio} al ${resultado.rango.fin}`,
      resumen: {
        totalEmpleados: resultado.totalEmpleados,
        diasGenerados: resultado.diasGenerados,
        horariosInsertados: resultado.insertados,
        rangoFechas: resultado.rango,
        coberturaTotal: resultado.cobertura.every((d: any) => d.empleadosTrabajando > 0) 
          ? '✅ Todos los días tienen cobertura' 
          : `⚠️ ${diasSinCobertura.length} días sin cobertura`
      },
      reglasAplicadas: resultado.reglasAplicadas
    });
  } catch (error: any) {
    console.error('❌ Error en generación:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error al generar horarios',
        error: error.message
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