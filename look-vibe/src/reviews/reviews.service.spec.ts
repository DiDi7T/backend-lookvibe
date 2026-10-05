import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { StylistsService } from '../stylists/stylists.service.js';
import { Review } from './entities/review.entity.js';
import { ReviewsService } from './reviews.service.js';

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(Review), useValue: { findOne: vi.fn(), save: vi.fn() } },
        { provide: getRepositoryToken(Appointment), useValue: { findOne: vi.fn() } },
        { provide: BusinessesService, useValue: { findPublic: vi.fn() } },
        { provide: StylistsService, useValue: { findOne: vi.fn() } },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
