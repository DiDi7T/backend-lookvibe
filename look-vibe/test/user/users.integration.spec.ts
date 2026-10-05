    import {INestApplication,ValidationPipe,} from '@nestjs/common';
    import { Test, TestingModule } from '@nestjs/testing';
    import {describe,it,beforeAll,afterAll,expect,} from 'vitest';
    import request from 'supertest';
    import { AppModule } from '../../src/app.module.js';
    describe('Users Integration Tests', () => {
    let app: INestApplication;
    let userId: string;
    //Esto es una prueba de integración para el módulo de usuarios,
    //  que verifica el correcto funcionamiento de los endpoints relacionados con la gestión de usuarios en la aplicación.
    //El validator Pipe se utiliza para validar y transformar los datos de entrada en las solicitudes HTTP, 
    // asegurando que cumplan con las reglas de validación definidas en los DTOs  
    // antes de ser procesados por los controladores.
    const email = `users_integration_${Date.now()}@test.com`;
    beforeAll(async () => {
        const moduleFixture: TestingModule =
        await Test.createTestingModule({
            imports: [AppModule],
        }).compile();
        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(
        new ValidationPipe({whitelist: true,transform: true,}),
        );

        await app.init();
    });

    afterAll(async () => {
        if (userId) {
        await request(app.getHttpServer())
            .delete(`/users/${userId}`);
        }

        await app.close();
    });

    describe('POST /users', () => {
        it('should create a user', async () => {
        const response = await request(
            app.getHttpServer(),
        )
            .post('/users')
            .send({
            nombre: 'Usuario Integration Test',
            email,
            password: '123456',
            roles: ['user'],
            });
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.nombre).toBe(
            'Usuario Integration Test',
        );
        expect(response.body.email).toBe(email);
        userId = response.body.id;
        });
    });

    describe('GET /users', () => {
        it('should return all users', async () => {
        const response = await request(
            app.getHttpServer(),
        ).get('/users');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.some(
            (user: any) => user.id === userId,
        )).toBe(true);
        });
    });

    describe('GET /users/:id', () => {
        it('should return a user by id', async () => {
        const response = await request(
            app.getHttpServer(),
        )
            .get(`/users/${userId}`);
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(userId);
        expect(response.body.email).toBe(email);
        expect(response.body.nombre).toBe(
            'Usuario Integration Test',
        );
        });
    });

    describe('PATCH /users/:id', () => {
        it('should update a user', async () => {
        const response = await request(
            app.getHttpServer(),
        )
            .patch(`/users/${userId}`)
            .send({
            nombre: 'Usuario Actualizado',
            });
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(userId);
        expect(response.body.nombre).toBe(
            'Usuario Actualizado',
        );
        });
    });

    describe('DELETE /users/:id', () => {
        it('should delete a user', async () => {
        const response = await request(
            app.getHttpServer(),).delete(`/users/${userId}`);
        expect(response.status).toBe(200);
        userId = '';
        });
    });
    });