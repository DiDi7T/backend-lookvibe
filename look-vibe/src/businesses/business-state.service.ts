import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from '../services/entities/service.entity.js';
import { Stylist } from '../stylists/entities/stylist.entity.js';
import { Business } from './entities/business.entity.js';
import { BusinessStatus } from './entities/business-status.enum.js';

@Injectable()
export class BusinessStateService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(Stylist)
    private readonly stylistRepository: Repository<Stylist>,
  ) {}

  async refresh(business: Business): Promise<Business> {
    const [serviceCount, stylistCount] = await Promise.all([
      this.serviceRepository.count({ where: { negocio: { id: business.id } } }),
      this.stylistRepository.count({ where: { negocio: { id: business.id } } }),
    ]);
    const hasValidLocation = business.latitud !== null && business.longitud !== null;
    const estado =
      hasValidLocation && serviceCount > 0 && stylistCount > 0
        ? BusinessStatus.ACTIVO
        : BusinessStatus.EN_CONFIGURACION;

    if (business.estado !== estado) {
      business.estado = estado;
      return this.businessRepository.save(business);
    }

    return business;
  }
}
