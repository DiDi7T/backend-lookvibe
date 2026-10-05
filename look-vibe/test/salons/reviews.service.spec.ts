import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AppRoles } from '../../src/auth/interfaces/app-roles.js';
import { Appointment } from '../../src/appointments/entities/appointment.entity.js';
import { BusinessesService } from '../../src/businesses/businesses.service.js';
import { StylistsService } from '../../src/stylists/stylists.service.js';
import { User } from '../../src/users/entities/user.entity.js';
import { Review } from '../../src/reviews/entities/review.entity.js';
import { ReviewsService } from '../../src/reviews/reviews.service.js';

describe('ReviewsService', () => {
  const client = { id: 'client-1', roles: [AppRoles.cliente] } as User;
  const admin = { id: 'admin-1', roles: [AppRoles.admin] } as User;
  const appointment = {
    id: 'appointment-1',
    usuario: client,
    negocio: { id: 'business-1' },
    estilista: { id: 'stylist-1' },
    estado: 'completada',
  } as Appointment;
  const dto = {
    citaId: appointment.id,
    calificacion: 5,
    comentario: 'Excelente atención',
  };

  function setup(appointmentResult: Appointment | null = appointment) {
    const reviewRepository = {
      create: vi.fn().mockImplementation((value) => value),
      save: vi
        .fn()
        .mockImplementation(async (value) => ({ id: 'review-1', ...value })),
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      remove: vi.fn(),
    };
    const appointmentRepository = {
      findOne: vi.fn().mockResolvedValue(appointmentResult),
    };
    const businesses = {
      findPublic: vi.fn().mockResolvedValue(appointment.negocio),
    };
    const stylists = {
      findOne: vi.fn().mockResolvedValue(appointment.estilista),
    };
    const service = new ReviewsService(
      reviewRepository as never,
      appointmentRepository as never,
      businesses as never as BusinessesService,
      stylists as never as StylistsService,
    );
    return {
      service,
      reviewRepository,
      appointmentRepository,
      businesses,
      stylists,
    };
  }

  it('creates a review for the authenticated user appointment when it is completed', async () => {
    const { service, reviewRepository } = setup();

    await expect(service.create(client, dto)).resolves.toMatchObject({
      usuario: client,
      cita: appointment,
      negocio: appointment.negocio,
      estilista: appointment.estilista,
      calificacion: 5,
    });
    expect(reviewRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ comentario: dto.comentario }),
    );
  });

  it('rejects reviews for missing appointments or another user appointment', async () => {
    const missing = setup(null);
    await expect(missing.service.create(client, dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const belongsToAnotherUser = setup({
      ...appointment,
      usuario: { id: 'different-user' },
    } as Appointment);
    await expect(
      belongsToAnotherUser.service.create(client, dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a review unless the appointment is completed', async () => {
    const { service } = setup({
      ...appointment,
      estado: 'pendiente',
    } as Appointment);

    await expect(service.create(client, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('resolves optional business and stylist targets', async () => {
    const { service, businesses, stylists } = setup();
    const explicitTargets = {
      ...dto,
      negocioId: 'business-2',
      estilistaId: 'stylist-2',
    };

    await service.create(client, explicitTargets);
    expect(businesses.findPublic).toHaveBeenCalledWith('business-2');
    expect(stylists.findOne).toHaveBeenCalledWith('stylist-2');
  });

  it('lists reviews after validating each target profile', async () => {
    const { service, reviewRepository, businesses, stylists } = setup();
    reviewRepository.find.mockResolvedValue([{ id: 'review-1' }]);

    await expect(service.findByBusiness('business-1')).resolves.toEqual([
      { id: 'review-1' },
    ]);
    await expect(service.findByStylist('stylist-1')).resolves.toEqual([
      { id: 'review-1' },
    ]);
    expect(businesses.findPublic).toHaveBeenCalledWith('business-1');
    expect(stylists.findOne).toHaveBeenCalledWith('stylist-1');
  });

  it('allows only an admin to delete an existing review', async () => {
    const { service, reviewRepository } = setup();
    const review = { id: 'review-1' } as Review;
    reviewRepository.findOne.mockResolvedValue(review);

    await expect(service.remove(review.id, admin)).resolves.toBeUndefined();
    expect(reviewRepository.remove).toHaveBeenCalledWith(review);
    await expect(service.remove(review.id, client)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
