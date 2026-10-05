import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { AppointmentSchedule } from '../appointments/entities/appointment-schedule.entity.js';
import { Business } from '../businesses/entities/business.entity.js';
import { Review } from '../reviews/entities/review.entity.js';
import { User } from '../users/entities/user.entity.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Appointment,
      AppointmentSchedule,
      Business,
      Review,
      User,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
