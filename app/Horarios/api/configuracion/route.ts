// app/Horarios/api/configuracion/route.ts
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

// DELETE: Eliminar configuración
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const clave = searchParams.get('clave');
    const id = searchParams.get('id');

    if (!tipo) {
      return NextResponse.json(
        { success: false, message: 'Tipo es requerido' },
        { status: 400 }
      );
    }

    if (tipo === 'config' && !clave) {
      return NextResponse.json(
        { success: false, message: 'Clave es requerida para eliminar configuración' },
        { status: 400 }
      );
    }

    if (tipo === 'caso' && !id) {
      return NextResponse.json(
        { success: false, message: 'ID es requerido para eliminar caso' },
        { status: 400 }
      );
    }

    let eliminado = false;
    
    if (tipo === 'config') {
      eliminado = await configService.eliminarConfiguracion(clave!);
    } else if (tipo === 'caso') {
      eliminado = await configService.eliminarCasoEspecial(parseInt(id!));
    }

    if (eliminado) {
      return NextResponse.json({
        success: true,
        message: 'Elemento eliminado exitosamente'
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Elemento no encontrado'
      });
    }
  } catch (error: any) {
    console.error('Error eliminando configuración:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}