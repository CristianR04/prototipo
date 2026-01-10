import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { calcularHorasSegunJornada } from '@/app/Horarios/utils/calculations';
import { TipoJornada } from '@/app/Horarios/utils/types';

// Helper para manejar errores - AGREGAR ESTO AL INICIO
const handleError = (error: any, message: string) => {
  console.error(`${message}:`, error);
  return NextResponse.json(
    { success: false, message: `${message}: ${error.message}` },
    { status: 500 }
  );
};

// Interfaz para políticas
interface Politica {
  clave: string;
  valor: any;
  descripcion?: string;
}

// Función para cargar políticas
async function cargarPoliticas(client: any): Promise<Record<string, any>> {
  try {
    const result = await client.query(`
      SELECT clave, valor, descripcion 
      FROM configuracion_horarios 
      WHERE clave LIKE 'politica_%' OR clave LIKE 'regla_%'
      ORDER BY clave
    `);

    const politicas: Record<string, any> = {};
    result.rows.forEach((row: Politica) => {
      try {
        politicas[row.clave] = typeof row.valor === 'string'
          ? JSON.parse(row.valor)
          : row.valor;
      } catch (error) {
        console.warn(`⚠️ Error parsing política ${row.clave}:`, error);
        politicas[row.clave] = row.valor;
      }
    });

    return politicas;
  } catch (error) {
    console.warn('⚠️ No se pudieron cargar políticas, usando valores por defecto');
    return obtenerPoliticasPorDefecto();
  }
}

// Políticas por defecto
function obtenerPoliticasPorDefecto(): Record<string, any> {
  return {
    // Días laborales
    'politica_dias_laborales': {
      lunes: true,
      martes: true,
      miercoles: true,
      jueves: true,
      viernes: true,
      sabado: false,
      domingo: false
    },

    // Horarios permitidos
    'politica_horarios_permitidos': {
      entrada_minima: '07:00',
      entrada_maxima: '09:00',
      salida_minima: '16:00',
      salida_maxima: '18:00'
    },

    // Patrones de jornada
    'politica_patrones_jornada': {
      normal: { porcentaje: 70, duracion: 10 },
      entrada_tardia: { porcentaje: 20, max_por_mes: 3 },
      salida_temprana: { porcentaje: 10, max_por_mes: 2 }
    },

    // Rotación de horarios
    'politica_rotacion_horarios': {
      habilitada: true,
      intervalo_dias: 7,
      horarios_disponibles: ['07:00', '07:30', '08:00', '08:30', '09:00']
    },

    // Breaks
    'politica_breaks': {
      break_1: { despues_entrada: 2, duracion: 15 },
      colacion: { despues_entrada: 5, duracion: 30 },
      break_2: { despues_entrada: 8, duracion: 15 }
    }
  };
}

// Función para verificar si es día laboral según políticas
function esDiaLaboralSegunPoliticas(fecha: Date, politicas: Record<string, any>): boolean {
  const diaSemana = fecha.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
  const diasMap: Record<number, string> = {
    0: 'domingo',
    1: 'lunes',
    2: 'martes',
    3: 'miercoles',
    4: 'jueves',
    5: 'viernes',
    6: 'sabado'
  };

  const diaNombre = diasMap[diaSemana];
  const politicaDias = politicas['politica_dias_laborales'];

  if (politicaDias && typeof politicaDias[diaNombre] === 'boolean') {
    return politicaDias[diaNombre];
  }

  // Por defecto: solo días de semana
  return diaSemana >= 1 && diaSemana <= 5;
}

