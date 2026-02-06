// app/Horarios/api/horario-inteligente/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { GeneradorHorariosInteligente } from './generador-horarios-inteligente';

// Interfaz para los horarios generados
interface HorarioGenerado {
  employeeid: string;
  fecha: string;
  hora_entrada: string;
  hora_salida?: string;
  tipo_jornada: string;
}

// Función auxiliar para calcular breaks (igual que en tu código actual)
const calcularHorasConJornada = (
  horaEntrada: string | null,
  horaSalida: string | null = null
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

    // Si se proporciona hora de salida, calcular duración
    let duracion = 10; // Por defecto 10 horas
    
    if (horaSalida && horaSalida !== "Libre") {
      const [horasS, minutosS] = horaSalida.split(':').map(Number);
      const salidaDate = new Date();
      salidaDate.setHours(horasS, minutosS, 0, 0);
      
      const diffMs = salidaDate.getTime() - entradaDate.getTime();
      duracion = diffMs / (1000 * 60 * 60); // Convertir a horas
    }

    const sumarHoras = (fecha: Date, horasASumar: number): string => {
      const nuevaFecha = new Date(fecha);
      nuevaFecha.setHours(nuevaFecha.getHours() + horasASumar);

      const horasStr = nuevaFecha.getHours().toString().padStart(2, '0');
      const minutosStr = nuevaFecha.getMinutes().toString().padStart(2, '0');
      return `${horasStr}:${minutosStr}`;
    };

    const proporcion = duracion / 10;

    return {
      break1: sumarHoras(entradaDate, 2 * proporcion),
      colacion: sumarHoras(entradaDate, 5 * proporcion),
      break2: sumarHoras(entradaDate, 8 * proporcion),
      hora_salida: horaSalida || sumarHoras(entradaDate, duracion)
    };

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

// POST: Generar horarios inteligentes
export async function POST(request: NextRequest) {
  const client = await pool.connect();
  
  try {
    const body = await request.json();
    const { 
      fecha_inicio = '2025-12-29', 
      fecha_fin = '2026-02-01',
      vista_previa = false // Nuevo parámetro para solo previsualizar
    } = body;

    console.log(`🚀 Iniciando generación inteligente de horarios...`);
    console.log(`📅 Rango: ${fecha_inicio} - ${fecha_fin}`);
    
    // Crear generador
    const generador = new GeneradorHorariosInteligente(fecha_inicio, fecha_fin);
    
    // Generar asignaciones
    const asignaciones = await generador.generarHorarios();
    
    console.log(`✅ ${asignaciones.length} asignaciones generadas`);
    
    // Si es vista previa, retornar solo una muestra
    if (vista_previa) {
      // Agrupar por teleoperador para estadísticas
      const porTeleoperador = new Map<string, any[]>();
      asignaciones.forEach(a => {
        if (!porTeleoperador.has(a.employeeid)) {
          porTeleoperador.set(a.employeeid, []);
        }
        porTeleoperador.get(a.employeeid)!.push(a);
      });
      
      const estadisticas = {
        totalAsignaciones: asignaciones.length,
        totalTeleoperadores: porTeleoperador.size,
        muestra: asignaciones.slice(0, 50), // Primeras 50
        distribucionTurnos: {
          apertura: asignaciones.filter(a => a.tipo_turno === 'apertura').length,
          cierre: asignaciones.filter(a => a.tipo_turno === 'cierre').length,
          normal: asignaciones.filter(a => a.tipo_turno === 'normal').length,
        },
        diasLibres: asignaciones.filter(a => a.hora_entrada === 'Libre').length,
        diasReducidos: asignaciones.filter(a => a.es_reducido).length
      };
      
      return NextResponse.json({
        success: true,
        message: 'Vista previa generada',
        estadisticas,
        nota: 'Esta es solo una vista previa. Use vista_previa=false para guardar.'
      });
    }

    // Guardar en base de datos
    await client.query('BEGIN');
    
    // 1. Eliminar horarios existentes en el rango
    const deleteResult = await client.query(
      'DELETE FROM horarios WHERE fecha::date >= $1::date AND fecha::date <= $2::date RETURNING id',
      [fecha_inicio, fecha_fin]
    );
    
    console.log(`🗑️ Eliminados ${deleteResult.rowCount} horarios existentes`);
    
    // 2. Insertar nuevos horarios
    let insertados = 0;
    let errores = 0;
    
    for (const asignacion of asignaciones) {
      try {
        // Obtener campana_id
        const usuarioRes = await client.query(
          "SELECT campana_id FROM usuarios WHERE employeeid = $1",
          [asignacion.employeeid]
        );
        
        if (usuarioRes.rows.length === 0) {
          console.warn(`⚠️ Usuario no encontrado: ${asignacion.employeeid}`);
          errores++;
          continue;
        }
        
        const campana_id = usuarioRes.rows[0]?.campana_id || 1;
        
        // Calcular breaks si no es "Libre"
        let horasCalculadas = {
          break1: null,
          colacion: null,
          break2: null,
          hora_salida: asignacion.hora_salida
        };
        
        if (asignacion.hora_entrada !== 'Libre') {
          horasCalculadas = calcularHorasConJornada(
            asignacion.hora_entrada,
            asignacion.hora_salida
          );
        }
        
        // Insertar
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
          asignacion.employeeid,
          asignacion.fecha,
          asignacion.hora_entrada === 'Libre' ? null : asignacion.hora_entrada,
          horasCalculadas.break1,
          horasCalculadas.colacion,
          horasCalculadas.break2,
          horasCalculadas.hora_salida,
          campana_id,
          'normal' // Tipo de jornada por defecto
        ]);
        
        insertados++;
        
      } catch (error: any) {
        console.error(`❌ Error insertando ${asignacion.employeeid} - ${asignacion.fecha}:`, error.message);
        errores++;
      }
    }
    
    await client.query('COMMIT');
    
    return NextResponse.json({
      success: true,
      message: 'Horarios inteligentes generados exitosamente',
      resumen: {
        totalGenerado: asignaciones.length,
        insertados,
        errores,
        eliminados: deleteResult.rowCount,
        rango: {
          inicio: fecha_inicio,
          fin: fecha_fin
        }
      }
    });
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error en generación inteligente:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Error al generar horarios inteligentes',
        error: error.message
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// GET: Obtener información sobre el generador
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    informacion: {
      nombre: 'Generador Inteligente de Horarios',
      version: '2.0',
      caracteristicas: [
        'Patrón 5x2 (5 días trabajo, 2 libres)',
        'Máximo 6 días consecutivos',
        'Dotación especial domingos (16-20 teleoperadores)',
        '1 fin de semana libre al mes',
        '2 domingos libres al mes',
        'Lunes con dotación completa',
        'Reducción automática a 44h semanales',
        'Distribución 20% apertura, 20% cierre, 60% normal',
        'Casos especiales por empleado',
        'Respeta festivos y licencias'
      ],
      parametros: {
        fecha_inicio: 'Fecha inicial (YYYY-MM-DD), default: 2025-12-29',
        fecha_fin: 'Fecha final (YYYY-MM-DD), default: 2026-02-01',
        vista_previa: 'Solo previsualizar sin guardar (boolean), default: false'
      },
      ejemplo_uso: {
        POST: '/Horarios/api/horario-inteligente',
        body: {
          fecha_inicio: '2025-12-29',
          fecha_fin: '2026-02-01',
          vista_previa: false
        }
      }
    }
  });
}