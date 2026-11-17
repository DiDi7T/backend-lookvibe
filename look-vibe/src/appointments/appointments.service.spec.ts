import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { DataSource } from 'typeorm';
import { Business } from '../businesses/entities/business.entity.js';
import { Service } from '../services/entities/service.entity.js';
import { Stylist } from '../stylists/entities/stylist.entity.js';
import { User } from '../users/entities/user.entity.js';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { AppointmentsService } from './appointments.service.js';
import { Appointment } from './entities/appointment.entity.js';
import { AppointmentSchedule } from './entities/appointment-schedule.entity.js';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  const appointmentRepository = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
  };
  const serviceRepository = {
    findOne: vi.fn(),
  };
  const businessRepository = {
    findOne: vi.fn(),
  };
  const stylistRepository = {
    findOne: vi.fn(),
  };
  const userRepository = {
    findOne: vi.fn(),
  };
  const scheduleRepository = { find: vi.fn(), count: vi.fn(), create: vi.fn(), save: vi.fn(), delete: vi.fn() };
  const transactionManager = {
    query: vi.fn(),
    getRepository: vi.fn((entity) => entity === Appointment ? appointmentRepository : scheduleRepository),
  };
  const dataSource = { transaction: vi.fn((callback) => callback(transactionManager)) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: getRepositoryToken(Appointment), useValue: appointmentRepository },
        { provide: getRepositoryToken(Service), useValue: serviceRepository },
        { provide: getRepositoryToken(Business), useValue: businessRepository },
        { provide: getRepositoryToken(Stylist), useValue: stylistRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(AppointmentSchedule), useValue: scheduleRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    vi.clearAllMocks();
  });

  it('should create an appointment for a business', async () => {
    const dto = {
      usuarioId: 'user-1',
      negocioId: 'business-1',
      servicioId: 'service-1',
      fechaHora: '2026-10-10T10:00:00.000Z',
    };

    businessRepository.findOne.mockResolvedValue({ id: 'business-1', nombre: 'Belleza Plus' });
    serviceRepository.findOne.mockResolvedValue({
      id: 'service-1',
      nombre: 'Corte',
      precio: 120000,
      duracionMin: 60,
      negocio: { id: 'business-1' },
    });
    userRepository.findOne.mockResolvedValue({ id: 'user-1', email: 'cliente@test.com' });
    appointmentRepository.find.mockResolvedValue([]);
    scheduleRepository.find.mockResolvedValue([
      { tipoRecurso: 'negocio', recursoId: 'business-1', diaSemana: 6, horaInicio: '08:00', horaFin: '20:00', zonaHoraria: 'UTC' },
    ]);
    appointmentRepository.create.mockImplementation((appointment) => appointment);
    appointmentRepository.save.mockImplementation((appointment) => Promise.resolve({ id: 'apt-1', ...appointment }));

    const result = await service.create(dto);

    expect(appointmentRepository.save).toHaveBeenCalled();
    expect(result.estado).toBe('pendiente');
    expect(result.negocio?.id).toBe('business-1');
    expect(result.precioBase).toBe(120000);
    expect(result.descuentoBienvenida).toBe(12000);
    expect(result.beneficioBienvenidaAplicado).toBe(true);
    expect(result.precioTotal).toBe(108000);
  });

  it('should reject an appointment without business or stylist', async () => {
    const dto = {
      usuarioId: 'user-1',
      servicioId: 'service-1',
      fechaHora: '2026-10-10T10:00:00.000Z',
    };

    await expect(service.create(dto as any)).rejects.toThrow(BadRequestException);
  });

  it('should compute a business availability summary', async () => {
    businessRepository.findOne.mockResolvedValue({ id: 'business-1' });
    scheduleRepository.find.mockResolvedValue([
      { tipoRecurso: 'negocio', recursoId: 'business-1', diaSemana: 6, horaInicio: '08:00', horaFin: '20:00', zonaHoraria: 'UTC' },
    ]);
    appointmentRepository.find.mockResolvedValue([
      { id: 'a1', negocio: { id: 'business-1' }, fechaHora: '2026-10-10T09:00:00.000Z', duracionMin: 60 },
      { id: 'a2', negocio: { id: 'business-1' }, fechaHora: '2026-10-10T11:00:00.000Z', duracionMin: 60 },
    ]);

    const result = await service.getBusinessAvailability('business-1', '2026-10-10');

    expect(result.businessId).toBe('business-1');
    expect(Array.isArray(result.slots)).toBe(true);
    expect(result.ocupadas).toBe(6);
  });

  it('limits legacy business schedules to 07:00 through 21:00 in the schedule timezone', async () => {
    businessRepository.findOne.mockResolvedValue({ id: 'business-1' });
    scheduleRepository.find.mockResolvedValue([
      { tipoRecurso: 'negocio', recursoId: 'business-1', diaSemana: 6, horaInicio: '03:00', horaFin: '23:00', zonaHoraria: 'UTC' },
    ]);
    appointmentRepository.find.mockResolvedValue([]);

    const result = await service.getBusinessAvailability('business-1', '2026-10-10');

    expect(result.zonaHoraria).toBe('UTC');
    expect(result.slots[0].inicio).toBe('2026-10-10T07:00:00.000Z');
    expect(result.slots.at(-1)?.fin).toBe('2026-10-10T21:00:00.000Z');
  });

  it('rejects business schedules that start before 07:00 or end after 21:00', async () => {
    businessRepository.findOne.mockResolvedValue({ id: 'business-1', owner: { id: 'owner-1' } });
    const actor = { id: 'owner-1', roles: [AppRoles.negocio] } as User;

    await expect(service.setBusinessSchedule('business-1', actor, {
      horarios: [{ diaSemana: 1, horaInicio: '06:59', horaFin: '20:00' }],
    })).rejects.toThrow(BadRequestException);
    await expect(service.setBusinessSchedule('business-1', actor, {
      horarios: [{ diaSemana: 1, horaInicio: '07:00', horaFin: '21:01' }],
    })).rejects.toThrow(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('scopes appointment lists to the authenticated client', async () => {
    appointmentRepository.find.mockResolvedValue([]);

    await service.findAll({ id: 'client-1', roles: [AppRoles.cliente] } as User);

    expect(appointmentRepository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: [{ usuario: { id: 'client-1' } }],
    }));
  });

  it('scopes appointment lists to the business owner and stylist', async () => {
    appointmentRepository.find.mockResolvedValue([]);

    await service.findAll({ id: 'owner-1', roles: [AppRoles.negocio] } as User);
    expect(appointmentRepository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: [
        { negocio: { owner: { id: 'owner-1' } } },
        { estilista: { negocio: { owner: { id: 'owner-1' } } } },
      ],
    }));

    appointmentRepository.find.mockClear();
    await service.findAll({ id: 'stylist-user-1', roles: [AppRoles.estilista] } as User);
    expect(appointmentRepository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: [{ estilista: { usuario: { id: 'stylist-user-1' } } }],
    }));
  });

  it('allows admins to list all appointments', async () => {
    appointmentRepository.find.mockResolvedValue([]);

    await service.findAll({ id: 'admin-1', roles: [AppRoles.admin] } as User);

    expect(appointmentRepository.find).toHaveBeenCalledWith(expect.not.objectContaining({ where: expect.anything() }));
  });

  it('returns not found when an appointment is outside the actor scope', async () => {
    appointmentRepository.findOne.mockResolvedValue(null);

    await expect(
      service.findOne('appointment-1', { id: 'client-1', roles: [AppRoles.cliente] } as User),
    ).rejects.toThrow(NotFoundException);
    expect(appointmentRepository.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: [{ id: 'appointment-1', usuario: { id: 'client-1' } }],
    }));
  });
});
