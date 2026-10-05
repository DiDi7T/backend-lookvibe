import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { AppRoles } from '../../src/auth/interfaces/app-roles.js';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy.js';
import { UserRoleGuard } from '../../src/auth/guards/user-role/user-role.guard.js';
import { User } from '../../src/users/entities/user.entity.js';
import { ReportsController } from '../../src/reports/reports.controller.js';
import { ReportsService } from '../../src/reports/reports.service.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_ID = '33333333-3333-4333-8333-333333333333';
const BUSINESS_ID = '44444444-4444-4444-8444-444444444444';
const SECRET = process.env.JWT_SECRET ?? 'JWT_SECRET_LOOKVIBE_SECRETO';

describe('Reports HTTP integration', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const users = new Map([
    [OWNER_ID, { id: OWNER_ID, roles: [AppRoles.negocio] } as User],
    [ADMIN_ID, { id: ADMIN_ID, roles: [AppRoles.admin] } as User],
    [CLIENT_ID, { id: CLIENT_ID, roles: [AppRoles.cliente] } as User],
  ]);
  const reports = {
    getBusinessReport: vi
      .fn()
      .mockResolvedValue({ negocio: { id: BUSINESS_ID }, citas: { total: 2 } }),
    createBusinessPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test')),
    getUsageReport: vi.fn().mockResolvedValue({ usuarios: 3, citas: 2 }),
    getUserAppointmentHistory: vi.fn().mockResolvedValue({
      usuario: { id: CLIENT_ID, nombre: 'Cliente' },
      resumen: { total: 1, pendientes: 0, completadas: 1, canceladas: 0, noRealizadas: 0 },
      citas: [{ id: 'appointment-1', estado: 'completada' }],
    }),
  };
  const token = (userId: string) => jwt.sign({ user_id: userId });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: SECRET }),
      ],
      controllers: [ReportsController],
      providers: [
        JwtStrategy,
        UserRoleGuard,
        { provide: ReportsService, useValue: reports },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: vi.fn(({ id }: { id: string }) =>
              Promise.resolve(users.get(id) ?? null),
            ),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    jwt = module.get(JwtService);
    await app.init();
  });

  beforeEach(() => vi.clearAllMocks());
  afterAll(async () => app.close());

  it('protects business reports and allows owner/admin roles', async () => {
    await request(app.getHttpServer())
      .get(`/reportes/negocio/${BUSINESS_ID}`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/reportes/negocio/${BUSINESS_ID}?desde=2026-01-01&hasta=2026-10-01`)
      .set('Authorization', `Bearer ${token(OWNER_ID)}`)
      .expect(200)
      .expect({ negocio: { id: BUSINESS_ID }, citas: { total: 2 } });
    await request(app.getHttpServer())
      .get(`/reportes/negocio/${BUSINESS_ID}`)
      .set('Authorization', `Bearer ${token(CLIENT_ID)}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/reportes/negocio/${BUSINESS_ID}`)
      .set('Authorization', `Bearer ${token(ADMIN_ID)}`)
      .expect(200);
  });

  it('restricts global usage to admin and streams business PDF', async () => {
    await request(app.getHttpServer())
      .get('/reportes/uso')
      .set('Authorization', `Bearer ${token(OWNER_ID)}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/reportes/uso')
      .set('Authorization', `Bearer ${token(ADMIN_ID)}`)
      .expect(200)
      .expect({ usuarios: 3, citas: 2 });
    await request(app.getHttpServer())
      .get(`/reportes/negocio/${BUSINESS_ID}/pdf`)
      .set('Authorization', `Bearer ${token(OWNER_ID)}`)
      .expect(200)
      .expect('Content-Type', /application\/pdf/)
      .expect(
        'Content-Disposition',
        new RegExp(`reporte-negocio-${BUSINESS_ID}\\.pdf`),
      );
  });

  it('allows a user to read their own appointment history and admin to read another user history', async () => {
    await request(app.getHttpServer())
      .get(`/reportes/usuario/${CLIENT_ID}/citas`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/reportes/usuario/${CLIENT_ID}/citas`)
      .set('Authorization', `Bearer ${token(CLIENT_ID)}`)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ usuario: { id: CLIENT_ID }, resumen: { total: 1 } }));
    await request(app.getHttpServer())
      .get(`/reportes/usuario/${CLIENT_ID}/citas`)
      .set('Authorization', `Bearer ${token(ADMIN_ID)}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/reportes/usuario/not-a-uuid/citas')
      .set('Authorization', `Bearer ${token(CLIENT_ID)}`)
      .expect(400);

    expect(reports.getUserAppointmentHistory).toHaveBeenCalledWith(CLIENT_ID, users.get(CLIENT_ID));
  });
});
