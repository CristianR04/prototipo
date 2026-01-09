// app/Horarios/api/usuarios/route.ts
import { NextRequest, NextResponse } from 'next/server';
import  pool  from '@/lib/db'; 

export async function GET(request: NextRequest) {
    try {
       const usuarios = await pool.query(
            'SELECT employeeid, nombre FROM usuarios ORDER BY nombre' 
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