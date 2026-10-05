import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { AuthController } from '../../src/auth/auth.controller.js';
import { AuthService } from '../../src/auth/auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
    registerUser: vi.fn(),
    loginUser: vi.fn(),
    logoutUser: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [AuthController],
        providers: [
          {
            provide: AuthService,
            useValue: authService,
          },
        ],
      }).compile();

    controller = module.get<AuthController>(
      AuthController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('registerUser', () => {
    it('should register a user', async () => {
      const createUserDto = {
        nombre: 'Juan',
        email: 'juan@test.com',
        password: '123456',
      };

      const response = {
        id: '123',
        nombre: 'Juan',
        email: 'juan@test.com',
        token: 'fake-token',
      };

      authService.registerUser.mockResolvedValue(response);

      const result = await controller.registerUser(
        createUserDto as any,
      );

      expect(authService.registerUser).toHaveBeenCalledWith(
        createUserDto,
      );

      expect(result).toEqual(response);
    });
  });

  describe('loginUser', () => {
    it('should login a user', async () => {
      const loginUserDto = {
        email: 'juan@test.com',
        password: '123456',
      };

      const response = {
        user_id: '123',
        email: 'juan@test.com',
        roles: ['user'],
        token: 'fake-jwt-token',
      };

      authService.loginUser.mockResolvedValue(response);

      const result = await controller.loginUser(
        loginUserDto,
      );

      expect(authService.loginUser).toHaveBeenCalledWith(
        loginUserDto,
      );

      expect(result).toEqual(response);
    });
  });

  describe('logout', () => {
    it('should logout and invalidate the token', async () => {
      const token = 'fake-jwt-token';

      const response = {
        message: 'User logged out successfully',
      };

      authService.logoutUser.mockResolvedValue(response);

      const result = await controller.logout(token);

      expect(authService.logoutUser).toHaveBeenCalledWith(
        token,
      );

      expect(result).toEqual(response);
    });
  });

  describe('checkAuthStatus', () => {
    it('should return authentication status', () => {
      const result = controller.checkAuthStatus();

      expect(result).toEqual({
        ok: true,
        message: 'Autenticado y autorizado correctamente',
      });
    });
  });
});