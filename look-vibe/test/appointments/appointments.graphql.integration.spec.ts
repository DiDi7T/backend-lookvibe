import { INestApplication } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
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
const FORBIDDEN_ID = '66666666-6666-4666-8666-666666666666';
const APPOINTMENT_ID = '55555555-5555-4555-8555-555555555555';
const JWT_SECRET = process.env.JWT_SECRET ?? 'JWT_SECRET_LOOKVIBE_SECRETO';

describe('Appointments GraphQL integration', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const client = { id: CLIENT_ID, roles: [AppRoles.cliente] } as User;
  const forbiddenUser = { id: FORBIDDEN_ID, roles: [AppRoles.user] } as User;
  const appointment = {
    id: APPOINTMENT_ID,
    usuario: {
      id: CLIENT_ID,
      nombre: 'Cliente Prueba',
      email: 'cliente@example.com',
      roles: [AppRoles.cliente],
    },
    negocio: null,
    estilista: null,
    servicio: {
      id: '44444444-4444-4444-8444-444444444444',
      nombre: 'Corte',
      precio: 50000,
      duracionMin: 45,
    },
    fechaHora: new Date('2026-10-10T10:00:00.000Z'),
    duracionMin: 45,
    precioBase: 50000,
    descuentoBienvenida: 0,
    beneficioBienvenidaAplicado: false,
    precioTotal: 50000,
    estado: 'pendiente',
    nota: null,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
  };
  const appointments = { findAll: vi.fn(), findOne: vi.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          context: ({ req, res }: { req: Request; res: Response }) => ({
            req,
            res,
          }),
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
            findOneBy: vi.fn(({ id }: { id: string }) =>
              Promise.resolve(
                id === CLIENT_ID
                  ? client
                  : id === FORBIDDEN_ID
                    ? forbiddenUser
                    : null,
              ),
            ),
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
    appointments.findAll.mockResolvedValue([appointment]);
    appointments.findOne.mockResolvedValue(appointment);
  });

  afterAll(async () => app.close());

  it('requires an authenticated role and returns the selected appointment fields', async () => {
    const query = `query { appointments { id usuario { id nombre } servicio { nombre } } }`;
    const unauthorized = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query })
      .expect(200);
    expect(unauthorized.body.errors).toBeDefined();
    expect(appointments.findAll).not.toHaveBeenCalled();

    const forbiddenToken = jwt.sign({ user_id: FORBIDDEN_ID });
    const forbidden = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${forbiddenToken}`)
      .send({ query })
      .expect(200);
    expect(forbidden.body.errors).toBeDefined();
    expect(appointments.findAll).not.toHaveBeenCalled();

    const token = jwt.sign({ user_id: CLIENT_ID });
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.appointments).toEqual([
      {
        id: APPOINTMENT_ID,
        usuario: { id: CLIENT_ID, nombre: 'Cliente Prueba' },
        servicio: { nombre: 'Corte' },
      },
    ]);
    expect(appointments.findAll).toHaveBeenCalledWith(client);
  });

  it('fetches one appointment by ID for an authorized user', async () => {
    const query = `
      query Appointment($id: ID!) {
        appointment(id: $id) {
          id
          fechaHora
          estado
          servicio { nombre duracionMin }
        }
      }
    `;
    const token = jwt.sign({ user_id: CLIENT_ID });
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query, variables: { id: APPOINTMENT_ID } })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.appointment).toEqual({
      id: APPOINTMENT_ID,
      fechaHora: '2026-10-10T10:00:00.000Z',
      estado: 'pendiente',
      servicio: { nombre: 'Corte', duracionMin: 45 },
    });
    expect(appointments.findOne).toHaveBeenCalledWith(APPOINTMENT_ID, client);
  });

  it('rejects unauthenticated and unauthorized detail queries', async () => {
    const query = `
      query Appointment($id: ID!) {
        appointment(id: $id) { id }
      }
    `;
    const variables = { id: APPOINTMENT_ID };

    const unauthorized = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);
    expect(unauthorized.body.errors).toBeDefined();
    expect(appointments.findOne).not.toHaveBeenCalled();

    const forbiddenToken = jwt.sign({ user_id: FORBIDDEN_ID });
    const forbidden = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${forbiddenToken}`)
      .send({ query, variables })
      .expect(200);
    expect(forbidden.body.errors).toBeDefined();
    expect(appointments.findOne).not.toHaveBeenCalled();
  });

  it('returns a GraphQL error when the appointment is not found or accessible', async () => {
    appointments.findOne.mockRejectedValueOnce(
      new NotFoundException('Cita no encontrada'),
    );
    const query = `
      query Appointment($id: ID!) {
        appointment(id: $id) { id }
      }
    `;
    const token = jwt.sign({ user_id: CLIENT_ID });
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query, variables: { id: APPOINTMENT_ID } })
      .expect(200);

    expect(response.body.errors).toBeDefined();
    expect(response.body.data.appointment).toBeNull();
    expect(appointments.findOne).toHaveBeenCalledWith(APPOINTMENT_ID, client);
  });
});
