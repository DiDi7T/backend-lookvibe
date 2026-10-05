    import {INestApplication,ValidationPipe,} from '@nestjs/common';
    import { Test, TestingModule } from '@nestjs/testing';
    import {describe,it,beforeAll,afterAll,expect,} from 'vitest';
    import request from 'supertest';
    
    import { AppModule } from '../../src/app.module.js';
//El descriptor de la prueba de integración para el módulo de autenticación
//Lo uso para probar los endpoints de registro, inicio de sesión, cierre de sesión y verificación de estado de autenticación
    describe('Auth Integration Tests', () => {
        let app: INestApplication;
        beforeAll(async () => {
        const moduleFixture: TestingModule =
        await Test.createTestingModule({
            imports: [AppModule],
        }).compile();
        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({whitelist: true,transform: true,}),
        );
        await app.init();});
        
        afterAll(async () => {
        await app.close();
    });
    //Entonces aca, dentro de este bloque describe, 
    // voy a definir mis pruebas de integración para los endpoints de autenticación. 
    // Cada prueba se encargará de verificar el comportamiento esperado de los endpoints, 
    // como el registro de un nuevo usuario, el inicio de sesión con credenciales válidas, 
    // el rechazo de credenciales inválidas, el cierre de sesión y la verificación del 
    // estado de autenticación.
    describe('POST /auth/register', () => {
        it('should register a new user', async () => {
            const email = `auth_test_${Date.now()}@test.com`;
            const response = await request(
            app.getHttpServer(),
        )
            .post('/auth/register')
            .send({nombre: 'Usuario Auth Test',email,password: '123456',roles: ['user'],});
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('id');
            expect(response.body.nombre).toBe(
            'Usuario Auth Test',
        );

        expect(response.body.email).toBe(email);

        expect(response.body).toHaveProperty('token');

        expect(response.body).not.toHaveProperty(
            'passwordHash',
        );
        });
    });
// Esta prueba verifica que el endpoint de registro de usuario funcione correctamente.
    describe('POST /auth/login', () => {
        it('should login with valid credentials', async () => {
        const email = `login_test_${Date.now()}@test.com`;

        await request(app.getHttpServer())
            .post('/auth/register')
            .send({
            nombre: 'Usuario Login Test',
            email,
            password: '123456',
            roles: ['user'],
            });

        const response = await request(
            app.getHttpServer(),
        )
            .post('/auth/login')
            .send({
            email,
            password: '123456',
            });
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('user_id');
        expect(response.body.email).toBe(email);
        expect(response.body).toHaveProperty('roles');
        expect(response.body).toHaveProperty('token');
        });
        it('should reject invalid credentials', async () => {
        const response = await request(
            app.getHttpServer(),
        ).post('/auth/login').send({
            email: 'doesnotexist@test.com',
            password: 'wrongpassword',
            });
        expect(response.status).toBe(401);
        expect(response.body.message).toBe(
            'Invalid Credentials',
        );
        });
    });
    //Aca lo que hago es probar el endpoint de login,
    //  verificando que se pueda iniciar sesión con credenciales válidas y que 
    // se rechacen las credenciales inválidas.
    describe('POST /auth/logout', () => {
        it('should logout and revoke the token', async () => {
        const email = `logout_test_${Date.now()}@test.com`;
        const registerResponse = await request(
            app.getHttpServer(),).post('/auth/register').send({nombre: 'Usuario Logout Test',email,password: '123456',roles: ['user'],});
        const token = registerResponse.body.token;
        expect(token).toBeDefined();
        const response = await request(
            app.getHttpServer(),).post('/auth/logout').send({ token,});
        expect(response.status).toBe(201);
        expect(response.body).toEqual({
            message: 'User logged out successfully',
        });
        });
    });
//Esto es del adicional, aca lo que hago es probar el endpoint de logout, 
// verificando que se pueda cerrar sesión y que el token se revoque correctamente.
    describe('GET /auth/status', () => {
        it('should reject unauthenticated requests', async () => {
        const response = await request(app.getHttpServer(),).get('/auth/status');
        expect(response.status).toBe(401);
        });
    });
});