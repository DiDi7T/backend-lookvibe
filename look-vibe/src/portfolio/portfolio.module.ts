import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { StylistsModule } from '../stylists/stylists.module.js';
import { PortfolioItem } from './entities/portfolio.entity.js';
import { PortfolioController } from './portfolio.controller.js';
import { PortfolioService } from './portfolio.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PortfolioItem]),
    AuthModule,
    BusinessesModule,
    StylistsModule,
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