// Función para obtener horario permitido según políticas
function obtenerHorarioSegunPoliticas(
  politicas: Record<string, any>,
  employeeid: string,
  semanaNumero: number
): { horaEntrada: string; tipoJornada: TipoJornada } {

  const politicaHorarios = politicas['politica_horarios_permitidos'];
  const politicaRotacion = politicas['politica_rotacion_horarios'];
  const politicaPatrones = politicas['politica_patrones_jornada'];

  // Horarios disponibles
  let horariosDisponibles = ['07:00', '07:30', '08:00', '08:30', '09:00'];
  if (politicaRotacion?.horarios_disponibles) {
    horariosDisponibles = politicaRotacion.horarios_disponibles;
  }

  // Seleccionar horario basado en ID de empleado y semana
  const seed = parseInt(employeeid.replace(/\D/g, '')) || 0;
  let indiceHorario;

  if (politicaRotacion?.habilitada && politicaRotacion.intervalo_dias) {
    const intervalo = politicaRotacion.intervalo_dias;
    indiceHorario = Math.floor(semanaNumero / intervalo) % horariosDisponibles.length;
  } else {
    indiceHorario = (seed + semanaNumero) % horariosDisponibles.length;
  }

  const horaEntrada = horariosDisponibles[indiceHorario];

  // Determinar tipo de jornada según porcentajes
  const patrones = politicaPatrones || {
    normal: { porcentaje: 70 },
    entrada_tardia: { porcentaje: 20 },
    salida_temprana: { porcentaje: 10 }
  };

  const total = Object.values(patrones).reduce((sum: number, p: any) => sum + (p.porcentaje || 0), 0);
  const random = (seed + semanaNumero + new Date().getDate()) % total;

  let acumulado = 0;
  for (const [tipo, config] of Object.entries(patrones)) {
    const porcentaje = (config as any).porcentaje || 0;
    acumulado += porcentaje;
    if (random < acumulado) {
      return {
        horaEntrada,
        tipoJornada: tipo as TipoJornada
      };
    }
  }

  // Por defecto: jornada normal
  return {
    horaEntrada,
    tipoJornada: 'normal' as TipoJornada
  };
}

// Función para validar límites de tipos de jornada
function validarLimitesJornada(
  tipoJornada: TipoJornada,
  contadorMensual: Record<string, number>,
  politicas: Record<string, any>
): TipoJornada {
  const politicaPatrones = politicas['politica_patrones_jornada'];

  if (!politicaPatrones) return tipoJornada;

  const config = politicaPatrones[tipoJornada];
  if (!config) return tipoJornada;

  const maxPorMes = config.max_por_mes;
  if (maxPorMes && contadorMensual[tipoJornada] >= maxPorMes) {
    // Cambiar a normal si se excede el límite
    return 'normal' as TipoJornada;
  }

  return tipoJornada;
}

