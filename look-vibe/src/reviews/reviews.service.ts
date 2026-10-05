import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { StylistsService } from '../stylists/stylists.service.js';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { User } from '../users/entities/user.entity.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { Review } from './entities/review.entity.js';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly businessesService: BusinessesService,
    private readonly stylistsService: StylistsService,
  ) {}

  async create(user: User, dto: CreateReviewDto): Promise<Review> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id: dto.citaId },
      relations: { usuario: true, negocio: true, estilista: true },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.usuario.id !== user.id) {
      throw new ForbiddenException('La cita no pertenece al usuario autenticado');
    }

    const estadoCita = appointment.estado?.toLowerCase();
    if (estadoCita !== 'completada' && estadoCita !== 'completado') {
      throw new BadRequestException('No se puede crear una reseña si la cita no está marcada como completada');
    }

    let business = appointment.negocio;
    if (dto.negocioId) {
      business = await this.businessesService.findPublic(dto.negocioId);
    }

    let stylist = appointment.estilista;
    if (dto.estilistaId) {
      stylist = await this.stylistsService.findOne(dto.estilistaId);
    }

    const review = this.reviewRepository.create({
      usuario: user,
      negocio: business,
      estilista: stylist,
      cita: appointment,
      calificacion: dto.calificacion,
      comentario: dto.comentario,
    });

    return this.reviewRepository.save(review);
  }

  async findByBusiness(businessId: string): Promise<Review[]> {
    await this.businessesService.findPublic(businessId);
    return this.reviewRepository.find({
      where: { negocio: { id: businessId } },
      relations: { usuario: true },
    });
  }

  async findByStylist(stylistId: string): Promise<Review[]> {
    await this.stylistsService.findOne(stylistId);
    return this.reviewRepository.find({
      where: { estilista: { id: stylistId } },
      relations: { usuario: true },
    });
  }

  async remove(id: string, actor: User): Promise<void> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: { usuario: true, negocio: { owner: true } },
    });
    if (!review) {
      throw new NotFoundException(`Reseña con ID ${id} no encontrada`);
    }

    const isAdmin = actor.roles.includes(AppRoles.admin);
    if (!isAdmin) {
      throw new ForbiddenException('Solo el rol admin puede moderar (eliminar) reseñas');
    }

    await this.reviewRepository.remove(review);
  }

  async report(id: string, actor: User): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: {
        negocio: { owner: true },
        estilista: { usuario: true, negocio: { owner: true } },
      },
    });
    if (!review) {
      throw new NotFoundException(`Reseña con ID ${id} no encontrada`);
    }
    const isAdmin = actor.roles.includes(AppRoles.admin);
    const ownsBusinessReview = review.negocio?.owner.id === actor.id;
    const ownsStylistProfile = review.estilista?.usuario?.id === actor.id;
    const ownsStylistBusiness = review.estilista?.negocio?.owner.id === actor.id;
    if (!isAdmin && !ownsBusinessReview && !ownsStylistProfile && !ownsStylistBusiness) {
      throw new ForbiddenException('No puedes reportar una reseña que no pertenece a tu negocio o perfil');
    }
    review.reportado = true;
    return this.reviewRepository.save(review);
  }
}
