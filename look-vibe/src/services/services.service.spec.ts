import { describe, expect, it, vi } from 'vitest';
import { ServicesService } from './services.service.js';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { User } from '../users/entities/user.entity.js';

describe('ServicesService', () => {
  it('crea un servicio y recalcula el estado del negocio', async () => {
    const actor = { id: '60e0b4a4-8d0c-49f9-a4ed-6a5a6e4f9737', roles: [AppRoles.negocio] } as User;
    const business = { id: '424dafda-0ccf-4ab1-9f72-5989f08aa9ef' };
    const createdService = { id: '47fa6822-1889-4063-b6dc-d5ddcb0c4c86', nombre: 'Corte' };
    const repository = {
      create: vi.fn().mockReturnValue(createdService),
      save: vi.fn().mockResolvedValue(createdService),
    };
    const businessesService = { findManaged: vi.fn().mockResolvedValue(business) };
    const stateService = { refresh: vi.fn().mockResolvedValue(business) };
    const service = new ServicesService(repository as never, businessesService as never, stateService as never);

    const result = await service.create(business.id, actor, {
      nombre: 'Corte',
      precio: 35000,
      duracionMin: 45,
    });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ negocio: business }));
    expect(stateService.refresh).toHaveBeenCalledWith(business);
    expect(result).toBe(createdService);
  });
});
