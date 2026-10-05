import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppRoles } from '../../src/auth/interfaces/app-roles.js';
import { UserRoleGuard } from '../../src/auth/guards/user-role/user-role.guard.js';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy.js';
import { User } from '../../src/users/entities/user.entity.js';
import { BusinessesController } from '../../src/businesses/businesses.controller.js';
import { BusinessesService } from '../../src/businesses/businesses.service.js';
import { StylistsController } from '../../src/stylists/stylists.controller.js';
import { StylistsService } from '../../src/stylists/stylists.service.js';
import { ServicesController } from '../../src/services/services.controller.js';
import { ServicesService } from '../../src/services/services.service.js';
import { PortfolioController } from '../../src/portfolio/portfolio.controller.js';
import { PortfolioService } from '../../src/portfolio/portfolio.service.js';
import { ReviewsController } from '../../src/reviews/reviews.controller.js';
import { ReviewsService } from '../../src/reviews/reviews.service.js';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const STYLIST_ID = '22222222-2222-4222-8222-222222222222';
const BUSINESS_OWNER_ID = '33333333-3333-4333-8333-333333333333';
const ADMIN_ID = '44444444-4444-4444-8444-444444444444';
const BUSINESS_ID = '55555555-5555-4555-8555-555555555555';
const SERVICE_ID = '66666666-6666-4666-8666-666666666666';
const PROFILE_ID = '77777777-7777-4777-8777-777777777777';
const REVIEW_ID = '88888888-8888-4888-8888-888888888888';
const APPOINTMENT_ID = '99999999-9999-4999-8999-999999999999';
const JWT_SECRET = process.env.JWT_SECRET ?? 'JWT_SECRET_LOOKVIBE_SECRETO';

