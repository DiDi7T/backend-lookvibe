import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AppRoles } from '../../src/auth/interfaces/app-roles.js';
import { BusinessesService } from '../../src/businesses/businesses.service.js';
import { BusinessStateService } from '../../src/businesses/business-state.service.js';
import { User } from '../../src/users/entities/user.entity.js';
import { ServicesService } from '../../src/services/services.service.js';
import { Service } from '../../src/services/entities/service.entity.js';

describe('ServicesService', () => {
  const owner = { id: 'owner-1', roles: [AppRoles.negocio] } as User;
  const business = { id: 'business-1', owner };
  const serviceEntity = {
    id: 'service-1',
    negocio: business,
    nombre: 'Corte',
  } as Service;

  it('creates a service for a managed business and refreshes its state', async () => {
    const repository = {
      create: vi.fn().mockReturnValue(serviceEntity),
      save: vi.fn().mockResolvedValue(serviceEntity),
    };
    const businesses = { findManaged: vi.fn().mockResolvedValue(business) };
    const state = { refresh: vi.fn() };
    const service = new ServicesService(
      repository as never,
      businesses as never as BusinessesService,
      state as never as BusinessStateService,
    );
    const dto = { nombre: 'Corte', precio: 45000, duracionMin: 45 };

    await expect(service.create(business.id, owner, dto)).resolves.toBe(
      serviceEntity,
    );
    expect(repository.create).toHaveBeenCalledWith({
      ...dto,
      negocio: business,
    });
    expect(state.refresh).toHaveBeenCalledWith(business);
  });

  it('lists services only after confirming the business is public', async () => {
    const repository = { find: vi.fn().mockResolvedValue([serviceEntity]) };
    const businesses = { findPublic: vi.fn().mockResolvedValue(business) };
    const service = new ServicesService(
      repository as never,
      businesses as never,
      {} as never,
    );

    await expect(service.findAll(business.id)).resolves.toEqual([
      serviceEntity,
    ]);
    expect(repository.find).toHaveBeenCalledWith({
      where: { negocio: { id: business.id } },
    });
  });

  it('updates a service belonging to the managed business', async () => {
    const repository = {
      findOne: vi.fn().mockResolvedValue(serviceEntity),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    const businesses = { findManaged: vi.fn().mockResolvedValue(business) };
    const state = { refresh: vi.fn() };
    const service = new ServicesService(
      repository as never,
      businesses as never as BusinessesService,
      state as never as BusinessStateService,
    );

    await expect(
      service.update(business.id, serviceEntity.id, owner, { precio: 50000 }),
    ).resolves.toMatchObject({
      precio: 50000,
    });
    expect(state.refresh).toHaveBeenCalledWith(business);
  });

  it('does not update a service from another business', async () => {
    const repository = {
      findOne: vi.fn().mockResolvedValue({
        ...serviceEntity,
        negocio: { id: 'different-business' },
      }),
      save: vi.fn(),
    };
    const service = new ServicesService(
      repository as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.update(business.id, serviceEntity.id, owner, { precio: 50000 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('throws when a requested service does not exist', async () => {
    const repository = { findOne: vi.fn().mockResolvedValue(null) };
    const service = new ServicesService(
      repository as never,
      {} as never,
      {} as never,
    );

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
