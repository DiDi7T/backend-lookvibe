import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../businesses/entities/business.entity.js';
import { Service } from '../services/entities/service.entity.js';
import { Stylist } from '../stylists/entities/stylist.entity.js';
import { User } from '../users/entities/user.entity.js';
import { AppointmentsService } from './appointments.service.js';
import { AppointmentsController } from './appointments.controller.js';
import { Appointment } from './entities/appointment.entity.js';
import { AppointmentSchedule } from './entities/appointment-schedule.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment, AppointmentSchedule, Business, Stylist, Service, User])],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService, TypeOrmModule],
})
export class AppointmentsModule {}
