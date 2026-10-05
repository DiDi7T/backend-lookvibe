import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppRoles } from '../../src/auth/interfaces/app-roles.js';
import { Business } from '../../src/businesses/entities/business.entity.js';
import { Appointment } from '../../src/appointments/entities/appointment.entity.js';
import { AppointmentSchedule } from '../../src/appointments/entities/appointment-schedule.entity.js';
import { Review } from '../../src/reviews/entities/review.entity.js';
import { User } from '../../src/users/entities/user.entity.js';
import { ReportsService } from '../../src/reports/reports.service.js';

const makeBuilder = (
  rawMany: unknown[] = [],
  rawOne: Record<string, unknown> | null = null,
) => {
  const builder = {
    clone: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    select: vi.fn(),
    addSelect: vi.fn(),
    setParameter: vi.fn(),
    groupBy: vi.fn(),
    addGroupBy: vi.fn(),
    orderBy: vi.fn(),
    addOrderBy: vi.fn(),
    limit: vi.fn(),
    getRawMany: vi.fn().mockResolvedValue(rawMany),
    getRawOne: vi.fn().mockResolvedValue(rawOne),
  };
  for (const method of [
    builder.leftJoin,
    builder.where,
    builder.andWhere,
    builder.select,
    builder.addSelect,
    builder.setParameter,
    builder.groupBy,
    builder.addGroupBy,
    builder.orderBy,
    builder.addOrderBy,
    builder.limit,
  ])
    method.mockReturnValue(builder);
  return builder;
};

