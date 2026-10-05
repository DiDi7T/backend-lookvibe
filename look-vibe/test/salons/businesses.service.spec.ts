import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AppRoles } from '../../src/auth/interfaces/app-roles.js';
import { User } from '../../src/users/entities/user.entity.js';
import { BusinessesService } from '../../src/businesses/businesses.service.js';
import { Business } from '../../src/businesses/entities/business.entity.js';
import { BusinessStatus } from '../../src/businesses/entities/business-status.enum.js';

describe('BusinessesService', () => {
  const owner = { id: 'owner-1', roles: [AppRoles.negocio] } as User;

  it('creates a business in setup and refreshes its status', async () => {
    const business = {
      id: 'business-1',
      owner,
      estado: BusinessStatus.EN_CONFIGURACION,
    } as Business;
    const repository = {
      create: vi.fn().mockReturnValue(business),
      save: vi.fn().mockResolvedValue(business),
    };
    const stateService = { refresh: vi.fn().mockResolvedValue(business) };
    const service = new BusinessesService(
      repository as never,
      stateService as never,
      {} as never,
    );

    await expect(
      service.create(owner, { nombre: 'Corte Studio' }),
    ).resolves.toBe(business);
    expect(repository.create).toHaveBeenCalledWith({
      nombre: 'Corte Studio',
      owner,
      estado: BusinessStatus.EN_CONFIGURACION,
    });
    expect(repository.save).toHaveBeenCalledWith(business);
    expect(stateService.refresh).toHaveBeenCalledWith(business);
  });

  it('filters active businesses by service and radius', async () => {
    const nearby = { id: 'nearby', latitud: 0.02, longitud: 0 } as Business;
    const farAway = { id: 'far', latitud: 0.2, longitud: 0 } as Business;
    const missingCoordinates = {
      id: 'no-location',
      latitud: null,
      longitud: null,
    } as Business;
    const query = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([nearby, farAway, missingCoordinates]),
    };
    const repository = { createQueryBuilder: vi.fn().mockReturnValue(query) };
    const service = new BusinessesService(
      repository as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.findNearby({
        latitud: 0,
        longitud: 0,
        service: 'Corte',
        radiusKm: 10,
      }),
    ).resolves.toEqual([nearby]);
    expect(query.where).toHaveBeenCalledWith('business.estado = :estado', {
      estado: BusinessStatus.ACTIVO,
    });
    expect(query.andWhere).toHaveBeenCalledWith(
      '(service.id::text = :service OR LOWER(service.nombre) = LOWER(:service))',
      { service: 'Corte' },
    );
  });

  it('updates only a managed business and refreshes its status', async () => {
    const business = {
      id: 'business-1',
      owner,
      nombre: 'Before',
      latitud: 1,
      longitud: 2,
    } as Business;
    const repository = {
      findOne: vi.fn().mockResolvedValue(business),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    const stateService = {
      refresh: vi.fn().mockImplementation(async (value) => value),
    };
    const service = new BusinessesService(
      repository as never,
      stateService as never,
      {} as never,
    );

    await expect(
      service.update(business.id, owner, { nombre: 'After' }),
    ).resolves.toMatchObject({
      nombre: 'After',
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'After' }),
    );
    expect(stateService.refresh).toHaveBeenCalled();
  });

  it('rejects a partial location update', async () => {
    const business = {
      id: 'business-1',
      owner,
      latitud: null,
      longitud: null,
    } as Business;
    const repository = {
      findOne: vi.fn().mockResolvedValue(business),
      save: vi.fn(),
    };
    const service = new BusinessesService(
      repository as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.update(business.id, owner, { latitud: 3 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