// GET: Obtener configuración
export async function GET(request: NextRequest) {
  const client = await pool.connect();

  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'todos';

    let configuracion: any = {
      reglas: {},
      horarios: {},
      casos: [],
      fechas: {}
    };

    // Obtener configuraciones generales
    const queryConfig = await client.query(`
      SELECT clave, valor, descripcion 
      FROM configuracion_horarios 
      ORDER BY clave
    `);

    for (const row of queryConfig.rows) {
      try {
        let valor: any = row.valor;

        // Solo intentar parsear si el valor es un string
        if (typeof row.valor === 'string') {
          const trimmed = row.valor.trim();

          // Intentar parsear como JSON solo si parece ser JSON
          const isJsonObject = trimmed.startsWith('{') && trimmed.endsWith('}');
          const isJsonArray = trimmed.startsWith('[') && trimmed.endsWith(']');
          const isJsonString = trimmed.startsWith('"') && trimmed.endsWith('"');

          if (isJsonObject || isJsonArray || isJsonString) {
            try {
              valor = JSON.parse(row.valor);
            } catch (e) {
              // Si falla el parseo, mantener como string
              console.warn(`No se pudo parsear JSON para ${row.clave}:`, row.valor);
              valor = row.valor;
            }
          }
          // Si no parece JSON, mantener el string original
        }

        // Categorizar por tipo
        if (row.clave.startsWith('regla_')) {
          configuracion.reglas[row.clave] = {
            valor: valor,
            descripcion: row.descripcion || ''
          };
        } else if (row.clave.startsWith('horario_')) {
          configuracion.horarios[row.clave] = {
            valor: valor,
            descripcion: row.descripcion || ''
          };
        } else if (row.clave.startsWith('fecha_')) {
          configuracion.fechas[row.clave] = valor;
        }
      } catch (error) {
        console.error(`Error procesando configuración ${row.clave}:`, error);
        // En caso de error, guardar el valor crudo
        if (row.clave.startsWith('regla_')) {
          configuracion.reglas[row.clave] = {
            valor: row.valor,
            descripcion: row.descripcion || ''
          };
        }
      }
    }

    // Obtener casos especiales
    const queryCasos = await client.query(`
      SELECT id, nombre_empleado, employeeid, pais, reglas, activo
      FROM casos_especiales 
      ORDER BY nombre_empleado
    `);

    for (const row of queryCasos.rows) {
      try {
        let reglas: any = [];

        if (typeof row.reglas === 'string') {
          try {
            const trimmed = row.reglas.trim();
            if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
              (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
              reglas = JSON.parse(row.reglas);
            } else {
              reglas = row.reglas ? [row.reglas] : [];
            }
          } catch (e) {
            reglas = row.reglas ? [row.reglas] : [];
          }
        } else if (row.reglas) {
          reglas = row.reglas;
        }

        configuracion.casos.push({
          id: row.id,
          nombre_empleado: row.nombre_empleado,
          employeeid: row.employeeid,
          pais: row.pais,
          reglas: reglas || [],
          activo: row.activo
        });
      } catch (error) {
        console.error(`Error procesando caso especial ${row.id}:`, error);
      }
    }

    // Filtrar según el tipo solicitado
    if (tipo === 'reglas') {
      return NextResponse.json({
        success: true,
        configuracion: { reglas: configuracion.reglas }
      });
    } else if (tipo === 'horarios') {
      return NextResponse.json({
        success: true,
        configuracion: { horarios: configuracion.horarios }
      });
    } else if (tipo === 'casos') {
      return NextResponse.json({
        success: true,
        configuracion: { casos: configuracion.casos }
      });
    } else if (tipo === 'fechas') {
      return NextResponse.json({
        success: true,
        configuracion: { fechas: configuracion.fechas }
      });
    }

    // Por defecto devolver todo
    return NextResponse.json({
      success: true,
      configuracion
    });

  } catch (error: any) {
    console.error('Error obteniendo configuración:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar configuración',
        error: error.message,
        configuracion: {
          reglas: {},
          horarios: {},
          casos: [],
          fechas: {}
        }
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// PUT: Generación automática con políticas
export async function PUT(request: NextRequest) {
  const client = await pool.connect();

  try {
    // Leer el cuerpo de la solicitud
    let requestBody: any;
    try {
      requestBody = await request.json();
    } catch (error) {
      requestBody = { meses: 2 };
    }

    // Validar y limitar meses (1-12)
    const meses = Math.min(Math.max(requestBody.meses || 2, 1), 12);

    console.log(`🚀 Iniciando generación inteligente para ${meses} meses con políticas...`);

    // 1. Cargar políticas
    const politicas = await cargarPoliticas(client);
    console.log('📋 Políticas cargadas:', Object.keys(politicas).length);

    // 2. Obtener empleados
    const queryUsuarios = `
      SELECT 
        u.employeeid,
        u.nombre,
        u.campana_id,
        c.campana
      FROM usuarios u
      LEFT JOIN campana c ON u.campana_id = c.id
      ORDER BY u.employeeid
    `;

    const usuariosResult = await client.query(queryUsuarios);

    if (usuariosResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No hay empleados para generar horarios' },
        { status: 400 }
      );
    }

    console.log(`👥 Empleados encontrados: ${usuariosResult.rows.length}`);

    // 3. Determinar rango de fechas
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaFin = new Date();
    fechaFin.setMonth(fechaFin.getMonth() + meses);
    fechaFin.setHours(23, 59, 59, 999);

    console.log(`📅 Rango: ${hoy.toISOString().split('T')[0]} - ${fechaFin.toISOString().split('T')[0]}`);

    // 4. Eliminar horarios futuros existentes
    await client.query('BEGIN');

    const deleteQuery = `
      DELETE FROM horarios 
      WHERE fecha::date >= $1::date 
      AND fecha::date <= $2::date
      RETURNING id
    `;

    const deleteResult = await client.query(deleteQuery, [
      hoy.toISOString().split('T')[0],
      fechaFin.toISOString().split('T')[0]
    ]);

    console.log(`🗑️ Eliminados ${deleteResult.rowCount} registros existentes`);

    // 5. Generar horarios con políticas
    const horariosGenerados: Array<{
      employeeid: string;
      fecha: string;
      hora_entrada: string;
      tipo_jornada: TipoJornada;
      campana_id: number;
    }> = [];

    const stats = {
      diasGenerados: 0,
      diasNoLaborales: 0,
      errores: 0,
      contadoresJornada: {
        normal: 0,
        entrada_tardia: 0,
        salida_temprana: 0
      }
    };

    // Para cada empleado, mantener contadores mensuales
    const contadoresPorEmpleado = new Map<string, Record<string, number>>();

    for (const usuario of usuariosResult.rows) {
      const fechaActual = new Date(hoy);
      let semanaActual = 1;
      let mesActual = fechaActual.getMonth();

      // Inicializar contadores para este empleado
      contadoresPorEmpleado.set(usuario.employeeid, {
        normal: 0,
        entrada_tardia: 0,
        salida_temprana: 0
      });

      while (fechaActual <= fechaFin) {
        try {
          // Verificar cambio de mes
          if (fechaActual.getMonth() !== mesActual) {
            mesActual = fechaActual.getMonth();
            // Reiniciar contadores mensuales
            contadoresPorEmpleado.set(usuario.employeeid, {
              normal: 0,
              entrada_tardia: 0,
              salida_temprana: 0
            });
          }

          // Actualizar semana si es lunes
          const diaSemana = fechaActual.getDay();
          if (diaSemana === 1) {
            semanaActual++;
          }

          // Verificar si es día laboral según políticas
          if (!esDiaLaboralSegunPoliticas(fechaActual, politicas)) {
            stats.diasNoLaborales++;
            fechaActual.setDate(fechaActual.getDate() + 1);
            continue;
          }

          const fechaStr = fechaActual.toISOString().split('T')[0];

          // Obtener horario según políticas
          let { horaEntrada, tipoJornada } = obtenerHorarioSegunPoliticas(
            politicas,
            usuario.employeeid,
            semanaActual
          );

          // Obtener contadores actuales del empleado
          const contadoresActuales = contadoresPorEmpleado.get(usuario.employeeid) || {
            normal: 0,
            entrada_tardia: 0,
            salida_temprana: 0
          };

          // Validar límites mensuales
          tipoJornada = validarLimitesJornada(tipoJornada, contadoresActuales, politicas);

          // Actualizar contadores
          contadoresActuales[tipoJornada]++;
          stats.contadoresJornada[tipoJornada]++;

          horariosGenerados.push({
            employeeid: usuario.employeeid,
            fecha: fechaStr,
            hora_entrada: horaEntrada,
            tipo_jornada: tipoJornada,
            campana_id: usuario.campana_id || 1
          });

          stats.diasGenerados++;

        } catch (error) {
          console.error(`Error procesando ${usuario.employeeid} - ${fechaActual}:`, error);
          stats.errores++;
        }

        fechaActual.setDate(fechaActual.getDate() + 1);
      }
    }

    console.log(`📊 Estadísticas:`, {
      ...stats,
      politicasUsadas: Object.keys(politicas)
    });

    // 6. Guardar horarios generados
    let insertados = 0;

    for (const horario of horariosGenerados) {
      try {
        const horasCalculadas = calcularHorasSegunJornada(horario.hora_entrada, horario.tipo_jornada);

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

        insertados++;

      } catch (error: any) {
        console.error(`Error insertando horario ${horario.employeeid} - ${horario.fecha}:`, error.message);
        stats.errores++;
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Horarios generados automáticamente para ${meses} meses siguiendo políticas`,
      resumen: {
        totalEmpleados: usuariosResult.rows.length,
        horariosGenerados: horariosGenerados.length,
        insertados: insertados,
        diasNoLaborales: stats.diasNoLaborales,
        errores: stats.errores,
        distribucionJornadas: stats.contadoresJornada,
        politicasAplicadas: Object.keys(politicas),
        rango: {
          inicio: hoy.toISOString().split('T')[0],
          fin: fechaFin.toISOString().split('T')[0]
        }
      }
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error en generación automática con políticas:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Error al generar horarios automáticos con políticas',
        error: error.message
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// POST: Guardar configuración
export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const { tipo, data } = await request.json();

    if (!tipo || !data) {
      return NextResponse.json(
        { success: false, message: 'Tipo y datos son requeridos' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    if (tipo === 'regla' || tipo === 'horario' || tipo === 'fecha') {
      const { clave, valor, descripcion } = data;

      // Verificar si existe
      const existe = await client.query(
        'SELECT id FROM configuracion_horarios WHERE clave = $1',
        [clave]
      );

      if (existe.rows.length > 0) {
        // Actualizar
        await client.query(`
          UPDATE configuracion_horarios 
          SET valor = $1, descripcion = $2, actualizado_en = NOW()
          WHERE clave = $3
        `, [JSON.stringify(valor), descripcion, clave]);
      } else {
        // Insertar
        await client.query(`
          INSERT INTO configuracion_horarios (clave, valor, descripcion)
          VALUES ($1, $2, $3)
        `, [clave, JSON.stringify(valor), descripcion]);
      }

    } else if (tipo === 'caso') {
      const { id, nombre_empleado, employeeid, pais, reglas, activo = true } = data;

      if (id) {
        // Actualizar caso
        await client.query(`
          UPDATE casos_especiales 
          SET nombre_empleado = $1, employeeid = $2, pais = $3, 
              reglas = $4, activo = $5, actualizado_en = NOW()
          WHERE id = $6
        `, [nombre_empleado, employeeid, pais, JSON.stringify(reglas), activo, id]);
      } else {
        // Insertar nuevo caso
        await client.query(`
          INSERT INTO casos_especiales (nombre_empleado, employeeid, pais, reglas, activo)
          VALUES ($1, $2, $3, $4, $5)
        `, [nombre_empleado, employeeid, pais, JSON.stringify(reglas), activo]);
      }

    } else if (tipo === 'multiple') {
      // Guardar múltiples configuraciones a la vez
      for (const item of data) {
        const { clave, valor, descripcion } = item;

        const existe = await client.query(
          'SELECT id FROM configuracion_horarios WHERE clave = $1',
          [clave]
        );

        if (existe.rows.length > 0) {
          await client.query(`
            UPDATE configuracion_horarios 
            SET valor = $1, descripcion = $2, actualizado_en = NOW()
            WHERE clave = $3
          `, [JSON.stringify(valor), descripcion, clave]);
        } else {
          await client.query(`
            INSERT INTO configuracion_horarios (clave, valor, descripcion)
            VALUES ($1, $2, $3)
          `, [clave, JSON.stringify(valor), descripcion]);
        }
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Configuración guardada exitosamente'
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    // USAR handleError aquí
    return handleError(error, 'Error guardando configuración');
  } finally {
    client.release();
  }
}

// DELETE: Eliminar configuración
export async function DELETE(request: NextRequest) {
  const client = await pool.connect();

  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const id = searchParams.get('id');
    const clave = searchParams.get('clave');

    if (!tipo) {
      return NextResponse.json(
        { success: false, message: 'Tipo es requerido' },
        { status: 400 }
      );
    }

    if (tipo === 'caso' && id) {
      const result = await client.query(
        'DELETE FROM casos_especiales WHERE id = $1 RETURNING *',
        [id]
      );

      return NextResponse.json({
        success: true,
        message: 'Caso especial eliminado',
        eliminado: result.rows[0]
      });

    } else if (tipo === 'config' && clave) {
      const result = await client.query(
        'DELETE FROM configuracion_horarios WHERE clave = $1 RETURNING *',
        [clave]
      );

      return NextResponse.json({
        success: true,
        message: 'Configuración eliminada',
        eliminado: result.rows[0]
      });
    }

    return NextResponse.json(
      { success: false, message: 'Parámetros inválidos' },
      { status: 400 }
    );

  } catch (error: any) {
    // USAR handleError aquí
    return handleError(error, 'Error eliminando configuración');
  } finally {
    client.release();
  }
}