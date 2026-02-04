// app/Horarios/api/configuracion/inicializar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import configService from '@/app/Horarios/services/configService';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Inicializar configuración básica
    await configService.inicializarConfiguracionBasica();
    
    // Inicializar horarios por defecto si no existen
    const client = await pool.connect();
    try {
      // Verificar si existen horarios en BD
      const existe = await client.query(
        "SELECT 1 FROM configuracion_horarios WHERE clave LIKE 'horario_%' LIMIT 1"
      );
      
      if (existe.rows.length === 0) {
        console.log('⚙️ Inicializando horarios por defecto...');
        
        // Insertar horarios por defecto
        const horariosDefaults = [
          // Chile Lunes a Viernes
          [
            'horario_chile_lv',
            JSON.stringify([
              { tipo: "apertura", entrada: "08:00", salida: "18:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "08:30", salida: "18:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "09:00", salida: "19:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "09:30", salida: "19:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "10:00", salida: "20:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "10:30", salida: "20:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "11:00", salida: "21:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "11:30", salida: "21:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "cierre", entrada: "12:00", salida: "22:00", horasTrabajo: 9, horasPresencia: 10 }
            ]),
            'Horarios Chile Lunes a Viernes'
          ],
          
          // Chile Fin de Semana
          [
            'horario_chile_fs',
            JSON.stringify([
              { tipo: "normal", entrada: "09:00", salida: "19:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "09:30", salida: "19:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "10:00", salida: "20:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "10:30", salida: "20:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "11:00", salida: "21:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "11:30", salida: "21:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "cierre", entrada: "12:00", salida: "22:00", horasTrabajo: 9, horasPresencia: 10 }
            ]),
            'Horarios Chile Fines de Semana'
          ],
          
          // Colombia Lunes a Viernes
          [
            'horario_colombia_lv',
            JSON.stringify([
              { tipo: "apertura", entrada: "06:00", salida: "16:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "06:30", salida: "16:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "07:00", salida: "17:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "07:30", salida: "17:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "08:00", salida: "18:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "08:30", salida: "18:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "09:00", salida: "19:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "09:30", salida: "19:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "cierre", entrada: "10:00", salida: "20:00", horasTrabajo: 9, horasPresencia: 10 }
            ]),
            'Horarios Colombia Lunes a Viernes'
          ],
          
          // Colombia Fin de Semana
          [
            'horario_colombia_fs',
            JSON.stringify([
              { tipo: "normal", entrada: "07:00", salida: "17:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "07:30", salida: "17:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "08:00", salida: "18:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "08:30", salida: "18:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "09:00", salida: "19:00", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "normal", entrada: "09:30", salida: "19:30", horasTrabajo: 9, horasPresencia: 10 },
              { tipo: "cierre", entrada: "10:00", salida: "20:00", horasTrabajo: 9, horasPresencia: 10 }
            ]),
            'Horarios Colombia Fines de Semana'
          ]
        ];
        
        for (const [clave, valor, descripcion] of horariosDefaults) {
          await client.query(`
            INSERT INTO configuracion_horarios (clave, valor, descripcion)
            VALUES ($1, $2, $3)
            ON CONFLICT (clave) DO NOTHING
          `, [clave, valor, descripcion]);
        }
        
        console.log('✅ Horarios por defecto inicializados');
      }
    } finally {
      client.release();
    }
    
    return NextResponse.json({
      success: true,
      message: 'Configuración inicializada exitosamente'
    });
    
  } catch (error: any) {
    console.error('Error inicializando configuración:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}