import { NextRequest, NextResponse } from 'next/server';
import configService from '@/app/Horarios/services/configService';

// GET: Obtener configuración
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'todos';

    const { reglas, casos } = await configService.obtenerConfiguracionCompleta();

    // Filtrar según tipo
    if (tipo === 'reglas') {
      return NextResponse.json({ success: true, reglas });
    } else if (tipo === 'casos') {
      return NextResponse.json({ success: true, casos });
    }

    return NextResponse.json({ success: true, reglas, casos });
  } catch (error: any) {
    console.error('Error obteniendo configuración:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// POST: Guardar configuración
export async function POST(request: NextRequest) {
  try {
    const { tipo, data } = await request.json();

    if (!tipo || !data) {
      return NextResponse.json(
        { success: false, message: 'Tipo y datos son requeridos' },
        { status: 400 }
      );
    }

    await configService.actualizarConfiguracion(tipo, data);

    return NextResponse.json({
      success: true,
      message: 'Configuración guardada exitosamente'
    });
  } catch (error: any) {
    console.error('Error guardando configuración:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}