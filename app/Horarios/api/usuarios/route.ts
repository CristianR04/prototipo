// app/Horarios/api/usuarios/route.ts
import { NextRequest, NextResponse } from 'next/server';
import  pool  from '@/lib/db'; // Ajusta según tu configuración de base de datos

export async function GET(request: NextRequest) {
    try {
        // Ejemplo con PostgreSQL (ajusta según tu DB)
        const usuarios = await pool.query(
            'SELECT employeeid, nombre FROM usuarios ORDER BY nombre' // Ajusta los nombres de campos
        );

        return NextResponse.json({
            success: true,
            usuarios: usuarios.rows
        });
    } catch (error: any) {
        console.error('Error al obtener usuarios:', error);
        return NextResponse.json(
            { 
                success: false, 
                message: 'Error al cargar usuarios: ' + error.message 
            },
            { status: 500 }
        );
    }
}