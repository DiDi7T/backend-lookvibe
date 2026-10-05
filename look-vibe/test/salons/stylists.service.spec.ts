import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AppRoles } from '../../src/auth/interfaces/app-roles.js';
import { BusinessesService } from '../../src/businesses/businesses.service.js';
import { BusinessStateService } from '../../src/businesses/business-state.service.js';
import { User } from '../../src/users/entities/user.entity.js';
import { StylistsService } from '../../src/stylists/stylists.service.js';

describe('StylistsService', () => {
  const stylistUser = {
    id: 'stylist-user',
    roles: [AppRoles.estilista],
  } as User;
  const businessOwner = {
    id: 'business-owner',
    roles: [AppRoles.negocio],
  } as User;
  const business = { id: 'business-1', owner: businessOwner };

  it('creates an independent profile linked to the user and no business', async () => {
    const profile = { id: 'stylist-1', usuario: stylistUser, negocio: null };
    const repository = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockReturnValue(profile),
      save: vi.fn().mockResolvedValue(profile),
    };
    const service = new StylistsService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.createIndependent(stylistUser, { especialidad: 'Colorimetría' }),
    ).resolves.toBe(profile);
    expect(repository.create).toHaveBeenCalledWith({
      especialidad: 'Colorimetría',
      usuario: stylistUser,
      negocio: null,
    });
  });

  it('rejects a second profile for the same user', async () => {
    const repository = {
      findOne: vi.fn().mockResolvedValue({ id: 'existing' }),
    };
    const service = new StylistsService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.createIndependent(stylistUser, { especialidad: 'Colorimetría' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a manual stylist without a user and refreshes the business', async () => {
    const profile = { id: 'manual-1', negocio: business, usuario: null };
    const repository = {
      create: vi.fn().mockReturnValue(profile),
      save: vi.fn().mockResolvedValue(profile),
    };
    const businesses = { findManaged: vi.fn().mockResolvedValue(business) };
    const state = { refresh: vi.fn() };
    const service = new StylistsService(
      repository as never,
      {} as never,
      businesses as never as BusinessesService,
      state as never as BusinessStateService,
    );

    await expect(
      service.createManual(business.id, businessOwner, {
        especialidad: 'Manicure',
      }),
    ).resolves.toBe(profile);
    expect(repository.create).toHaveBeenCalledWith({
      especialidad: 'Manicure',
      negocio: business,
      usuario: null,
    });
    expect(state.refresh).toHaveBeenCalledWith(business);
  });

  it('records an affiliation request for the stylist profile owner', async () => {
    const profile = {
      id: 'stylist-1',
      usuario: stylistUser,
      negocioSolicitado: null,
    };
    const repository = {
      findOne: vi.fn().mockResolvedValue(profile),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    const businesses = { findExisting: vi.fn().mockResolvedValue(business) };
    const service = new StylistsService(
      repository as never,
      {} as never,
      businesses as never,
      {} as never,
    );

    await expect(
      service.solicitarAfiliacion(profile.id, stylistUser, business.id),
    ).resolves.toMatchObject({
      estadoAfiliacion: 'PENDIENTE',
      negocioSolicitado: business,
    });
  });

  it('rejects an affiliation request made by someone else', async () => {
    const profile = { id: 'stylist-1', usuario: stylistUser };
    const repository = { findOne: vi.fn().mockResolvedValue(profile) };
    const service = new StylistsService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.solicitarAfiliacion(profile.id, businessOwner, business.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts a pending request and clears the requested business', async () => {
    const profile = {
      id: 'stylist-1',
      usuario: stylistUser,
      negocio: null,
      negocioSolicitado: business,
      estadoAfiliacion: 'PENDIENTE',
    };
    const repository = {
      findOne: vi.fn().mockResolvedValue(profile),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    const businesses = { findManaged: vi.fn().mockResolvedValue(business) };
    const state = { refresh: vi.fn() };
    const service = new StylistsService(
      repository as never,
      {} as never,
      businesses as never as BusinessesService,
      state as never as BusinessStateService,
    );

    await expect(
      service.afiliarEstilista(business.id, profile.id, businessOwner),
    ).resolves.toMatchObject({
      negocio: business,
      negocioSolicitado: null,
      estadoAfiliacion: 'AFILIADO',
    });
    expect(state.refresh).toHaveBeenCalledWith(business);
  });

  it('rejects accepting an affiliation without a pending request', async () => {
    const profile = {
      id: 'stylist-1',
      usuario: stylistUser,
      estadoAfiliacion: 'INDEPENDIENTE',
      negocioSolicitado: null,
    };
    const repository = { findOne: vi.fn().mockResolvedValue(profile) };
    const businesses = { findManaged: vi.fn().mockResolvedValue(business) };
    const service = new StylistsService(
      repository as never,
      {} as never,
      businesses as never as BusinessesService,
      {} as never,
    );

    await expect(
      service.afiliarEstilista(business.id, profile.id, businessOwner),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
