import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

describe('ReviewsController', () => {
  let controller: ReviewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: { create: vi.fn(), findByBusiness: vi.fn() } }],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
