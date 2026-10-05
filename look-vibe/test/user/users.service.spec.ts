import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import * as bcrypt from 'bcrypt';

import { UserService } from '../../src/users/users.service.js';
import { User } from '../../src/users/entities/user.entity.js';
import { AppRoles } from '../../src/auth/interfaces/app-roles.js';

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

describe('UserService', () => {
  let service: UserService;

  const repository = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOneBy: vi.fn(),
    createQueryBuilder: vi.fn(),
    preload: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('create', () => {
    it('should create a user successfully', async () => {
      const createUserDto = {
        nombre: 'Juan',
        email: 'juan@test.com',
        password: '123456',
        roles: [AppRoles.user],
      } as any;

      const hashedPassword = 'hashed_password';

      const createdUser = {
        id: '123',
        nombre: 'Juan',
        email: 'juan@test.com',
        passwordHash: hashedPassword,
        roles: [AppRoles.user],
        createdAt: new Date(),
      } as User;

      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      };

      repository.createQueryBuilder.mockReturnValue(queryBuilder);
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as never);
      repository.create.mockReturnValue(createdUser);
      repository.save.mockResolvedValue(createdUser);
      const result = await service.create(createUserDto);
      expect(repository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'user.email = :email',
        {
          email: 'juan@test.com',
        },
      );
      expect(queryBuilder.addSelect).toHaveBeenCalledWith(
        'user.passwordHash',
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('123456', 10);
      expect(repository.create).toHaveBeenCalledWith({
        nombre: 'Juan',
        email: 'juan@test.com',
        roles: [AppRoles.user],
        passwordHash: hashedPassword,
      });
      expect(repository.save).toHaveBeenCalledWith(createdUser);
      expect(result).toEqual(createdUser);
    });
    it('should throw ConflictException if email already exists', async () => {
      const createUserDto = {
        nombre: 'Juan',
        email: 'juan@test.com',
        password: '123456',
        roles: [AppRoles.user],
      } as any;
      const existingUser = {
        id: '123',
        nombre: 'Pedro',
        email: 'juan@test.com',
        passwordHash: 'existing_hash',
        roles: [AppRoles.user],
        createdAt: new Date(),
      } as User;
      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(existingUser),
      };
      repository.createQueryBuilder.mockReturnValue(queryBuilder);
      await expect(
        service.create(createUserDto),
      ).rejects.toThrow(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });
  describe('findAll', () => {
    it('should return all users', async () => {
      const users = [
        {
          id: '1',
          nombre: 'Juan',
          email: 'juan@test.com',
          passwordHash: 'hash1',
          roles: [AppRoles.user],
          createdAt: new Date(),
        },
        {
          id: '2',
          nombre: 'Pedro',
          email: 'pedro@test.com',
          passwordHash: 'hash2',
          roles: [AppRoles.user],
          createdAt: new Date(),
        },
      ] as User[];

      repository.find.mockResolvedValue(users);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalled();
      expect(result).toEqual(users);
    });
  });

  describe('findById', () => {
    it('should return a user when the id exists', async () => {
      const user = {
        id: '123',
        nombre: 'Juan',
        email: 'juan@test.com',
        passwordHash: 'hash',
        roles: [AppRoles.user],
        createdAt: new Date(),
      } as User;
      repository.findOneBy.mockResolvedValue(user);
      const result = await service.findById('123');
      expect(repository.findOneBy).toHaveBeenCalledWith({
        id: '123',
      });
      expect(result).toEqual(user);
    });
    it('should throw NotFoundException when the id does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);
      await expect(
        service.findById('123'),
      ).rejects.toThrow(NotFoundException);
      expect(repository.findOneBy).toHaveBeenCalledWith({
        id: '123',
      });
    });
  });

  describe('findOne', () => {
    it('should return a user when the email exists', async () => {
      const user = {
        id: '123',
        nombre: 'Juan',
        email: 'juan@test.com',
        passwordHash: 'hash',
        roles: [AppRoles.user],
        createdAt: new Date(),
      } as User;

      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(user),
      };
      repository.createQueryBuilder.mockReturnValue(queryBuilder);
      const result = await service.findOne('juan@test.com');
      expect(repository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'user.email = :email',
        {
          email: 'juan@test.com',
        },
      );
      expect(queryBuilder.addSelect).toHaveBeenCalledWith(
        'user.passwordHash',
      );

      expect(queryBuilder.getOne).toHaveBeenCalled();

      expect(result).toEqual(user);
    });

    it('should return null when the email does not exist', async () => {
      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      };

      repository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findOne('notfound@test.com');

      expect(result).toBeNull();

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'user.email = :email',
        {
          email: 'notfound@test.com',
        },
      );

      expect(queryBuilder.getOne).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a user successfully', async () => {
      const updateUserDto = {
        nombre: 'Juan Actualizado',
        email: 'juan@test.com',
      } as any;

      const user = {
        id: '123',
        nombre: 'Juan',
        email: 'juan@test.com',
        passwordHash: 'old_hash',
        roles: [AppRoles.user],
        createdAt: new Date(),
      } as User;

      repository.preload.mockResolvedValue(user);
      repository.save.mockResolvedValue(user);

      const result = await service.update(
        '123',
        updateUserDto,
      );

      expect(repository.preload).toHaveBeenCalledWith({
        id: '123',
        nombre: 'Juan Actualizado',
        email: 'juan@test.com',
      });
      expect(repository.save).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
    it('should update the password when a new password is provided', async () => {
      const updateUserDto = {
        nombre: 'Juan',
        password: 'newpassword',
      } as any;
      const user = {
        id: '123',
        nombre: 'Juan',
        email: 'juan@test.com',
        passwordHash: 'old_hash',
        roles: [AppRoles.user],
        createdAt: new Date(),
      } as User;
      const newHash = 'new_hashed_password';
      repository.preload.mockResolvedValue(user);
      vi.mocked(bcrypt.hash).mockResolvedValue(newHash as never);
      repository.save.mockResolvedValue(user);
      const result = await service.update(
        '123',
        updateUserDto,
      );
      expect(repository.preload).toHaveBeenCalledWith({
        id: '123',
        nombre: 'Juan',
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(
        'newpassword',
        10,
      );
      expect(user.passwordHash).toBe(newHash);
      expect(repository.save).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });
    it('should throw NotFoundException when the user does not exist', async () => {
      const updateUserDto = {
        nombre: 'Juan',
      } as any;
      repository.preload.mockResolvedValue(null);
      await expect(
        service.update('123', updateUserDto),
      ).rejects.toThrow(NotFoundException);
      expect(repository.preload).toHaveBeenCalledWith({
        id: '123',
        nombre: 'Juan',
      });
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
  describe('remove', () => {
    it('should remove a user successfully', async () => {
      const user = {
        id: '123',
        nombre: 'Juan',
        email: 'juan@test.com',
        passwordHash: 'hash',
        roles: [AppRoles.user],
        createdAt: new Date(),
      } as User;
      repository.findOneBy.mockResolvedValue(user);
      repository.remove.mockResolvedValue(user);
      const result = await service.remove('123');
      expect(repository.findOneBy).toHaveBeenCalledWith({
        id: '123',
      });
      expect(repository.remove).toHaveBeenCalledWith(user);
      expect(result).toBeUndefined();
    });
    it('should throw NotFoundException when the user does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);
      await expect(
        service.remove('123'),
      ).rejects.toThrow(NotFoundException);
      expect(repository.findOneBy).toHaveBeenCalledWith({
        id: '123',
      });
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});