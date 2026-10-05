import { describe, expect, it, vi } from 'vitest';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { User } from '../users/entities/user.entity.js';
import { StylistsService } from './stylists.service.js';

describe('StylistsService', () => {
  it('crea un estilista independiente asociado al usuario autenticado', async () => {
    const user = { id: '22da0708-5f79-4ab8-9bc3-2aed0eb5d827', roles: [AppRoles.estilista] } as User;
    const stylist = { id: 'cd9ca47e-ed9a-4d03-9ec8-ae0cc46c6b85', usuario: user, negocio: null };
    const repository = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockReturnValue(stylist),
      save: vi.fn().mockResolvedValue(stylist),
    };
    const service = new StylistsService(repository as never, {} as never, {} as never, {} as never);

    const result = await service.createIndependent(user, { especialidad: 'Colorimetría' });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ usuario: user, negocio: null }),
    );
    expect(result).toBe(stylist);
  });

  it('no permite dos perfiles de estilista para el mismo usuario', async () => {
    const user = { id: 'd721c655-04eb-4654-b33c-94b3971e0c62', roles: [AppRoles.estilista] } as User;
    const repository = { findOne: vi.fn().mockResolvedValue({ id: 'existing-profile' }) };
    const service = new StylistsService(repository as never, {} as never, {} as never, {} as never);

    await expect(service.createIndependent(user, { especialidad: 'Barbería' })).rejects.toThrow(
      'El usuario ya tiene un perfil de estilista',
    );
  });

  it('carga el negocio solicitado al recuperar un perfil para aceptar una afiliación', async () => {
    const requestedBusiness = { id: 'business-1' };
    const stylist = {
      id: 'cd9ca47e-ed9a-4d03-9ec8-ae0cc46c6b85',
      negocioSolicitado: requestedBusiness,
    };
    const repository = { findOne: vi.fn().mockResolvedValue(stylist) };
    const service = new StylistsService(repository as never, {} as never, {} as never, {} as never);

    await expect(service.findOne(stylist.id)).resolves.toBe(stylist);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: stylist.id },
      relations: { negocio: { owner: true }, negocioSolicitado: true, usuario: true },
    });
  });
});