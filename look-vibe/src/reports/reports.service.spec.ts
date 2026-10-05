import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { AppointmentSchedule } from '../appointments/entities/appointment-schedule.entity.js';
import { Business } from '../businesses/entities/business.entity.js';
import { Review } from '../reviews/entities/review.entity.js';
import { User } from '../users/entities/user.entity.js';
import { ReportsService } from './reports.service.js';

describe('ReportsService', () => {
  it('is defined', async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Appointment), useValue: {} },
        { provide: getRepositoryToken(Business), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Review), useValue: {} },
        { provide: getRepositoryToken(AppointmentSchedule), useValue: {} },
      ],
    }).compile();

    expect(module.get(ReportsService)).toBeDefined();
  });
});
