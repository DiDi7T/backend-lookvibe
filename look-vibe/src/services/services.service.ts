import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessStateService } from '../businesses/business-state.service.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { User } from '../users/entities/user.entity.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { Service } from './entities/service.entity.js';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    private readonly businessesService: BusinessesService,
    private readonly businessStateService: BusinessStateService,
  ) {}

  async create(businessId: string, actor: User, dto: CreateServiceDto): Promise<Service> {
    const business = await this.businessesService.findManaged(businessId, actor);
    const service = await this.serviceRepository.save(
      this.serviceRepository.create({ ...dto, negocio: business }),
    );
    await this.businessStateService.refresh(business);
    return service;
  }

  async findAll(businessId: string): Promise<Service[]> {
    await this.businessesService.findPublic(businessId);
    return this.serviceRepository.find({ where: { negocio: { id: businessId } } });
  }

  async findAllManaged(businessId: string, actor: User): Promise<Service[]> {
    await this.businessesService.findManaged(businessId, actor);
    return this.serviceRepository.find({ where: { negocio: { id: businessId } } });
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.serviceRepository.findOne({
      where: { id },
      relations: { negocio: { owner: true } },
    });
    if (!service) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }
    return service;
  }

  async findPublic(businessId: string, id: string): Promise<Service> {
    await this.businessesService.findPublic(businessId);
    const service = await this.findOne(id);
    if (service.negocio.id !== businessId) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }
    return service;
  }

  async update(businessId: string, id: string, actor: User, dto: UpdateServiceDto): Promise<Service> {
    const service = await this.findOne(id);
    if (service.negocio.id !== businessId) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }
    await this.businessesService.findManaged(businessId, actor);
    Object.assign(service, dto);
    const savedService = await this.serviceRepository.save(service);
    await this.businessStateService.refresh(savedService.negocio);
    return savedService;
  }

  async remove(businessId: string, id: string, actor: User): Promise<void> {
    const service = await this.findOne(id);
    if (service.negocio.id !== businessId) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }
    const business = await this.businessesService.findManaged(businessId, actor);
    await this.serviceRepository.remove(service);
    await this.businessStateService.refresh(business);
  }
}
