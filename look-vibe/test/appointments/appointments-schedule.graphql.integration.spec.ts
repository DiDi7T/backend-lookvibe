import { ConflictException, ForbiddenException, INestApplication } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { AppRoles } from '../../src/auth/interfaces/app-roles.js';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy.js';
import { GqlJwtAuthGuard } from '../../src/auth/guards/gql-jwt-auth.guard.js';
import { UserRoleGuard } from '../../src/auth/guards/user-role/user-role.guard.js';
import { AppointmentsResolver } from '../../src/appointments/graphql/appointments.resolver.js';
import { AppointmentsService } from '../../src/appointments/appointments.service.js';
import { User } from '../../src/users/entities/user.entity.js';
import type { Request, Response } from 'express';
import { join } from 'node:path';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const BUSINESS_OWNER_ID = '33333333-3333-4333-8333-333333333333';
const STYLIST_USER_ID = '77777777-7777-4777-8777-777777777777';
const BUSINESS_ID = '88888888-8888-4888-8888-888888888888';
const STYLIST_ID = '99999999-9999-4999-8999-999999999999';
const APPOINTMENT_ID = '55555555-5555-4555-8555-555555555555';
const OTHER_USER_ID = '66666666-6666-4666-8666-666666666666';
const JWT_SECRET = process.env.JWT_SECRET ?? 'JWT_SECRET_LOOKVIBE_SECRETO';

