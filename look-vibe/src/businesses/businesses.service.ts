import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { User } from '../users/entities/user.entity.js';
import { BusinessStateService } from './business-state.service.js';
import { CreateBusinessDto } from './dto/create-business.dto.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';
import { Business } from './entities/business.entity.js';
import { BusinessStatus } from './entities/business-status.enum.js';

type NearbyFilter = {
  latitud?: number;
  longitud?: number;
  service?: string;
  radiusKm?: number;
};

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly businessStateService: BusinessStateService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  async create(owner: User, dto: CreateBusinessDto): Promise<Business> {
    const business = this.businessRepository.create({
      ...dto,
      owner,
      estado: BusinessStatus.EN_CONFIGURACION,
    });
    const savedBusiness = await this.businessRepository.save(business);
    return this.businessStateService.refresh(savedBusiness);
  }

  async findOwned(ownerId: string): Promise<Business[]> {
    return this.businessRepository.find({
      where: { owner: { id: ownerId } },
      relations: { estilistas: true, servicios: true },
    });
  }

  async findPublic(id: string): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { id, estado: BusinessStatus.ACTIVO },
      relations: { estilistas: true, servicios: true },
    });
    if (!business) {
      throw new NotFoundException(`Negocio con ID ${id} no encontrado`);
    }
    return business;
  }

  async findNearby(filter: NearbyFilter): Promise<Business[]> {
    const query = this.businessRepository
      .createQueryBuilder('business')
      .leftJoinAndSelect('business.servicios', 'service')
      .leftJoinAndSelect('business.estilistas', 'stylist')
      .where('business.estado = :estado', { estado: BusinessStatus.ACTIVO });

    if (filter.service) {
      query.andWhere('(service.id::text = :service OR LOWER(service.nombre) = LOWER(:service))', {
        service: filter.service,
      });
    }

    const businesses = await query.getMany();
    if (filter.latitud === undefined || filter.longitud === undefined) {
      return businesses;
    }

    const radiusKm = filter.radiusKm ?? 10;
    return businesses.filter((business) => {
      if (business.latitud === null || business.longitud === null) {
        return false;
      }
      return this.distanceInKm(filter.latitud!, filter.longitud!, business.latitud, business.longitud) <= radiusKm;
    });
  }

  async getAvailability(id: string, fecha?: string, duracionMin?: string, pasoMin?: string) {
    return this.appointmentsService.getBusinessAvailability(id, fecha, duracionMin, pasoMin);
  }

  async update(id: string, actor: User, dto: UpdateBusinessDto): Promise<Business> {
    const business = await this.findManaged(id, actor);
    Object.assign(business, dto);
    this.ensureLocationIsComplete(business);
    const savedBusiness = await this.businessRepository.save(business);
    return this.businessStateService.refresh(savedBusiness);
  }

  async findManaged(id: string, actor: User): Promise<Business> {
    const business = await this.findExisting(id);
    if (!actor.roles.includes(AppRoles.admin) && business.owner.id !== actor.id) {
      throw new ForbiddenException('No puedes administrar este negocio');
    }
    return business;
  }

  async findExisting(id: string): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { id },
      relations: { owner: true, estilistas: true, servicios: true },
    });
    if (!business) {
      throw new NotFoundException(`Negocio con ID ${id} no encontrado`);
    }
    return business;
  }

  private ensureLocationIsComplete(business: Business): void {
    const hasLatitude = business.latitud !== null && business.latitud !== undefined;
    const hasLongitude = business.longitud !== null && business.longitud !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw new ForbiddenException('La ubicación debe incluir latitud y longitud');
    }
  }

  private distanceInKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number): number {
    const earthRadiusKm = 6371;
    const latitudeDelta = this.toRadians(latitudeB - latitudeA);
    const longitudeDelta = this.toRadians(longitudeB - longitudeA);
    const formula =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(this.toRadians(latitudeA)) *
        Math.cos(this.toRadians(latitudeB)) *
        Math.sin(longitudeDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(formula), Math.sqrt(1 - formula));
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }
}
