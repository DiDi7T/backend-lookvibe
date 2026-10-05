import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsModule } from '../appointments/appointments.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { Stylist } from './entities/stylist.entity.js';
import { StylistsController } from './stylists.controller.js';
import { StylistsService } from './stylists.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Stylist]), BusinessesModule, AppointmentsModule],
  controllers: [StylistsController],
  providers: [StylistsService],
  exports: [StylistsService],
})
export class StylistsModule {}