describe('Appointments GraphQL: update, schedules and availability', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const users: Record<string, User> = {
    [CLIENT_ID]: { id: CLIENT_ID, roles: [AppRoles.cliente] } as User,
    [ADMIN_ID]: { id: ADMIN_ID, roles: [AppRoles.admin] } as User,
    [BUSINESS_OWNER_ID]: { id: BUSINESS_OWNER_ID, roles: [AppRoles.negocio] } as User,
    [STYLIST_USER_ID]: { id: STYLIST_USER_ID, roles: [AppRoles.estilista] } as User,
  };

  const updatedAppointment = {
    id: APPOINTMENT_ID,
    usuario: { id: CLIENT_ID, nombre: 'Cliente Prueba', email: 'cliente@example.com', roles: [AppRoles.cliente] },
    negocio: null,
    estilista: null,
    servicio: { id: '44444444-4444-4444-8444-444444444444', nombre: 'Corte', precio: 50000, duracionMin: 45 },
    fechaHora: new Date('2026-12-01T15:00:00.000Z'),
    duracionMin: 45,
    precioBase: 50000,
    descuentoBienvenida: 0,
    beneficioBienvenidaAplicado: false,
    precioTotal: 50000,
    estado: 'pendiente',
    nota: 'Reprogramada',
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-24T10:00:00.000Z'),
  };

  const horarios = [{ diaSemana: 1, horaInicio: '08:00', horaFin: '18:00' }];

  const appointments = {
    update: vi.fn(),
    setBusinessSchedule: vi.fn(),
    setStylistSchedule: vi.fn(),
    getBusinessSchedule: vi.fn(),
    getBusinessAvailability: vi.fn(),
    getStylistAvailability: vi.fn(),
  };

  const tokenFor = (userId: string) => jwt.sign({ user_id: userId });

  const send = (body: { query: string; variables?: Record<string, unknown> }, token?: string) => {
    const call = request(app.getHttpServer()).post('/graphql');
    if (token) call.set('Authorization', `Bearer ${token}`);
    return call.send(body).expect(200);
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: JWT_SECRET }),
      ],
      providers: [
        AppointmentsResolver,
        JwtStrategy,
        GqlJwtAuthGuard,
        UserRoleGuard,
        { provide: AppointmentsService, useValue: appointments },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: vi.fn(({ id }: { id: string }) => Promise.resolve(users[id] ?? null)),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    jwt = module.get(JwtService);
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    appointments.update.mockResolvedValue(updatedAppointment);
    appointments.setBusinessSchedule.mockResolvedValue({
      tipoRecurso: 'negocio',
      recursoId: BUSINESS_ID,
      zonaHoraria: 'America/Bogota',
      horarios,
    });
    appointments.setStylistSchedule.mockResolvedValue({
      tipoRecurso: 'estilista',
      recursoId: STYLIST_ID,
      zonaHoraria: 'America/Bogota',
      horarios,
    });
    appointments.getBusinessSchedule.mockResolvedValue({
      businessId: BUSINESS_ID,
      zonaHoraria: 'America/Bogota',
      horarios,
    });
    const availability = {
      fecha: '2026-12-01',
      zonaHoraria: 'America/Bogota',
      ocupadas: 1,
      slots: [
        { inicio: '2026-12-01T13:00:00.000Z', fin: '2026-12-01T14:00:00.000Z', disponible: false },
        { inicio: '2026-12-01T14:00:00.000Z', fin: '2026-12-01T15:00:00.000Z', disponible: true },
      ],
    };
    appointments.getBusinessAvailability.mockResolvedValue({ businessId: BUSINESS_ID, ...availability });
    appointments.getStylistAvailability.mockResolvedValue({ stylistId: STYLIST_ID, ...availability });
  });

  afterAll(async () => app.close());

  describe('updateAppointment', () => {
    const query = `
      mutation UpdateAppointment($id: ID!, $input: UpdateAppointmentInput!) {
        updateAppointment(id: $id, input: $input) { id fechaHora estado nota }
      }
    `;
    const variables = {
      id: APPOINTMENT_ID,
      input: { fechaHora: '2026-12-01T15:00:00.000Z', nota: 'Reprogramada', usuarioId: OTHER_USER_ID },
    };

    it('reprograma la cita reutilizando el servicio y devuelve solo los campos pedidos', async () => {
      const response = await send({ query, variables }, tokenFor(CLIENT_ID));

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.updateAppointment).toEqual({
        id: APPOINTMENT_ID,
        fechaHora: '2026-12-01T15:00:00.000Z',
        estado: 'pendiente',
        nota: 'Reprogramada',
      });
      expect(appointments.update).toHaveBeenCalledWith(
        APPOINTMENT_ID,
        expect.objectContaining({ fechaHora: '2026-12-01T15:00:00.000Z', nota: 'Reprogramada', usuarioId: undefined }),
        users[CLIENT_ID],
      );
    });

    it('solo el admin puede cambiar el usuario de la cita', async () => {
      await send({ query, variables }, tokenFor(ADMIN_ID));

      expect(appointments.update).toHaveBeenCalledWith(
        APPOINTMENT_ID,
        expect.objectContaining({ usuarioId: OTHER_USER_ID }),
        users[ADMIN_ID],
      );
    });

    it('falla en el servidor sin token y no llama al servicio', async () => {
      const response = await send({ query, variables });

      expect(response.body.errors).toBeDefined();
      expect(appointments.update).not.toHaveBeenCalled();
    });

    it('devuelve el error del servicio cuando el horario ya está ocupado', async () => {
      appointments.update.mockRejectedValueOnce(new ConflictException('El horario seleccionado ya no está disponible'));

      const response = await send({ query, variables }, tokenFor(CLIENT_ID));

      expect(response.body.errors[0].message).toBe('El horario seleccionado ya no está disponible');
      expect(response.body.data).toBeNull();
    });

    it('rechaza variables que no cumplen el esquema antes de llegar al servicio', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${tokenFor(CLIENT_ID)}`)
        .send({ query, variables: { id: APPOINTMENT_ID } })
        .expect(400);

      expect(response.body.errors[0].message).toContain('$input');
      expect(appointments.update).not.toHaveBeenCalled();
    });
  });

  describe('setBusinessSchedule', () => {
    const query = `
      mutation SetBusinessSchedule($businessId: ID!, $input: SetScheduleInput!) {
        setBusinessSchedule(businessId: $businessId, input: $input) {
          tipoRecurso
          recursoId
          horarios { diaSemana horaInicio horaFin }
        }
      }
    `;
    const variables = { businessId: BUSINESS_ID, input: { horarios } };

    it('el dueño del negocio guarda el horario', async () => {
      const response = await send({ query, variables }, tokenFor(BUSINESS_OWNER_ID));

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.setBusinessSchedule).toEqual({ tipoRecurso: 'negocio', recursoId: BUSINESS_ID, horarios });
      expect(appointments.setBusinessSchedule).toHaveBeenCalledWith(
        BUSINESS_ID,
        users[BUSINESS_OWNER_ID],
        expect.objectContaining({ horarios }),
      );
    });

    it('un cliente no puede cambiar el horario de un negocio', async () => {
      const response = await send({ query, variables }, tokenFor(CLIENT_ID));

      expect(response.body.errors).toBeDefined();
      expect(appointments.setBusinessSchedule).not.toHaveBeenCalled();
    });

    it('un negocio que no es el dueño recibe el error del servicio', async () => {
      appointments.setBusinessSchedule.mockRejectedValueOnce(new ForbiddenException('No puedes administrar este negocio'));

      const response = await send({ query, variables }, tokenFor(BUSINESS_OWNER_ID));

      expect(response.body.errors[0].message).toBe('No puedes administrar este negocio');
    });
  });

  describe('setStylistSchedule', () => {
    const query = `
      mutation SetStylistSchedule($stylistId: ID!, $input: SetScheduleInput!) {
        setStylistSchedule(stylistId: $stylistId, input: $input) { tipoRecurso recursoId }
      }
    `;
    const variables = { stylistId: STYLIST_ID, input: { horarios, zonaHoraria: 'America/Bogota' } };

    it('el estilista guarda su propio horario', async () => {
      const response = await send({ query, variables }, tokenFor(STYLIST_USER_ID));

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.setStylistSchedule).toEqual({ tipoRecurso: 'estilista', recursoId: STYLIST_ID });
      expect(appointments.setStylistSchedule).toHaveBeenCalledWith(
        STYLIST_ID,
        users[STYLIST_USER_ID],
        expect.objectContaining({ horarios, zonaHoraria: 'America/Bogota' }),
      );
    });

    it('falla sin token', async () => {
      const response = await send({ query, variables });

      expect(response.body.errors).toBeDefined();
      expect(appointments.setStylistSchedule).not.toHaveBeenCalled();
    });
  });

  describe('consultas públicas de horario y disponibilidad', () => {
    it('businessSchedule devuelve el horario del negocio', async () => {
      const response = await send({
        query: `query BusinessSchedule($businessId: ID!) {
          businessSchedule(businessId: $businessId) { businessId zonaHoraria horarios { diaSemana horaInicio horaFin } }
        }`,
        variables: { businessId: BUSINESS_ID },
      });

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.businessSchedule).toEqual({ businessId: BUSINESS_ID, zonaHoraria: 'America/Bogota', horarios });
      expect(appointments.getBusinessSchedule).toHaveBeenCalledWith(BUSINESS_ID);
    });

    it('businessAvailability convierte los argumentos numéricos y devuelve los turnos', async () => {
      const response = await send({
        query: `query BusinessAvailability($businessId: ID!, $fecha: String, $duracionMin: Int, $pasoMin: Int) {
          businessAvailability(businessId: $businessId, fecha: $fecha, duracionMin: $duracionMin, pasoMin: $pasoMin) {
            fecha ocupadas slots { inicio disponible }
          }
        }`,
        variables: { businessId: BUSINESS_ID, fecha: '2026-12-01', duracionMin: 60, pasoMin: 30 },
      });

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.businessAvailability).toEqual({
        fecha: '2026-12-01',
        ocupadas: 1,
        slots: [
          { inicio: '2026-12-01T13:00:00.000Z', disponible: false },
          { inicio: '2026-12-01T14:00:00.000Z', disponible: true },
        ],
      });
      expect(appointments.getBusinessAvailability).toHaveBeenCalledWith(BUSINESS_ID, '2026-12-01', '60', '30');
    });

    it('stylistAvailability usa los valores por defecto cuando no se envían', async () => {
      const response = await send({
        query: `query StylistAvailability($stylistId: ID!) {
          stylistAvailability(stylistId: $stylistId) { fecha ocupadas }
        }`,
        variables: { stylistId: STYLIST_ID },
      });

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.stylistAvailability).toEqual({ fecha: '2026-12-01', ocupadas: 1 });
      expect(appointments.getStylistAvailability).toHaveBeenCalledWith(STYLIST_ID, undefined, undefined, undefined);
    });
  });
});
