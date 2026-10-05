import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsModule } from '../appointments/appointments.module.js';
import { Service } from '../services/entities/service.entity.js';
import { Stylist } from '../stylists/entities/stylist.entity.js';
import { BusinessStateService } from './business-state.service.js';
import { BusinessesController } from './businesses.controller.js';
import { BusinessesService } from './businesses.service.js';
import { Business } from './entities/business.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Business, Service, Stylist]), AppointmentsModule],
  controllers: [BusinessesController],
  providers: [BusinessesService, BusinessStateService],
  exports: [BusinessesService, BusinessStateService],
})
export class BusinessesModule {}
