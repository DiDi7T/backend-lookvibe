import { Module } from '@nestjs/common';
import { EstablishmentsService } from './establishments.service.js';
import { EstablishmentsController } from './establishments.controller.js';

@Module({
  controllers: [EstablishmentsController],
  providers: [EstablishmentsService],
})
export class EstablishmentsModule {}
