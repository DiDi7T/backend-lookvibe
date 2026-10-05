import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { User } from '../../src/users/entities/user.entity.js';
import { AppRoles } from '../../src/auth/interfaces/app-roles.js';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy.js';
import { UserRoleGuard } from '../../src/auth/guards/user-role/user-role.guard.js';
import { AppointmentsController } from '../../src/appointments/appointments.controller.js';
import { AppointmentsService } from '../../src/appointments/appointments.service.js';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const BUSINESS_ID = '22222222-2222-4222-8222-222222222222';
const STYLIST_ID = '33333333-3333-4333-8333-333333333333';
const SERVICE_ID = '44444444-4444-4444-8444-444444444444';
const APPOINTMENT_ID = '55555555-5555-4555-8555-555555555555';
const JWT_SECRET = process.env.JWT_SECRET ?? 'JWT_SECRET_LOOKVIBE_SECRETO';

describe('Appointments HTTP integration', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const users = new Map([
    [CLIENT_ID, { id: CLIENT_ID, roles: [AppRoles.cliente] } as User],
    [BUSINESS_ID, { id: BUSINESS_ID, roles: [AppRoles.negocio] } as User],
    [STYLIST_ID, { id: STYLIST_ID, roles: [AppRoles.estilista] } as User],
  ]);
  const appointments = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    markCompleted: vi.fn(),
    getBusinessAvailability: vi.fn(),
    getStylistAvailability: vi.fn(),
    setBusinessSchedule: vi.fn(),
    setStylistSchedule: vi.fn(),
  };
  const token = (userId: string) => jwt.sign({ user_id: userId });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({ secret: JWT_SECRET })],
      controllers: [AppointmentsController],
      providers: [
        JwtStrategy,
        UserRoleGuard,
        { provide: AppointmentsService, useValue: appointments },
        {
          provide: getRepositoryToken(User),
          useValue: { findOneBy: vi.fn(({ id }: { id: string }) => Promise.resolve(users.get(id) ?? null)) },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    jwt = module.get(JwtService);
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    appointments.create.mockImplementation(async (dto) => ({ id: APPOINTMENT_ID, ...dto }));
    appointments.findAll.mockResolvedValue([{ id: APPOINTMENT_ID, estado: 'pendiente' }]);
    appointments.findOne.mockResolvedValue({ id: APPOINTMENT_ID, estado: 'pendiente' });
    appointments.update.mockResolvedValue({ id: APPOINTMENT_ID, nota: 'Actualizada' });
    appointments.remove.mockResolvedValue({ id: APPOINTMENT_ID, message: 'Cita cancelada exitosamente' });
    appointments.markCompleted.mockResolvedValue({ id: APPOINTMENT_ID, estado: 'completada' });
    appointments.getBusinessAvailability.mockResolvedValue({ businessId: BUSINESS_ID, slots: [] });
    appointments.getStylistAvailability.mockResolvedValue({ stylistId: STYLIST_ID, slots: [] });
    appointments.setBusinessSchedule.mockResolvedValue({ tipoRecurso: 'negocio', recursoId: BUSINESS_ID });
    appointments.setStylistSchedule.mockResolvedValue({ tipoRecurso: 'estilista', recursoId: STYLIST_ID });
  });

  afterAll(async () => app.close());

  it('protege la lista y permite el acceso a un cliente autenticado', async () => {
    await request(app.getHttpServer()).get('/citas').expect(401);
    await request(app.getHttpServer())
      .get('/citas')
      .set('Authorization', `Bearer ${token(CLIENT_ID)}`)
      .expect(200)
      .expect([{ id: APPOINTMENT_ID, estado: 'pendiente' }]);
  });

  it('valida y crea una cita, y rechaza roles no autorizados', async () => {
    const payload = {
      usuarioId: CLIENT_ID,
      negocioId: BUSINESS_ID,
      servicioId: SERVICE_ID,
      fechaHora: '2026-10-10T10:00:00.000Z',
      nota: 'Primera cita',
    };
    const auth = `Bearer ${token(CLIENT_ID)}`;

    await request(app.getHttpServer()).post('/citas').set('Authorization', auth).send({ ...payload, usuarioId: 'bad' }).expect(400);
    await request(app.getHttpServer())
      .post('/citas')
      .set('Authorization', `Bearer ${token(BUSINESS_ID)}`)
      .send(payload)
      .expect(403);
    await request(app.getHttpServer())
      .post('/citas')
      .set('Authorization', auth)
      .send(payload)
      .expect(201)
      .expect(({ body }) => expect(body).toMatchObject({ id: APPOINTMENT_ID, ...payload }));

    expect(appointments.create).toHaveBeenCalledWith(expect.objectContaining(payload));
  });

  it('consulta disponibilidad para negocio y estilista', async () => {
    await request(app.getHttpServer()).get(`/citas/negocios/${BUSINESS_ID}/disponibilidad?fecha=2026-10-10&duracionMin=45&pasoMin=15`).expect(200);
    await request(app.getHttpServer()).get(`/citas/estilistas/${STYLIST_ID}/disponibilidad?fecha=2026-10-10&duracionMin=45&pasoMin=15`).expect(200);
    expect(appointments.getBusinessAvailability).toHaveBeenCalledWith(BUSINESS_ID, '2026-10-10', '45', '15');
    expect(appointments.getStylistAvailability).toHaveBeenCalledWith(STYLIST_ID, '2026-10-10', '45', '15');
  });

  it('allows business owners and stylists to set their own weekly hours', async () => {
    const schedule = {
      zonaHoraria: 'America/Bogota',
      horarios: [
        { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
        { diaSemana: 1, horaInicio: '14:00', horaFin: '18:00' },
      ],
    };
    await request(app.getHttpServer())
      .put(`/citas/negocios/${BUSINESS_ID}/horarios`)
      .set('Authorization', `Bearer ${token(BUSINESS_ID)}`)
      .send(schedule)
      .expect(200);
    await request(app.getHttpServer())
      .put(`/citas/estilistas/${STYLIST_ID}/horarios`)
      .set('Authorization', `Bearer ${token(STYLIST_ID)}`)
      .send(schedule)
      .expect(200);
    await request(app.getHttpServer())
      .put(`/citas/negocios/${BUSINESS_ID}/horarios`)
      .set('Authorization', `Bearer ${token(BUSINESS_ID)}`)
      .send({ horarios: [{ diaSemana: 7, horaInicio: '09:00', horaFin: '18:00' }] })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/citas/negocios/${BUSINESS_ID}/horarios`)
      .set('Authorization', `Bearer ${token(CLIENT_ID)}`)
      .send(schedule)
      .expect(403);

    expect(appointments.setBusinessSchedule).toHaveBeenCalledOnce();
    expect(appointments.setBusinessSchedule).toHaveBeenCalledWith(BUSINESS_ID, users.get(BUSINESS_ID), schedule);
    expect(appointments.setStylistSchedule).toHaveBeenCalledWith(STYLIST_ID, users.get(STYLIST_ID), schedule);
  });

  it('consulta, actualiza y cancela una cita con UUID válido', async () => {
    const auth = `Bearer ${token(CLIENT_ID)}`;
    await request(app.getHttpServer()).get('/citas/no-es-uuid').set('Authorization', auth).expect(400);
    await request(app.getHttpServer()).get(`/citas/${APPOINTMENT_ID}`).set('Authorization', auth).expect(200);
    await request(app.getHttpServer()).patch(`/citas/${APPOINTMENT_ID}`).set('Authorization', auth).send({ nota: 'Actualizada' }).expect(200);
    await request(app.getHttpServer()).delete(`/citas/${APPOINTMENT_ID}?motivo=No%20puedo`).set('Authorization', auth).expect(200);
    expect(appointments.update).toHaveBeenCalledWith(APPOINTMENT_ID, { nota: 'Actualizada' });
    expect(appointments.remove).toHaveBeenCalledWith(APPOINTMENT_ID, 'No puedo');
  });

  it('permite completar a estilista y negocio, no a cliente', async () => {
    await request(app.getHttpServer())
      .patch(`/citas/${APPOINTMENT_ID}/completada`)
      .set('Authorization', `Bearer ${token(STYLIST_ID)}`)
      .send({ completada: true })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/citas/${APPOINTMENT_ID}/completada`)
      .set('Authorization', `Bearer ${token(CLIENT_ID)}`)
      .send({ completada: true })
      .expect(403);
    expect(appointments.markCompleted).toHaveBeenCalledWith(APPOINTMENT_ID, true);
  });
});