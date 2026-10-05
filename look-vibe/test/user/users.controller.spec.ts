import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { UsersController } from '../../src/users/users.controller.js';
import { UserService } from '../../src/users/users.service.js';
import { User } from '../../src/users/entities/user.entity.js';
import { PassportModule } from '@nestjs/passport';

describe('UsersController', () => {
  let controller: UsersController;

  const userService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [UsersController],
      providers: [
        {
          provide: UserService,
          useValue: userService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
      const createUserDto = {
        nombre: 'Juan',
        email: 'juan@test.com',
        password: '123456',
      };

      const createdUser = {
        id: '123',
        nombre: 'Juan',
        email: 'juan@test.com',
      } as User;

      userService.create.mockResolvedValue(createdUser);

      const result = await controller.create(createUserDto as any);

      expect(userService.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(createdUser);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const users = [
        {
          id: '1',
          nombre: 'Juan',
          email: 'juan@test.com',
        },
        {
          id: '2',
          nombre: 'Pedro',
          email: 'pedro@test.com',
        },
      ] as User[];

      userService.findAll.mockResolvedValue(users);

      const result = await controller.findAll();

      expect(userService.findAll).toHaveBeenCalled();
      expect(result).toEqual(users);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const user = {
        id: '123',
        nombre: 'Juan',
        email: 'juan@test.com',
      } as User;

      userService.findById.mockResolvedValue(user);

      const result = await controller.findOne('123');

      expect(userService.findById).toHaveBeenCalledWith('123');
      expect(result).toEqual(user);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateUserDto = {
        nombre: 'Juan Actualizado',
        email: 'juan@test.com',
      };

      const updatedUser = {
        id: '123',
        nombre: 'Juan Actualizado',
        email: 'juan@test.com',
      } as User;

      userService.update.mockResolvedValue(updatedUser);

      const result = await controller.update(
        '123',
        updateUserDto as any,
      );

      expect(userService.update).toHaveBeenCalledWith(
        '123',
        updateUserDto,
      );

      expect(result).toEqual(updatedUser);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      userService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('123');

      expect(userService.remove).toHaveBeenCalledWith('123');
      expect(result).toBeUndefined();
    });
  });

  describe('findUserRole', () => {
    it('should return the roles of a user', async () => {
      const user = {
        id: '123',
        nombre: 'Juan',
        email: 'juan@test.com',
        roles: ['user'],
      } as User;

      userService.findById.mockResolvedValue(user);

      const result = await controller.findUserRole('123');

      expect(userService.findById).toHaveBeenCalledWith('123');

      expect(result).toEqual({
        roles: ['user'],
      });
    });
  });
});