import type { Appointment } from '../entities/appointment.entity.js';

export interface AppointmentResponseDto {
  id: string;
  usuario: {
    id: string;
    nombre: string;
    email: string;
    roles: string[];
  };
  negocio: { id: string; nombre: string; direccion: string | null } | null;
  estilista: {
    id: string;
    fotoUrl: string | null;
    especialidad: string;
    estadoAfiliacion: string;
    negocio?: { id: string; nombre: string; direccion: string | null } | null;
  } | null;
  servicio: { id: string; nombre: string; precio: number | string; duracionMin: number };
  fechaHora: string;
  duracionMin: number;
  precioBase: number | string | null;
  descuentoBienvenida: number | string;
  beneficioBienvenidaAplicado: boolean;
  precioTotal: number | string | null;
  estado: string;
  nota: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toAppointmentResponse(appointment: Appointment): AppointmentResponseDto {
  return {
    id: appointment.id,
    usuario: {
      id: appointment.usuario.id,
      nombre: appointment.usuario.nombre,
      email: appointment.usuario.email,
      roles: appointment.usuario.roles,
    },
    negocio: appointment.negocio
      ? {
          id: appointment.negocio.id,
          nombre: appointment.negocio.nombre,
          direccion: appointment.negocio.direccion,
        }
      : null,
    estilista: appointment.estilista
      ? {
          id: appointment.estilista.id,
          fotoUrl: appointment.estilista.fotoUrl,
          especialidad: appointment.estilista.especialidad,
          estadoAfiliacion: appointment.estilista.estadoAfiliacion,
          ...(appointment.estilista.negocio
            ? {
                negocio: {
                  id: appointment.estilista.negocio.id,
                  nombre: appointment.estilista.negocio.nombre,
                  direccion: appointment.estilista.negocio.direccion,
                },
              }
            : {}),
        }
      : null,
    servicio: {
      id: appointment.servicio.id,
      nombre: appointment.servicio.nombre,
      precio: appointment.servicio.precio,
      duracionMin: appointment.servicio.duracionMin,
    },
    fechaHora: appointment.fechaHora.toISOString(),
    duracionMin: appointment.duracionMin,
    precioBase: appointment.precioBase,
    descuentoBienvenida: appointment.descuentoBienvenida,
    beneficioBienvenidaAplicado: appointment.beneficioBienvenidaAplicado,
    precioTotal: appointment.precioTotal,
    estado: appointment.estado,
    nota: appointment.nota,
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  };
}
