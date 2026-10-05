import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { AppointmentsController } from '../../src/appointments/appointments.controller.js';
import { AppointmentsService } from '../../src/appointments/appointments.service.js';

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

  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [{ provide: AppointmentsService, useValue: appointmentsService }],
    }).compile();
    controller = module.get(AppointmentsController);
  });

  it('creates a citation using the authenticated user when no usuarioId is sent', async () => {
    const user = { id: 'user-1' } as any;
    const dto = { servicioId: 'service-1' } as any;
    appointmentsService.create.mockResolvedValue({ id: 'appointment-1' });
    await expect(controller.create(user, dto)).resolves.toEqual({ id: 'appointment-1' });
    expect(appointmentsService.create).toHaveBeenCalledWith({ ...dto, usuarioId: 'user-1' });
  });

  it('delegates appointment lookups, updates, and state changes', async () => {
    await controller.findAll();
    await controller.findOne('appointment-1');
    await controller.update('appointment-1', {});
    await controller.patch('appointment-1', {});
    await controller.markCompleted('appointment-1');
    await controller.remove('appointment-1', 'Cancelado');
    await controller.getBusinessAvailability('business-1', '2026-10-10');
    await controller.getStylistAvailability('stylist-1', '2026-10-10');
    expect(appointmentsService.findAll).toHaveBeenCalledOnce();
    expect(appointmentsService.findOne).toHaveBeenCalledWith('appointment-1');
    expect(appointmentsService.update).toHaveBeenCalledTimes(2);
    expect(appointmentsService.markCompleted).toHaveBeenCalledWith('appointment-1', true);
    expect(appointmentsService.remove).toHaveBeenCalledWith('appointment-1', 'Cancelado');
    expect(appointmentsService.getBusinessAvailability).toHaveBeenCalledWith('business-1', '2026-10-10', undefined, undefined);
    expect(appointmentsService.getStylistAvailability).toHaveBeenCalledWith('stylist-1', '2026-10-10', undefined, undefined);
  });
});