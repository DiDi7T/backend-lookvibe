import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { AppointmentsController } from '../../src/appointments/appointments.controller.js';
import { AppointmentsService } from '../../src/appointments/appointments.service.js';
import { AppRoles } from '../../src/auth/interfaces/app-roles.js';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  const appointmentsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    getBusinessAvailability: vi.fn(),
    getStylistAvailability: vi.fn(),
    setBusinessSchedule: vi.fn(),
    setStylistSchedule: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    markCompleted: vi.fn(),
    remove: vi.fn(),
  };
  const actor = { id: 'user-1', roles: [AppRoles.cliente] } as any;
  const appointment = () => {
    const date = new Date('2026-10-10T10:00:00.000Z');
    return {
      id: 'appointment-1',
      usuario: { id: 'user-1', nombre: 'Cliente', email: 'client@test.com', roles: [AppRoles.cliente], passwordHash: 'secret' },
      negocio: null,
      estilista: null,
      servicio: { id: 'service-1', nombre: 'Corte', precio: 50000, duracionMin: 45 },
      fechaHora: date,
      duracionMin: 45,
      precioBase: 50000,
      descuentoBienvenida: 0,
      beneficioBienvenidaAplicado: false,
      precioTotal: 50000,
      estado: 'pendiente',
      nota: null,
      createdAt: date,
      updatedAt: date,
    };
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [{ provide: AppointmentsService, useValue: appointmentsService }],
    }).compile();
    controller = module.get(AppointmentsController);
  });

  it('creates a citation using the authenticated user when no usuarioId is sent', async () => {
    const user = actor;
    const dto = { servicioId: 'service-1' } as any;
    appointmentsService.create.mockResolvedValue(appointment());
    const result = await controller.create(user, dto);
    expect(result).toMatchObject({ id: 'appointment-1' });
    expect(result.usuario).not.toHaveProperty('passwordHash');
    expect(appointmentsService.create).toHaveBeenCalledWith({ ...dto, usuarioId: 'user-1' });
  });

  it('delegates appointment lookups, updates, and state changes', async () => {
    appointmentsService.findAll.mockResolvedValue([appointment()]);
    appointmentsService.findOne.mockResolvedValue(appointment());
    appointmentsService.update.mockResolvedValue(appointment());
    appointmentsService.markCompleted.mockResolvedValue(appointment());
    await controller.findAll(actor);
    await controller.findOne('appointment-1', actor);
    await controller.update('appointment-1', actor, {});
    await controller.patch('appointment-1', actor, {});
    await controller.markCompleted('appointment-1', actor);
    await controller.remove('appointment-1', actor, 'Cancelado');
    await controller.getBusinessAvailability('business-1', '2026-10-10');
    await controller.getStylistAvailability('stylist-1', '2026-10-10');
    expect(appointmentsService.findAll).toHaveBeenCalledOnce();
    expect(appointmentsService.findAll).toHaveBeenCalledWith(actor);
    expect(appointmentsService.findOne).toHaveBeenCalledWith('appointment-1', actor);
    expect(appointmentsService.update).toHaveBeenCalledTimes(2);
    expect(appointmentsService.update).toHaveBeenCalledWith('appointment-1', {}, actor);
    expect(appointmentsService.markCompleted).toHaveBeenCalledWith('appointment-1', true, actor);
    expect(appointmentsService.remove).toHaveBeenCalledWith('appointment-1', 'Cancelado', actor);
    expect(appointmentsService.getBusinessAvailability).toHaveBeenCalledWith('business-1', '2026-10-10', undefined, undefined);
    expect(appointmentsService.getStylistAvailability).toHaveBeenCalledWith('stylist-1', '2026-10-10', undefined, undefined);
  });
});