describe('ReportsService', () => {
  const owner = { id: 'owner-1', roles: [AppRoles.negocio] } as User;
  let service: ReportsService;
  let appointmentRepository: any;
  let businessRepository: any;
  let userRepository: any;
  let reviewRepository: any;
  let scheduleRepository: any;
  let baseBuilder: ReturnType<typeof makeBuilder>;
  let weeklyBuilder: ReturnType<typeof makeBuilder>;
  let monthlyBuilder: ReturnType<typeof makeBuilder>;
  let summaryBuilder: ReturnType<typeof makeBuilder>;
  let serviceBuilder: ReturnType<typeof makeBuilder>;
  let revenueBuilder: ReturnType<typeof makeBuilder>;
  let reviewBuilder: ReturnType<typeof makeBuilder>;

  const setupBusinessReport = () => {
    weeklyBuilder = makeBuilder([
      {
        periodo: '2026-10-05',
        total: '4',
        pendientes: '1',
        completadas: '2',
        canceladas: '1',
        no_realizadas: '0',
      },
    ]);
    monthlyBuilder = makeBuilder([
      {
        periodo: '2026-10-01',
        total: '4',
        pendientes: '1',
        completadas: '2',
        canceladas: '1',
        no_realizadas: '0',
      },
    ]);
    summaryBuilder = makeBuilder([], {
      total: '4',
      pendientes: '1',
      completadas: '2',
      canceladas: '1',
      no_realizadas: '0',
    });
    serviceBuilder = makeBuilder([], {
      servicioId: 'service-1',
      nombre: 'Corte',
      cantidad: '3',
    });
    revenueBuilder = makeBuilder([], { ingresosEstimados: '125000.50' });
    reviewBuilder = makeBuilder([], { promedio: '4.5', cantidad: '2' });
    baseBuilder.clone
      .mockReturnValueOnce(weeklyBuilder)
      .mockReturnValueOnce(monthlyBuilder)
      .mockReturnValueOnce(summaryBuilder)
      .mockReturnValueOnce(serviceBuilder)
      .mockReturnValueOnce(revenueBuilder);
    reviewRepository.createQueryBuilder.mockReturnValue(reviewBuilder);
  };

  beforeEach(() => {
    appointmentRepository = {
      createQueryBuilder: vi.fn(),
      find: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      query: vi.fn().mockResolvedValue([]),
    };
    businessRepository = {
      findOne: vi
        .fn()
        .mockResolvedValue({
          id: 'business-1',
          nombre: 'Barbería Granada',
          owner,
        }),
      count: vi.fn().mockResolvedValue(1),
    };
    userRepository = {
      count: vi.fn().mockResolvedValue(12),
      findOneBy: vi.fn(),
    };
    reviewRepository = {
      createQueryBuilder: vi.fn(),
      count: vi.fn().mockResolvedValue(5),
    };
    scheduleRepository = {
      findOne: vi.fn().mockResolvedValue({ zonaHoraria: 'America/Bogota' }),
    };
    baseBuilder = makeBuilder();
    appointmentRepository.createQueryBuilder.mockReturnValue(baseBuilder);
    setupBusinessReport();
    service = new ReportsService(
      appointmentRepository as never,
      businessRepository as never,
      userRepository as never,
      reviewRepository as never,
      scheduleRepository as never,
    );
  });

  it('aggregates periods, income, popular service, and read-only review ratings', async () => {
    const report = await service.getBusinessReport('business-1', owner, {
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });

    expect(report).toMatchObject({
      negocio: { id: 'business-1', nombre: 'Barbería Granada' },
      periodo: {
        desde: '2026-10-01',
        hasta: '2026-10-31',
        zonaHoraria: 'America/Bogota',
      },
      citas: {
        total: 4,
        completadas: 2,
        semanal: [{ periodo: '2026-10-05', total: 4 }],
        mensual: [{ periodo: '2026-10-01', total: 4 }],
      },
      servicioMasSolicitado: { id: 'service-1', nombre: 'Corte', cantidad: 3 },
      ingresosEstimados: 125000.5,
      calificacionPromedio: 4.5,
      cantidadResenas: 2,
    });
    expect(reviewBuilder.andWhere).toHaveBeenCalledWith(
      'review.reportado = false',
    );
    expect(reviewRepository).not.toHaveProperty('save');
  });

  it('uses a default rolling year and fallback timezone, denies other owners, and returns 404 for missing business', async () => {
    scheduleRepository.findOne.mockResolvedValue(null);
    const report = await service.getBusinessReport('business-1', owner);
    expect(report.periodo.zonaHoraria).toBe('America/Bogota');
    expect(report.periodo.hasta).toBe(new Date().toISOString().slice(0, 10));

    await expect(
      service.getBusinessReport('business-1', {
        id: 'other-owner',
        roles: [AppRoles.negocio],
      } as User),
    ).rejects.toThrow(ForbiddenException);
    businessRepository.findOne.mockResolvedValue(null);
    await expect(service.getBusinessReport('missing', owner)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns global usage only to admin', async () => {
    appointmentRepository.query.mockResolvedValue([
      { periodo: '2026-10', citas: '8' },
    ]);
    const report = await service.getUsageReport({
      id: 'admin',
      roles: [AppRoles.admin],
    } as User);
    expect(report).toMatchObject({
      usuarios: 12,
      negocios: 1,
      negociosActivos: 1,
      citas: 0,
      resenas: 5,
      citasPorMes: [{ periodo: '2026-10', citas: 8 }],
    });
    await expect(service.getUsageReport(owner)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("returns the user's complete appointment history and status summary without exposing user fields", async () => {
    const historyUser = { id: 'user-1', nombre: 'Cliente', passwordHash: 'must-not-leak' } as User;
    userRepository.findOneBy.mockResolvedValue(historyUser);
    appointmentRepository.find.mockResolvedValue([
      {
        id: 'appointment-1', fechaHora: new Date('2026-10-12T10:00:00Z'), estado: 'completada',
        negocio: { id: 'business-1', nombre: 'Barbería Granada' }, estilista: null,
        servicio: { id: 'service-1', nombre: 'Corte' }, duracionMin: 60,
        precioBase: 50000, descuentoBienvenida: 5000, beneficioBienvenidaAplicado: true, precioTotal: 45000,
        nota: 'Primera visita',
      },
      {
        id: 'appointment-2', fechaHora: new Date('2026-10-10T10:00:00Z'), estado: 'cancelada',
        negocio: null, estilista: { id: 'stylist-1', especialidad: 'Barbería', negocio: null },
        servicio: { id: 'service-2', nombre: 'Perfilado' }, duracionMin: 30,
        precioBase: 20000, descuentoBienvenida: 0, beneficioBienvenidaAplicado: false, precioTotal: 20000,
        nota: null,
      },
      {
        id: 'appointment-3', fechaHora: new Date('2026-10-09T10:00:00Z'), estado: 'no_realizada',
        negocio: null, estilista: null, servicio: { id: 'service-3', nombre: 'Otro' }, duracionMin: 30,
        precioBase: 10000, descuentoBienvenida: 0, beneficioBienvenidaAplicado: false, precioTotal: 10000,
        nota: null,
      },
      {
        id: 'appointment-4', fechaHora: new Date('2026-10-08T10:00:00Z'), estado: 'pendiente',
        negocio: null, estilista: null, servicio: { id: 'service-4', nombre: 'Otro' }, duracionMin: 30,
        precioBase: 10000, descuentoBienvenida: 0, beneficioBienvenidaAplicado: false, precioTotal: 10000,
        nota: null,
      },
    ]);

    const report = await service.getUserAppointmentHistory('user-1', historyUser);

    expect(report.usuario).toEqual({ id: 'user-1', nombre: 'Cliente' });
    expect(report.resumen).toEqual({ total: 4, pendientes: 1, completadas: 1, canceladas: 1, noRealizadas: 1 });
    expect(report.citas[0]).toMatchObject({
      id: 'appointment-1',
      negocio: { id: 'business-1', nombre: 'Barbería Granada' },
      precioBase: 50000,
      descuentoBienvenida: 5000,
      beneficioBienvenidaAplicado: true,
      precioTotal: 45000,
    });
    expect(report.citas[1].estilista).toEqual({ id: 'stylist-1', especialidad: 'Barbería' });
    expect(JSON.stringify(report)).not.toContain('passwordHash');
    expect(appointmentRepository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { usuario: { id: 'user-1' } },
      order: { fechaHora: 'DESC' },
    }));
  });

  it('restricts history to its owner or admin and returns not found for missing users', async () => {
    const otherUser = { id: 'other-user', roles: [AppRoles.cliente] } as User;
    await expect(service.getUserAppointmentHistory('user-1', otherUser)).rejects.toThrow(ForbiddenException);

    const admin = { id: 'admin', roles: [AppRoles.admin] } as User;
    userRepository.findOneBy.mockResolvedValue(null);
    await expect(service.getUserAppointmentHistory('missing-user', admin)).rejects.toThrow(NotFoundException);

    userRepository.findOneBy.mockResolvedValue({ id: 'user-1', nombre: 'Cliente' });
    appointmentRepository.find.mockResolvedValue([]);
    await expect(service.getUserAppointmentHistory('user-1', admin)).resolves.toMatchObject({
      resumen: { total: 0 }, citas: [],
    });
  });

  it('exports the business report as a PDF buffer', async () => {
    const pdf = await service.createBusinessPdf('business-1', owner, {
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(100);
  });
});
