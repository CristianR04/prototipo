// C:\Users\jorge.gomez\Desktop\prototipo\app\horario-usuario\api\usuarios\route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        // Obtener parámetros de fecha (si existen)
        const { searchParams } = new URL(request.url);
        const fecha_inicio = searchParams.get('fecha_inicio');
        const fecha_fin = searchParams.get('fecha_fin');
        
        // Si no hay parámetros, usar rango por defecto (mes actual)
        const hoy = new Date();
        const inicioMes = fecha_inicio || new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
        const finMes = fecha_fin || new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

        const query = `
      SELECT 
        u.employeeid,
        u.nombre,
        u.campana_id,
        c.campana,
        h.fecha::date as fecha,
        h.hora_entrada,
        h.hora_salida,
        h.break_1,
        h.colacion,
        h.break_2,
        h.campana_id as horario_campana_id,
        h.tipo_jornada
      FROM usuarios u
      LEFT JOIN campana c ON u.campana_id = c.id
      LEFT JOIN horarios h ON u.employeeid = h.employeeid 
        AND h.fecha::date >= $1::date
        AND h.fecha::date <= $2::date
      WHERE u.employeeid IS NOT NULL
      ORDER BY u.nombre, h.fecha ASC
    `;

        const result = await client.query(query, [inicioMes, finMes]);

        const usuariosMap = new Map();

        result.rows.forEach((row: any) => {
            const usuarioId = row.employeeid;

            if (!usuariosMap.has(usuarioId)) {
                usuariosMap.set(usuarioId, {
                    employeeid: row.employeeid,
                    nombre: row.nombre,
                    campana: row.campana || 'Sin campaña',
                    campana_id: row.campana_id,
                    horarios: []
                });
            }

            if (row.fecha) {
                const usuario = usuariosMap.get(usuarioId);
                usuario.horarios.push({
                    fecha: row.fecha.toISOString().split('T')[0], 
                    hora_entrada: row.hora_entrada,
                    hora_salida: row.hora_salida,
                    break_1: row.break_1,
                    colacion: row.colacion,
                    break_2: row.break_2,
                    campana: row.campana || 'Sin campaña',
                    tipo_jornada: row.tipo_jornada || 'normal'
                });
            }
        });

        const usuarios = Array.from(usuariosMap.values());

        return NextResponse.json({
            success: true,
            usuarios: usuarios,
            total_usuarios: usuarios.length,
            rango_fechas: {
                inicio: inicioMes,
                fin: finMes
            },
            fecha_consulta: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Error en API horarios-completos:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Error al obtener horarios: ' + error.message,
                error: error.stack
            },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}