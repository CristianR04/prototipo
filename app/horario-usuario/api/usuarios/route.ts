// app/api/horarios-completos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db'; // Ajusta la ruta según tu configuración

export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        // Obtener todos los usuarios con sus horarios de los últimos 7 días
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
        h.campana_id as horario_campana_id
      FROM usuarios u
      LEFT JOIN campana c ON u.campana_id = c.id
      LEFT JOIN horarios h ON u.employeeid = h.employeeid 
        AND h.fecha::date >= CURRENT_DATE - INTERVAL '7 days'
        AND h.fecha::date <= CURRENT_DATE
      ORDER BY u.nombre, h.fecha ASC
    `;

        const result = await client.query(query);

        // Organizar datos por usuario
        const usuariosMap = new Map();

        result.rows.forEach((row: any) => {
            const usuarioId = row.employeeid;

            if (!usuariosMap.has(usuarioId)) {
                usuariosMap.set(usuarioId, {
                    employeeid: row.employeeid,
                    nombre: row.nombre,
                    campana: row.campana || 'Sin campaña',
                    horarios: []
                });
            }

            // Solo agregar horario si existe
            if (row.fecha) {
                const usuario = usuariosMap.get(usuarioId);
                usuario.horarios.push({
                    fecha: row.fecha.toISOString().split('T')[0], // Formato YYYY-MM-DD
                    hora_entrada: row.hora_entrada,
                    hora_salida: row.hora_salida,
                    break_1: row.break_1,
                    colacion: row.colacion,
                    break_2: row.break_2,
                    campana: row.campana || 'Sin campaña'
                });
            }
        });

        // Convertir mapa a array
        const usuarios = Array.from(usuariosMap.values());

        return NextResponse.json({
            success: true,
            usuarios: usuarios,
            total_usuarios: usuarios.length,
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