describe('Business, stylist, services, portfolio and reviews HTTP integration', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const users = new Map<string, User>([
    [CLIENT_ID, { id: CLIENT_ID, roles: [AppRoles.cliente] } as User],
    [STYLIST_ID, { id: STYLIST_ID, roles: [AppRoles.estilista] } as User],
    [
      BUSINESS_OWNER_ID,
      { id: BUSINESS_OWNER_ID, roles: [AppRoles.negocio] } as User,
    ],
    [ADMIN_ID, { id: ADMIN_ID, roles: [AppRoles.admin] } as User],
  ]);

  const businesses = {
    create: vi.fn(),
    update: vi.fn(),
    findNearby: vi.fn(),
  };
  const stylists = {
    createIndependent: vi.fn(),
    createManual: vi.fn(),
    solicitarAfiliacion: vi.fn(),
    afiliarEstilista: vi.fn(),
  };
  const services = {
    create: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
  };
  const portfolio = {
    addForBusiness: vi.fn(),
    addForStylist: vi.fn(),
  };
  const reviews = {
    create: vi.fn(),
    findByBusiness: vi.fn(),
    findByStylist: vi.fn(),
    remove: vi.fn(),
  };

  const bearer = (userId: string) => `Bearer ${jwt.sign({ user_id: userId })}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: JWT_SECRET }),
      ],
      controllers: [
        BusinessesController,
        StylistsController,
        ServicesController,
        PortfolioController,
        ReviewsController,
      ],
      providers: [
        JwtStrategy,
        UserRoleGuard,
        { provide: BusinessesService, useValue: businesses },
        { provide: StylistsService, useValue: stylists },
        { provide: ServicesService, useValue: services },
        { provide: PortfolioService, useValue: portfolio },
        { provide: ReviewsService, useValue: reviews },
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    jwt = module.get(JwtService);
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    businesses.create.mockResolvedValue({
      id: BUSINESS_ID,
      nombre: 'LookVibe Centro',
    });
    businesses.update.mockResolvedValue({
      id: BUSINESS_ID,
      nombre: 'LookVibe Actualizado',
    });
    businesses.findNearby.mockResolvedValue([{ id: BUSINESS_ID }]);
    stylists.createIndependent.mockResolvedValue({
      id: PROFILE_ID,
      negocio: null,
    });
    stylists.createManual.mockResolvedValue({ id: PROFILE_ID, usuario: null });
    stylists.solicitarAfiliacion.mockResolvedValue({
      id: PROFILE_ID,
      estadoAfiliacion: 'PENDIENTE',
    });
    stylists.afiliarEstilista.mockResolvedValue({
      id: PROFILE_ID,
      estadoAfiliacion: 'AFILIADO',
    });
    services.create.mockResolvedValue({ id: SERVICE_ID, nombre: 'Corte' });
    services.findAll.mockResolvedValue([{ id: SERVICE_ID, nombre: 'Corte' }]);
    services.update.mockResolvedValue({ id: SERVICE_ID, precio: 50000 });
    portfolio.addForBusiness.mockResolvedValue({ id: 'portfolio-business' });
    portfolio.addForStylist.mockResolvedValue({ id: 'portfolio-stylist' });
    reviews.create.mockResolvedValue({ id: REVIEW_ID, calificacion: 5 });
    reviews.findByBusiness.mockResolvedValue([{ id: REVIEW_ID }]);
    reviews.findByStylist.mockResolvedValue([{ id: REVIEW_ID }]);
    reviews.remove.mockResolvedValue(undefined);
  });

  afterAll(async () => app.close());

  it('creates and edits a business, and protects both operations by role', async () => {
    const body = {
      nombre: 'LookVibe Centro',
      latitud: 3.4516,
      longitud: -76.532,
    };

    await request(app.getHttpServer()).post('/negocios').send(body).expect(401);
    await request(app.getHttpServer())
      .post('/negocios')
      .set('Authorization', bearer(CLIENT_ID))
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .post('/negocios')
      .set('Authorization', bearer(BUSINESS_OWNER_ID))
      .send(body)
      .expect(201)
      .expect({ id: BUSINESS_ID, nombre: 'LookVibe Centro' });
    expect(businesses.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: BUSINESS_OWNER_ID }),
      expect.objectContaining(body),
    );

    await request(app.getHttpServer())
      .put(`/negocios/${BUSINESS_ID}`)
      .set('Authorization', bearer(BUSINESS_OWNER_ID))
      .send({ nombre: 'LookVibe Actualizado' })
      .expect(200);
    expect(businesses.update).toHaveBeenCalledWith(
      BUSINESS_ID,
      expect.objectContaining({ id: BUSINESS_OWNER_ID }),
      { nombre: 'LookVibe Actualizado' },
    );
  });

  it('validates and delegates nearby-business search filters', async () => {
    await request(app.getHttpServer())
      .get('/negocios')
      .query({ cerca_de: '3.4516,-76.532', servicio: 'Corte' })
      .expect(200)
      .expect([{ id: BUSINESS_ID }]);
    expect(businesses.findNearby).toHaveBeenCalledWith({
      latitud: 3.4516,
      longitud: -76.532,
      service: 'Corte',
      radiusKm: undefined,
    });

    await request(app.getHttpServer())
      .get('/negocios')
      .query({ cerca_de: 'bad' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/negocios')
      .query({ radioKm: '0' })
      .expect(400);
  });

  it('creates independent and manual stylist profiles with the required roles', async () => {
    await request(app.getHttpServer())
      .post('/estilistas')
      .set('Authorization', bearer(STYLIST_ID))
      .send({ especialidad: 'Colorimetría' })
      .expect(201)
      .expect({ id: PROFILE_ID, negocio: null });
    expect(stylists.createIndependent).toHaveBeenCalledWith(
      expect.objectContaining({ id: STYLIST_ID }),
      { especialidad: 'Colorimetría' },
    );

    await request(app.getHttpServer())
      .post(`/negocios/${BUSINESS_ID}/estilistas`)
      .set('Authorization', bearer(CLIENT_ID))
      .send({ especialidad: 'Manicure' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/negocios/${BUSINESS_ID}/estilistas`)
      .set('Authorization', bearer(BUSINESS_OWNER_ID))
      .send({ especialidad: 'Manicure' })
      .expect(201)
      .expect({ id: PROFILE_ID, usuario: null });
    expect(stylists.createManual).toHaveBeenCalledWith(
      BUSINESS_ID,
      expect.objectContaining({ id: BUSINESS_OWNER_ID }),
      { especialidad: 'Manicure' },
    );
  });

  it('submits and accepts a stylist affiliation request', async () => {
    await request(app.getHttpServer())
      .post(`/estilistas/${PROFILE_ID}/solicitar-afiliacion`)
      .set('Authorization', bearer(STYLIST_ID))
      .send({ businessId: BUSINESS_ID })
      .expect(201)
      .expect({ id: PROFILE_ID, estadoAfiliacion: 'PENDIENTE' });
    expect(stylists.solicitarAfiliacion).toHaveBeenCalledWith(
      PROFILE_ID,
      expect.objectContaining({ id: STYLIST_ID }),
      BUSINESS_ID,
    );

    await request(app.getHttpServer())
      .put(`/negocios/${BUSINESS_ID}/estilistas/${PROFILE_ID}/afiliar`)
      .set('Authorization', bearer(BUSINESS_OWNER_ID))
      .expect(200)
      .expect({ id: PROFILE_ID, estadoAfiliacion: 'AFILIADO' });
    expect(stylists.afiliarEstilista).toHaveBeenCalledWith(
      BUSINESS_ID,
      PROFILE_ID,
      expect.objectContaining({ id: BUSINESS_OWNER_ID }),
    );
  });

  it('creates, lists and updates business services, rejecting invalid prices', async () => {
    await request(app.getHttpServer())
      .post(`/negocios/${BUSINESS_ID}/servicios`)
      .set('Authorization', bearer(BUSINESS_OWNER_ID))
      .send({ nombre: 'Corte', precio: 45000, duracionMin: 45 })
      .expect(201)
      .expect({ id: SERVICE_ID, nombre: 'Corte' });
    expect(services.create).toHaveBeenCalledWith(
      BUSINESS_ID,
      expect.objectContaining({ id: BUSINESS_OWNER_ID }),
      { nombre: 'Corte', precio: 45000, duracionMin: 45 },
    );

    await request(app.getHttpServer())
      .get(`/negocios/${BUSINESS_ID}/servicios`)
      .expect(200);
    expect(services.findAll).toHaveBeenCalledWith(BUSINESS_ID);

    await request(app.getHttpServer())
      .put(`/negocios/${BUSINESS_ID}/servicios/${SERVICE_ID}`)
      .set('Authorization', bearer(BUSINESS_OWNER_ID))
      .send({ precio: 50000 })
      .expect(200);
    expect(services.update).toHaveBeenCalledWith(
      BUSINESS_ID,
      SERVICE_ID,
      expect.objectContaining({ id: BUSINESS_OWNER_ID }),
      { precio: 50000 },
    );

    await request(app.getHttpServer())
      .post(`/negocios/${BUSINESS_ID}/servicios`)
      .set('Authorization', bearer(BUSINESS_OWNER_ID))
      .send({ nombre: 'Corte', precio: -1, duracionMin: 0 })
      .expect(400);
  });

  it('adds portfolio photos by URL for businesses and stylists', async () => {
    await request(app.getHttpServer())
      .post(`/negocios/${BUSINESS_ID}/portafolio`)
      .set('Authorization', bearer(BUSINESS_OWNER_ID))
      .send({ fotoUrl: 'https://example.com/business.jpg' })
      .expect(201)
      .expect({ id: 'portfolio-business' });
    await request(app.getHttpServer())
      .post(`/estilistas/${PROFILE_ID}/portafolio`)
      .set('Authorization', bearer(STYLIST_ID))
      .send({ fotoUrl: 'https://example.com/stylist.jpg' })
      .expect(201)
      .expect({ id: 'portfolio-stylist' });
    expect(portfolio.addForBusiness).toHaveBeenCalled();
    expect(portfolio.addForStylist).toHaveBeenCalled();

    await request(app.getHttpServer())
      .post(`/estilistas/${PROFILE_ID}/portafolio`)
      .set('Authorization', bearer(STYLIST_ID))
      .send({ fotoUrl: 'not-a-url' })
      .expect(400);
  });

  it('creates reviews, lists them publicly and restricts deletion to admins', async () => {
    const reviewBody = {
      citaId: APPOINTMENT_ID,
      calificacion: 5,
      comentario: 'Excelente atención',
    };

    await request(app.getHttpServer())
      .post('/rese%C3%B1as')
      .set('Authorization', bearer(CLIENT_ID))
      .send(reviewBody)
      .expect(201)
      .expect({ id: REVIEW_ID, calificacion: 5 });
    expect(reviews.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: CLIENT_ID }),
      reviewBody,
    );
    await request(app.getHttpServer())
      .post('/rese%C3%B1as')
      .set('Authorization', bearer(CLIENT_ID))
      .send({ ...reviewBody, calificacion: 6 })
      .expect(400);

    await request(app.getHttpServer())
      .get(`/negocios/${BUSINESS_ID}/rese%C3%B1as`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/estilistas/${PROFILE_ID}/rese%C3%B1as`)
      .expect(200);
    expect(reviews.findByBusiness).toHaveBeenCalledWith(BUSINESS_ID);
    expect(reviews.findByStylist).toHaveBeenCalledWith(PROFILE_ID);

    await request(app.getHttpServer())
      .delete(`/rese%C3%B1as/${REVIEW_ID}`)
      .set('Authorization', bearer(BUSINESS_OWNER_ID))
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/rese%C3%B1as/${REVIEW_ID}`)
      .set('Authorization', bearer(ADMIN_ID))
      .expect(200);
    expect(reviews.remove).toHaveBeenCalledWith(
      REVIEW_ID,
      expect.objectContaining({ id: ADMIN_ID }),
    );
  });
});
