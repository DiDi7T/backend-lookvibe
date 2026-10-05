import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { BusinessStateService } from '../businesses/business-state.service.js';
import { User } from '../users/entities/user.entity.js';
import { CreateStylistDto } from './dto/create-stylist.dto.js';
import { UpdateStylistDto } from './dto/update-stylist.dto.js';
import { Stylist } from './entities/stylist.entity.js';

@Injectable()
export class StylistsService {
  constructor(
    @InjectRepository(Stylist)
    private readonly stylistRepository: Repository<Stylist>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly businessesService: BusinessesService,
    private readonly businessStateService: BusinessStateService,
  ) {}

  async createIndependent(user: User, dto: CreateStylistDto): Promise<Stylist> {
    const existingProfile = await this.stylistRepository.findOne({
      where: { usuario: { id: user.id } },
    });
    if (existingProfile) {
      throw new ConflictException('El usuario ya tiene un perfil de estilista');
    }
    return this.stylistRepository.save(
      this.stylistRepository.create({ ...dto, usuario: user, negocio: null }),
    );
  }

  async createManual(businessId: string, actor: User, dto: CreateStylistDto): Promise<Stylist> {
    const business = await this.businessesService.findManaged(businessId, actor);
    const stylist = await this.stylistRepository.save(
      this.stylistRepository.create({ ...dto, negocio: business, usuario: null }),
    );
    await this.businessStateService.refresh(business);
    return stylist;
  }

  async findByBusiness(businessId: string): Promise<Stylist[]> {
    await this.businessesService.findPublic(businessId);
    return this.stylistRepository.find({
      where: { negocio: { id: businessId } },
      relations: { usuario: true },
    });
  }

  async findByBusinessManaged(businessId: string, actor: User): Promise<Stylist[]> {
    await this.businessesService.findManaged(businessId, actor);
    return this.stylistRepository.find({
      where: { negocio: { id: businessId } },
      relations: { usuario: true },
    });
  }

  async findOne(id: string): Promise<Stylist> {
    const stylist = await this.stylistRepository.findOne({
      where: { id },
      relations: { negocio: { owner: true }, negocioSolicitado: true, usuario: true },
    });
    if (!stylist) {
      throw new NotFoundException(`Estilista con ID ${id} no encontrado`);
    }
    return stylist;
  }

  async getAvailability(id: string, fecha?: string, duracionMin?: string, pasoMin?: string) {
    await this.findOne(id);
    const duration = this.parsePositiveMinutes(duracionMin, 60, 'duracionMin');
    const step = this.parsePositiveMinutes(pasoMin, 60, 'pasoMin');
    const selectedDate = fecha ? new Date(fecha) : new Date();
    const slotStart = new Date(selectedDate);
    slotStart.setHours(8, 0, 0, 0);

    const slotEnd = new Date(selectedDate);
    slotEnd.setHours(20, 0, 0, 0);

    const appointments = await this.appointmentRepository.find({
      where: {
        estilista: { id },
        estado: In(['pendiente', 'completada', 'no_realizada']),
      },
      relations: { estilista: true },
    });

    const slots: Array<{ inicio: string; fin: string; disponible: boolean }> = [];
    const cursor = new Date(slotStart);

    while (cursor.getTime() + duration * 60 * 1000 <= slotEnd.getTime()) {
      const inicio = new Date(cursor);
      const fin = new Date(cursor.getTime() + duration * 60 * 1000);
      const disponible = !appointments.some((appointment) => {
        const appointmentStart = new Date(appointment.fechaHora).getTime();
        const appointmentEnd = appointmentStart + (appointment.duracionMin ?? 60) * 60 * 1000;
        return appointmentStart < fin.getTime() && appointmentEnd > inicio.getTime();
      });

      slots.push({ inicio: inicio.toISOString(), fin: fin.toISOString(), disponible });
      cursor.setTime(cursor.getTime() + step * 60 * 1000);
    }

    return {
      stylistId: id,
      fecha: selectedDate.toISOString().slice(0, 10),
      ocupadas: slots.filter((slot) => !slot.disponible).length,
      slots,
    };
  }

  private parsePositiveMinutes(value: string | undefined, defaultValue: number, field: string): number {
    if (value === undefined) return defaultValue;
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      throw new BadRequestException(`${field} debe ser un entero entre 1 y 1440`);
    }
    return minutes;
  }

  async findManaged(id: string, actor: User): Promise<Stylist> {
    const stylist = await this.findOne(id);
    this.assertCanManage(stylist, actor);
    return stylist;
  }

  async update(id: string, actor: User, dto: UpdateStylistDto): Promise<Stylist> {
    const stylist = await this.findManaged(id, actor);
    Object.assign(stylist, dto);
    const savedStylist = await this.stylistRepository.save(stylist);
    if (savedStylist.negocio) {
      await this.businessStateService.refresh(savedStylist.negocio);
    }
    return savedStylist;
  }

  async remove(id: string, actor: User): Promise<void> {
    const stylist = await this.findManaged(id, actor);
    const business = stylist.negocio;
    await this.stylistRepository.remove(stylist);
    if (business) {
      await this.businessStateService.refresh(business);
    }
  }

  async solicitarAfiliacion(id: string, actor: User, businessId: string): Promise<Stylist> {
    const stylist = await this.findOne(id);
    if (!stylist.usuario || stylist.usuario.id !== actor.id) {
      if (!actor.roles.includes(AppRoles.admin)) {
        throw new ForbiddenException('Solo el dueño del perfil de estilista puede solicitar afiliación');
      }
    }
    const business = await this.businessesService.findExisting(businessId);
    stylist.estadoAfiliacion = 'PENDIENTE';
    stylist.negocioSolicitado = business;
    return this.stylistRepository.save(stylist);
  }

  async afiliarEstilista(businessId: string, stylistId: string, actor: User): Promise<Stylist> {
    const business = await this.businessesService.findManaged(businessId, actor);
    const stylist = await this.findOne(stylistId);
    if (!stylist.usuario) {
      throw new ConflictException('Este estilista no tiene cuenta propia asociada');
    }
    if (stylist.estadoAfiliacion !== 'PENDIENTE' || stylist.negocioSolicitado?.id !== businessId) {
      throw new ConflictException('El estilista no tiene una solicitud pendiente para este negocio');
    }
    stylist.negocio = business;
    stylist.estadoAfiliacion = 'AFILIADO';
    stylist.negocioSolicitado = null;
    const saved = await this.stylistRepository.save(stylist);
    await this.businessStateService.refresh(business);
    return saved;
  }

  private assertCanManage(stylist: Stylist, actor: User): void {
    const isAdmin = actor.roles.includes(AppRoles.admin);
    const isProfileOwner = stylist.usuario?.id === actor.id;
    const isBusinessOwner = stylist.negocio?.owner.id === actor.id;
    if (!isAdmin && !isProfileOwner && !isBusinessOwner) {
      throw new ForbiddenException('No puedes administrar este perfil de estilista');
    }
  }
}
