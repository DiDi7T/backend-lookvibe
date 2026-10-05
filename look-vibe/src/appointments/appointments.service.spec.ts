import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { DataSource } from 'typeorm';
import { Business } from '../businesses/entities/business.entity.js';
import { Service } from '../services/entities/service.entity.js';
import { Stylist } from '../stylists/entities/stylist.entity.js';
import { User } from '../users/entities/user.entity.js';
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
});
