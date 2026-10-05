import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { UserService } from '../users/users.service.js';
import { RevokedToken } from './entities/revoked-token.entity.js';

describe('AuthService', () => {
  let service: AuthService;

  const userService = {
    create: vi.fn(),
    findOne: vi.fn(),
  };

  const jwtService = {
    sign: vi.fn(),
  };

  const revokedTokenRepository = {
    findOneBy: vi.fn(),
    save: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: userService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: getRepositoryToken(RevokedToken),
          useValue: revokedTokenRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});