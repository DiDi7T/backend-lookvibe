import { describe, expect, it, vi } from 'vitest';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { User } from '../users/entities/user.entity.js';
import { BusinessesService } from './businesses.service.js';
import { Business } from './entities/business.entity.js';
import { BusinessStatus } from './entities/business-status.enum.js';

describe('BusinessesService', () => {
  const owner = { id: '8de61b39-bd7b-4227-bc6f-6f19f03bce3e', roles: [AppRoles.negocio] } as User;

  it('crea un negocio en configuración', async () => {
    const business = { id: 'e9d8d7ff-0f8f-4303-92a7-04f4a5a15e21', owner, estado: BusinessStatus.EN_CONFIGURACION } as Business;
    const repository = {
      create: vi.fn().mockReturnValue(business),
      save: vi.fn().mockResolvedValue(business),
    };
    const stateService = { refresh: vi.fn().mockResolvedValue(business) };
    const appointmentsService = { getBusinessAvailability: vi.fn() };
    const service = new BusinessesService(repository as never, stateService as never, appointmentsService as never);

    const result = await service.create(owner, { nombre: 'Corte Studio' });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ owner, estado: BusinessStatus.EN_CONFIGURACION }),
    );
    expect(stateService.refresh).toHaveBeenCalledWith(business);
    expect(result).toBe(business);
  });

  it('rechaza editar un negocio de otro propietario', async () => {
    const business = { id: '168d4d41-90f5-415f-8832-d21b6aa56b25', owner: { id: 'other-owner' } } as Business;
    const repository = { findOne: vi.fn().mockResolvedValue(business) };
    const service = new BusinessesService(repository as never, {} as never, {} as never);

    await expect(service.findManaged(business.id, owner)).rejects.toThrow('No puedes administrar este negocio');
  });

  it('delegates public availability to the appointments module', async () => {
    const business = { id: 'business-1', estado: BusinessStatus.ACTIVO } as Business;
    const repository = { findOne: vi.fn().mockResolvedValue(business) };
    const appointmentsService = { getBusinessAvailability: vi.fn().mockResolvedValue({ slots: [] }) };
    const service = new BusinessesService(repository as never, {} as never, appointmentsService as never);

    await expect(service.getAvailability('business-1', '2026-10-10', '45', '15')).resolves.toEqual({ slots: [] });
    expect(appointmentsService.getBusinessAvailability).toHaveBeenCalledWith('business-1', '2026-10-10', '45', '15');
  });
});
