import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';

import { UsersController } from './users.controller.js';
import { UserService } from './users.service.js';

describe('UsersController', () => {
  let controller: UsersController;
beforeEach(async () => {
    const mockUserService = {
      create: vi.fn(),
      findAll: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});