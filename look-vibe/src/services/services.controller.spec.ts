import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';

describe('ServicesController', () => {
  let controller: ServicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [{ provide: ServicesService, useValue: { create: vi.fn(), findAll: vi.fn() } }],
    }).compile();

    controller = module.get<ServicesController>(ServicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
