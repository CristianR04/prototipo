import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST: Inicializar festivos desde API externa
export async function POST(request: NextRequest) {
  const client = await pool.connect();
  
  try {
    const { anio } = await request.json();
    
    if (!anio) {
      return NextResponse.json(
        { success: false, message: 'El año es requerido' },
        { status: 400 }
      );
    }
    
    // Siempre cargamos para ambos países
    const paisesArray = ['Chile', 'Colombia'];
    let totalGuardados = 0;
    const resultados = [];
    
    await client.query('BEGIN');
    
    for (const paisActual of paisesArray) {
      try {
        const festivos = await obtenerDeAPI(paisActual, anio);
        
        if (festivos.length > 0) {
          const guardados = await guardarEnBD(client, festivos);
          totalGuardados += guardados;
          resultados.push({
            pais: paisActual,
            anio,
            festivosEncontrados: festivos.length,
            guardados,
            success: true
          });
        } else {
          resultados.push({
            pais: paisActual,
            anio,
            festivosEncontrados: 0,
            guardados: 0,
            success: false,
            message: 'No se encontraron festivos en la API externa'
          });
        }
      } catch (error: any) {
        resultados.push({
          pais: paisActual,
          anio,
          success: false,
          message: error.message
        });
      }
    }
    
    await client.query('COMMIT');
    
    return NextResponse.json({
      success: true,
      message: `${totalGuardados} festivos nuevos guardados`,
      total: totalGuardados,
      resultados,
      ejecutadoEl: new Date().toISOString()
    });
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// GET: Consultar festivos de la BD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pais = searchParams.get('pais') || 'Chile';
  const año = searchParams.get('año') || new Date().getFullYear().toString();
  
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT fecha::text, descripcion, pais 
       FROM dias_festivos 
       WHERE pais = $1 AND EXTRACT(YEAR FROM fecha) = $2 
       ORDER BY fecha`,
      [pais, año]
    );
    
    return NextResponse.json({
      success: true,
      festivos: result.rows,
      total: result.rowCount
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// DELETE: Eliminar festivos
export async function DELETE(request: NextRequest) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const result = await client.query(`
      DELETE FROM dias_festivos 
      RETURNING id, fecha, pais
    `);
    
    await client.query('COMMIT');
    
    return NextResponse.json({
      success: true,
      message: 'Festivos eliminados exitosamente',
      eliminados: result.rowCount,
      detalle: result.rows
    });
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error al eliminar festivos',
        error: error.message 
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// ========== FUNCIONES AUXILIARES ==========

// Obtener SOLO de API externa
async function obtenerDeAPI(pais: string, año: number) {
  const codigo = pais === 'Chile' ? 'CL' : pais === 'Colombia' ? 'CO' : null;
  if (!codigo) {
    return [];
  }
  
  const url = `https://date.nager.at/api/v3/PublicHolidays/${año}/${codigo}`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return [];
    }
    
    return data.map((item: any) => ({
      fecha: item.date,
      descripcion: item.localName || item.name,
      pais: pais
    }));
    
  } catch (error: any) {
    return [];
  }
}

// Guardar en BD
async function guardarEnBD(client: any, festivos: Array<{fecha: string, descripcion: string, pais: string}>) {
  let guardados = 0;
  
  for (const festivo of festivos) {
    try {
      const existe = await client.query(
        `SELECT id FROM dias_festivos 
         WHERE fecha = $1 AND pais = $2`,
        [festivo.fecha, festivo.pais]
      );
      
      if (existe.rows.length === 0) {
        try {
          const result = await client.query(
            `INSERT INTO dias_festivos (fecha, descripcion, pais) 
             VALUES ($1, $2, $3) 
             RETURNING id`,
            [festivo.fecha, festivo.descripcion, festivo.pais]
          );
          
          if (result.rows.length > 0) {
            guardados++;
          }
        } catch (insertError: any) {
          if (insertError.message.includes('unique') || 
              insertError.message.includes('duplicate') ||
              insertError.message.includes('restricción única')) {
            continue;
          }
        }
      }
    } catch (error: any) {
      continue;
    }
  }
  
  return guardados;
}