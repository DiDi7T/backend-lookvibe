import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessesService } from '../businesses/businesses.service.js';
import { StylistsService } from '../stylists/stylists.service.js';
import { User } from '../users/entities/user.entity.js';
import { CreatePortfolioDto } from './dto/create-portfolio.dto.js';
import { PortfolioItem } from './entities/portfolio.entity.js';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(PortfolioItem)
    private readonly portfolioRepository: Repository<PortfolioItem>,
    private readonly businessesService: BusinessesService,
    private readonly stylistsService: StylistsService,
  ) {}

  async addForBusiness(businessId: string, actor: User, dto: CreatePortfolioDto): Promise<PortfolioItem> {
    const business = await this.businessesService.findManaged(businessId, actor);
    const item = this.portfolioRepository.create({
      ...dto,
      negocio: business,
      estilista: null,
    });
    return this.portfolioRepository.save(item);
  }

  async addForStylist(stylistId: string, actor: User, dto: CreatePortfolioDto): Promise<PortfolioItem> {
    const stylist = await this.stylistsService.findManaged(stylistId, actor);
    const item = this.portfolioRepository.create({
      ...dto,
      estilista: stylist,
      negocio: null,
    });
    return this.portfolioRepository.save(item);
  }

  async findByBusiness(businessId: string): Promise<PortfolioItem[]> {
    await this.businessesService.findPublic(businessId);
    return this.portfolioRepository.find({
      where: { negocio: { id: businessId } },
    });
  }

  async findByStylist(stylistId: string): Promise<PortfolioItem[]> {
    await this.stylistsService.findOne(stylistId);
    return this.portfolioRepository.find({
      where: { estilista: { id: stylistId } },
    });
  }
}
