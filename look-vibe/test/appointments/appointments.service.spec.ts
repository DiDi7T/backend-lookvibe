import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { DataSource } from 'typeorm';
import { Business } from '../../src/businesses/entities/business.entity.js';
import { Service } from '../../src/services/entities/service.entity.js';
import { Stylist } from '../../src/stylists/entities/stylist.entity.js';
import { User } from '../../src/users/entities/user.entity.js';
import { AppointmentsService } from '../../src/appointments/appointments.service.js';
import { Appointment } from '../../src/appointments/entities/appointment.entity.js';
import { AppointmentSchedule } from '../../src/appointments/entities/appointment-schedule.entity.js';
import { AppRoles } from '../../src/auth/interfaces/app-roles.js';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  const appointmentRepository = { create: vi.fn(), save: vi.fn(), find: vi.fn(), findOne: vi.fn(), update: vi.fn() };
  const serviceRepository = { findOne: vi.fn() };
  const businessRepository = { findOne: vi.fn() };
  const stylistRepository = { findOne: vi.fn() };
  const userRepository = { findOne: vi.fn() };
  const scheduleRepository = { find: vi.fn(), count: vi.fn(), create: vi.fn(), save: vi.fn(), delete: vi.fn() };
  const transactionalManager = { query: vi.fn(), getRepository: vi.fn() };
  const dataSource = { transaction: vi.fn() };
  let scheduleRows: AppointmentSchedule[];

  beforeEach(async () => {
    vi.resetAllMocks();
    scheduleRows = [];
    scheduleRepository.find.mockImplementation(({ where = {} }: { where?: Partial<AppointmentSchedule> } = {}) => {
      const { tipoRecurso, recursoId, diaSemana } = where;
      return Promise.resolve(scheduleRows.filter((row) =>
        (!tipoRecurso || row.tipoRecurso === tipoRecurso) &&
        (!recursoId || row.recursoId === recursoId) &&
        (diaSemana === undefined || row.diaSemana === diaSemana),
      ));
    });
    scheduleRepository.count.mockImplementation(({ where }: { where: Partial<AppointmentSchedule> }) =>
      Promise.resolve(scheduleRows.filter((row) =>
        row.tipoRecurso === where.tipoRecurso && row.recursoId === where.recursoId,
      ).length),
    );
    scheduleRepository.create.mockImplementation((schedule) => schedule);
    scheduleRepository.save.mockImplementation((schedules) => {
      scheduleRows.push(...schedules);
      return Promise.resolve(schedules);
    });
    scheduleRepository.delete.mockImplementation(({ tipoRecurso, recursoId }) => {
      scheduleRows = scheduleRows.filter((row) => row.tipoRecurso !== tipoRecurso || row.recursoId !== recursoId);
      return Promise.resolve({ affected: 1 });
    });
    transactionalManager.query.mockResolvedValue(undefined);
    transactionalManager.getRepository.mockImplementation((entity) => entity === Appointment ? appointmentRepository : scheduleRepository);
    dataSource.transaction.mockImplementation((callback) => callback(transactionalManager));
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
  });

  const mockBusinessContext = () => {
    const business = { id: 'business-1', nombre: 'Belleza Plus' };
    serviceRepository.findOne.mockResolvedValue({ id: 'service-1', nombre: 'Corte', precio: 120000, duracionMin: 60, negocio: business });
    businessRepository.findOne.mockResolvedValue(business);
    userRepository.findOne.mockResolvedValue({ id: 'user-1', email: 'cliente@test.com' });
    appointmentRepository.find.mockResolvedValue([]);
    appointmentRepository.create.mockImplementation((appointment) => appointment);
    appointmentRepository.save.mockImplementation((appointment) => Promise.resolve({ id: 'apt-1', ...appointment }));
    scheduleRows.push({
      tipoRecurso: 'negocio', recursoId: 'business-1', diaSemana: 6, horaInicio: '08:00', horaFin: '20:00', zonaHoraria: 'UTC',
    } as AppointmentSchedule);
  };

  const storedAppointment = () => ({
    id: 'apt-1',
    usuario: { id: 'user-1' },
    negocio: { id: 'business-1' },
    estilista: null,
    servicio: { id: 'service-1', duracionMin: 60, precio: 120000 },
    fechaHora: new Date('2026-10-10T10:00:00.000Z'),
    duracionMin: 60,
    precioBase: 120000,
    descuentoBienvenida: 0,
    beneficioBienvenidaAplicado: false,
    precioTotal: 120000,
    estado: 'pendiente',
    nota: null,
  });

  it('creates an appointment for a business', async () => {
    mockBusinessContext();
    const result = await service.create({
      usuarioId: 'user-1', negocioId: 'business-1', servicioId: 'service-1', fechaHora: '2026-10-10T10:00:00.000Z',
    });
    expect(result).toMatchObject({
      estado: 'pendiente',
      negocio: { id: 'business-1' },
      precioBase: 120000,
      descuentoBienvenida: 12000,
      beneficioBienvenidaAplicado: true,
      precioTotal: 108000,
    });
    expect(appointmentRepository.save).toHaveBeenCalledOnce();
  });

  it.each(['pendiente', 'completada', 'cancelada', 'no_realizada'])(
    'does not apply the welcome discount when a prior business appointment is %s',
    async (estado) => {
      mockBusinessContext();
      appointmentRepository.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          id: 'prior-appointment',
          usuario: { id: 'user-1' },
          negocio: { id: 'business-1' },
          estilista: null,
          estado,
        }]);

      const result = await service.create({
        usuarioId: 'user-1',
        negocioId: 'business-1',
        servicioId: 'service-1',
        fechaHora: '2026-10-10T10:00:00.000Z',
      });

      expect(result).toMatchObject({
        precioBase: 120000,
        descuentoBienvenida: 0,
        beneficioBienvenidaAplicado: false,
        precioTotal: 120000,
      });
    },
  );

  it('creates an appointment for an independent stylist with default duration', async () => {
    stylistRepository.findOne.mockResolvedValue({ id: 'stylist-1', negocio: null });
    serviceRepository.findOne.mockResolvedValue({ id: 'service-1', precio: '50000', duracionMin: null, negocio: { id: 'business-1' } });
    userRepository.findOne.mockResolvedValue({ id: 'user-1' });
    appointmentRepository.find.mockResolvedValue([]);
    appointmentRepository.create.mockImplementation((appointment) => appointment);
    appointmentRepository.save.mockImplementation((appointment) => Promise.resolve(appointment));
    scheduleRows.push({
      tipoRecurso: 'estilista', recursoId: 'stylist-1', diaSemana: 6, horaInicio: '08:00', horaFin: '20:00', zonaHoraria: 'UTC',
    } as AppointmentSchedule);
    const result = await service.create({
      usuarioId: 'user-1', estilistaId: 'stylist-1', servicioId: 'service-1', fechaHora: '2026-10-10T10:00:00.000Z',
    });
    expect(result).toMatchObject({
      duracionMin: 60,
      precioBase: 50000,
      descuentoBienvenida: 5000,
      beneficioBienvenidaAplicado: true,
      precioTotal: 45000,
      estilista: { id: 'stylist-1' },
    });
  });

  it('does not apply the independent-stylist benefit if any prior appointment exists with that stylist', async () => {
    stylistRepository.findOne.mockResolvedValue({ id: 'stylist-1', negocio: null });
    serviceRepository.findOne.mockResolvedValue({ id: 'service-1', precio: 50000, duracionMin: 60, negocio: { id: 'business-1' } });
    userRepository.findOne.mockResolvedValue({ id: 'user-1' });
    scheduleRows.push({
      tipoRecurso: 'estilista', recursoId: 'stylist-1', diaSemana: 6,
      horaInicio: '08:00', horaFin: '20:00', zonaHoraria: 'UTC',
    } as AppointmentSchedule);
    appointmentRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'prior-appointment',
        usuario: { id: 'user-1' },
        negocio: null,
        estilista: { id: 'stylist-1', negocio: null },
        estado: 'cancelada',
      }]);
    appointmentRepository.create.mockImplementation((appointment) => appointment);
    appointmentRepository.save.mockImplementation((appointment) => Promise.resolve(appointment));

    const result = await service.create({
      usuarioId: 'user-1',
      estilistaId: 'stylist-1',
      servicioId: 'service-1',
      fechaHora: '2026-10-10T10:00:00.000Z',
    });

    expect(result).toMatchObject({ precioBase: 50000, descuentoBienvenida: 0, beneficioBienvenidaAplicado: false, precioTotal: 50000 });
  });

  it('rejects an appointment without a business or stylist booking target', async () => {
    const dto = { usuarioId: 'user-1', servicioId: 'service-1', fechaHora: '2026-10-10T10:00:00.000Z' };
    await expect(service.create(dto as any)).rejects.toThrow(BadRequestException);
    expect(userRepository.findOne).not.toHaveBeenCalled();
  });

  it('creates an appointment for a selected stylist within a business', async () => {
    mockBusinessContext();
    stylistRepository.findOne.mockResolvedValue({ id: 'stylist-1', negocio: { id: 'business-1' } });

    const result = await service.create({
      usuarioId: 'user-1',
      negocioId: 'business-1',
      estilistaId: 'stylist-1',
      servicioId: 'service-1',
      fechaHora: '2026-10-10T10:00:00.000Z',
    });

    expect(result).toMatchObject({
      negocio: { id: 'business-1' },
      estilista: { id: 'stylist-1' },
      servicio: { id: 'service-1' },
    });
  });

  it('rejects missing user, service, business, and stylist', async () => {
    const dto = { usuarioId: 'user-1', negocioId: 'business-1', servicioId: 'service-1', fechaHora: '2026-10-10T10:00:00.000Z' };
    userRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.create(dto)).rejects.toThrow('Usuario con ID user-1 no encontrado');
    userRepository.findOne.mockResolvedValue({ id: 'user-1' });
    serviceRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.create(dto)).rejects.toThrow('Servicio con ID service-1 no encontrado');
    serviceRepository.findOne.mockResolvedValue({ id: 'service-1', negocio: { id: 'business-1' } });
    businessRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.create(dto)).rejects.toThrow('Negocio con ID business-1 no encontrado');
    businessRepository.findOne.mockResolvedValue({ id: 'business-1' });
    stylistRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.create({ ...dto, negocioId: undefined, estilistaId: 'stylist-1' })).rejects.toThrow(
      'Estilista con ID stylist-1 no encontrado',
    );
  });

  it('rejects a service from a different business', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-1' });
    serviceRepository.findOne.mockResolvedValue({ id: 'service-1', negocio: { id: 'other-business' } });
    businessRepository.findOne.mockResolvedValue({ id: 'business-1' });
    await expect(service.create({
      usuarioId: 'user-1', negocioId: 'business-1', servicioId: 'service-1', fechaHora: '2026-10-10T10:00:00.000Z',
    })).rejects.toThrow('El servicio no pertenece al negocio seleccionado.');
    stylistRepository.findOne.mockResolvedValue({ id: 'stylist-1', negocio: { id: 'business-1' } });
    await expect(service.create({
      usuarioId: 'user-1', estilistaId: 'stylist-1', servicioId: 'service-1', fechaHora: '2026-10-10T10:00:00.000Z',
    })).rejects.toThrow('El servicio no pertenece al negocio del estilista seleccionado.');
  });

  it('rejects invalid date and overlapping appointments', async () => {
    mockBusinessContext();
    const dto = { usuarioId: 'user-1', negocioId: 'business-1', servicioId: 'service-1', fechaHora: '2026-10-10T10:00:00.000Z' };
    await expect(service.create({ ...dto, fechaHora: 'invalid-date' })).rejects.toThrow('La fecha y hora de la cita no es válida.');
    appointmentRepository.find.mockResolvedValue([{ fechaHora: '2026-10-10T10:30:00.000Z', duracionMin: 60, negocio: { id: 'business-1' } }]);
    await expect(service.create(dto)).rejects.toThrow('La fecha seleccionada ya no está disponible para ese negocio o estilista.');
  });

  it('lists appointments and finds one by id', async () => {
    const appointments = [storedAppointment()];
    appointmentRepository.find.mockResolvedValue(appointments);
    appointmentRepository.findOne.mockResolvedValue(appointments[0]);
    await expect(service.findAll()).resolves.toBe(appointments);
    await expect(service.findOne('apt-1')).resolves.toBe(appointments[0]);
    expect(appointmentRepository.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'apt-1' } }));
  });

  it('throws when an appointment does not exist', async () => {
    appointmentRepository.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow('Cita con ID missing no encontrada');
  });

  it('updates notes and cancellation status', async () => {
    const appointment = storedAppointment();
    appointmentRepository.findOne.mockResolvedValue(appointment);
    appointmentRepository.save.mockImplementation((saved) => Promise.resolve(saved));
    const result = await service.update('apt-1', { nota: 'Cambio de planes', motivoCancelacion: 'Solicitado' });
    expect(result).toMatchObject({ estado: 'cancelada', nota: 'Cambio de planes' });
  });

  it('rejects invalid update dates and updates service context', async () => {
    const appointment = storedAppointment();
    appointmentRepository.findOne.mockResolvedValue(appointment);
    await expect(service.update('apt-1', { fechaHora: 'invalid-date' })).rejects.toThrow('La nueva fecha y hora no es válida.');
    mockBusinessContext();
    appointmentRepository.findOne.mockResolvedValue(appointment);
    const updated = await service.update('apt-1', { servicioId: 'service-1' });
    expect(updated.servicio).toEqual(expect.objectContaining({ id: 'service-1' }));
  });

  it('preserves first-visit eligibility when the same appointment is rescheduled', async () => {
    mockBusinessContext();
    const appointment = storedAppointment();
    appointmentRepository.findOne.mockResolvedValue(appointment);
    appointmentRepository.find.mockResolvedValue([appointment]);

    const updated = await service.update('apt-1', { fechaHora: '2026-10-10T11:00:00.000Z' });

    expect(updated).toMatchObject({
      precioBase: 120000,
      descuentoBienvenida: 12000,
      beneficioBienvenidaAplicado: true,
      precioTotal: 108000,
    });
  });

  it('cancels and completes an appointment', async () => {
    const appointment = storedAppointment();
    appointmentRepository.findOne.mockResolvedValue(appointment);
    appointmentRepository.save.mockImplementation((saved) => Promise.resolve(saved));
    await expect(service.remove('apt-1', 'No puedo asistir')).resolves.toEqual({ message: 'Cita cancelada exitosamente', id: 'apt-1' });
    expect(appointment).toMatchObject({ estado: 'cancelada', nota: 'No puedo asistir' });
    await expect(service.markCompleted('apt-1')).resolves.toMatchObject({ estado: 'completada' });
    await expect(service.markCompleted('apt-1', false)).resolves.toMatchObject({ estado: 'no_realizada' });
  });

  it('returns business and stylist availability and rejects missing profiles', async () => {
    businessRepository.findOne.mockResolvedValue({ id: 'business-1' });
    stylistRepository.findOne.mockResolvedValue({ id: 'stylist-1', negocio: { id: 'business-1' } });
    scheduleRows.push(
      { tipoRecurso: 'negocio', recursoId: 'business-1', diaSemana: 6, horaInicio: '08:00', horaFin: '20:00', zonaHoraria: 'UTC' } as AppointmentSchedule,
      { tipoRecurso: 'estilista', recursoId: 'stylist-1', diaSemana: 6, horaInicio: '08:00', horaFin: '20:00', zonaHoraria: 'UTC' } as AppointmentSchedule,
    );
    const occupiedTime = new Date('2026-10-10T09:00:00.000Z');
    appointmentRepository.find.mockResolvedValue([
      { fechaHora: occupiedTime, duracionMin: 60, negocio: { id: 'business-1' }, estilista: { id: 'stylist-1' } },
    ]);
    const businessAvailability = await service.getBusinessAvailability('business-1', '2026-10-10');
    const stylistAvailability = await service.getStylistAvailability('stylist-1', '2026-10-10');
    expect(businessAvailability).toMatchObject({ businessId: 'business-1', ocupadas: 3 });
    expect(businessAvailability.slots).toHaveLength(23);
    expect(stylistAvailability).toMatchObject({ stylistId: 'stylist-1', ocupadas: 3 });
    expect(stylistAvailability.slots).toHaveLength(23);
    businessRepository.findOne.mockResolvedValue(null);
    await expect(service.getBusinessAvailability('missing')).rejects.toThrow('Negocio con ID missing no encontrado');
    stylistRepository.findOne.mockResolvedValue(null);
    await expect(service.getStylistAvailability('missing')).rejects.toThrow('Estilista con ID missing no encontrado');
  });

  it('stores business opening intervals and rejects overlapping intervals', async () => {
    const actor = { id: 'owner-1', roles: [AppRoles.negocio] } as User;
    businessRepository.findOne.mockResolvedValue({ id: 'business-1', owner: { id: actor.id } });
    const dto = {
      zonaHoraria: 'America/Bogota',
      horarios: [
        { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
        { diaSemana: 1, horaInicio: '14:00', horaFin: '18:00' },
      ],
    };

    await expect(service.setBusinessSchedule('business-1', actor, dto)).resolves.toMatchObject({
      tipoRecurso: 'negocio', recursoId: 'business-1', zonaHoraria: 'America/Bogota',
    });
    expect(scheduleRows).toHaveLength(2);
    expect(transactionalManager.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [
      'look-vibe:citas:negocio:business-1',
    ]);

    await expect(service.setBusinessSchedule('business-1', actor, {
      horarios: [
        { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
        { diaSemana: 1, horaInicio: '12:00', horaFin: '14:00' },
      ],
    })).rejects.toThrow(BadRequestException);
    await expect(service.setBusinessSchedule('business-1', actor, {
      horarios: [{ diaSemana: 1, horaInicio: '18:00', horaFin: '09:00' }],
    })).rejects.toThrow(BadRequestException);
    await service.setBusinessSchedule('business-1', actor, { horarios: [] });
    expect(scheduleRows).toHaveLength(0);
  });

  it('only allows the owner to change a business schedule', async () => {
    businessRepository.findOne.mockResolvedValue({ id: 'business-1', owner: { id: 'another-user' } });
    await expect(service.setBusinessSchedule('business-1', { id: 'user-1', roles: [AppRoles.negocio] } as User, {
      horarios: [],
    })).rejects.toThrow(ForbiddenException);
  });

  it('allows a stylist owner or affiliated business owner to set stylist hours', async () => {
    const ownStylist = { id: 'stylist-1', usuario: { id: 'stylist-user' }, negocio: null };
    stylistRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.setStylistSchedule('missing', { id: 'stylist-user', roles: [AppRoles.estilista] } as User, {
      horarios: [],
    })).rejects.toThrow('Estilista con ID missing no encontrado');

    stylistRepository.findOne.mockResolvedValueOnce(ownStylist);
    await service.setStylistSchedule('stylist-1', { id: 'stylist-user', roles: [AppRoles.estilista] } as User, { horarios: [] });

    stylistRepository.findOne.mockResolvedValueOnce(ownStylist);
    await expect(service.setStylistSchedule('stylist-1', { id: 'other-user', roles: [AppRoles.estilista] } as User, {
      horarios: [],
    })).rejects.toThrow(ForbiddenException);

    stylistRepository.findOne.mockResolvedValueOnce({
      id: 'stylist-1', usuario: null, negocio: { id: 'business-1', owner: { id: 'business-owner' } },
    });
    await service.setStylistSchedule('stylist-1', { id: 'business-owner', roles: [AppRoles.negocio] } as User, { horarios: [] });
  });

  it('uses a standalone stylist schedule and intersects affiliated stylist hours', async () => {
    const dayHours = (tipoRecurso: 'negocio' | 'estilista', recursoId: string, horaInicio: string, horaFin: string) => ({
      tipoRecurso, recursoId, diaSemana: 6, horaInicio, horaFin, zonaHoraria: 'UTC',
    }) as AppointmentSchedule;
    stylistRepository.findOne.mockResolvedValue({ id: 'independent-1', negocio: null });
    scheduleRows = [dayHours('estilista', 'independent-1', '08:00', '12:00')];
    appointmentRepository.find.mockResolvedValue([]);
    const independent = await service.getStylistAvailability('independent-1', '2026-10-10', '60', '30');
    expect(independent.slots).toHaveLength(7);

    stylistRepository.findOne.mockResolvedValue({ id: 'affiliated-1', negocio: { id: 'business-1' } });
    scheduleRows = [dayHours('negocio', 'business-1', '08:00', '20:00')];
    const inherited = await service.getStylistAvailability('affiliated-1', '2026-10-10', '60', '30');
    expect(inherited.slots).toHaveLength(23);

    scheduleRows = [
      dayHours('negocio', 'business-1', '08:00', '20:00'),
      dayHours('estilista', 'affiliated-1', '10:00', '12:00'),
    ];
    appointmentRepository.find.mockResolvedValue([
      { negocio: { id: 'business-1' }, estilista: { id: 'other-stylist', negocio: { id: 'business-1' } }, fechaHora: '2026-10-10T10:00:00.000Z', duracionMin: 60 },
    ]);
    const affiliated = await service.getStylistAvailability('affiliated-1', '2026-10-10', '60', '30');
    expect(affiliated.slots).toHaveLength(3);
    expect(affiliated.slots[0].inicio).toBe('2026-10-10T10:00:00.000Z');
    expect(affiliated.slots.every((slot) => slot.disponible)).toBe(true);
  });

  it('uses legacy stylist business relations and defaults missing duration to 60 minutes', async () => {
    businessRepository.findOne.mockResolvedValue({ id: 'business-1' });
    scheduleRows = [{
      tipoRecurso: 'negocio', recursoId: 'business-1', diaSemana: 6, horaInicio: '08:00', horaFin: '10:00', zonaHoraria: 'UTC',
    } as AppointmentSchedule];
    appointmentRepository.find.mockResolvedValue([{
      negocio: null,
      estilista: { id: 'stylist-1', negocio: { id: 'business-1' } },
      fechaHora: '2026-10-10T09:00:00.000Z',
    }]);
    const availability = await service.getBusinessAvailability('business-1', '2026-10-10');
    expect(availability.ocupadas).toBe(2);
    expect(availability.slots).toHaveLength(3);
  });

  it('validates availability date and slot duration parameters and reports closed days', async () => {
    businessRepository.findOne.mockResolvedValue({ id: 'business-1' });
    scheduleRows = [];
    appointmentRepository.find.mockResolvedValue([]);
    const closedDay = await service.getBusinessAvailability('business-1', '2026-10-10');
    expect(closedDay.slots).toEqual([]);
    expect(closedDay.zonaHoraria).toBe('America/Bogota');
    await expect(service.getBusinessAvailability('business-1', '2026-1-1')).rejects.toThrow(BadRequestException);
    await expect(service.getBusinessAvailability('business-1', '2026-02-30')).rejects.toThrow(BadRequestException);
    await expect(service.getBusinessAvailability('business-1', '2026-10-10', '0')).rejects.toThrow(BadRequestException);
    await expect(service.getBusinessAvailability('business-1', '2026-10-10', '60', '1441')).rejects.toThrow(BadRequestException);
  });

  it('rejects booking outside persisted hours and returns conflict on simultaneous overlap retry', async () => {
    mockBusinessContext();
    const dto = { usuarioId: 'user-1', negocioId: 'business-1', servicioId: 'service-1', fechaHora: '2026-10-10T07:00:00.000Z' };
    await expect(service.create(dto)).rejects.toThrow(ConflictException);
    expect(appointmentRepository.save).not.toHaveBeenCalled();

    appointmentRepository.find.mockResolvedValue([{ fechaHora: '2026-10-10T10:00:00.000Z', duracionMin: 60, negocio: { id: 'business-1' } }]);
    await expect(service.create({ ...dto, fechaHora: '2026-10-10T10:00:00.000Z' })).rejects.toThrow(ConflictException);
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(transactionalManager.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [
      'look-vibe:citas:negocio:business-1',
    ]);
  });

  it('requires configured hours before a booking can be created', async () => {
    mockBusinessContext();
    scheduleRows = [];
    await expect(service.create({
      usuarioId: 'user-1', negocioId: 'business-1', servicioId: 'service-1', fechaHora: '2026-10-10T10:00:00.000Z',
    })).rejects.toThrow('La hora seleccionada está fuera del horario disponible.');
  });
});
