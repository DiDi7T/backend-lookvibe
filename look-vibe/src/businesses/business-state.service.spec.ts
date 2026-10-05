import { describe, expect, it, vi } from 'vitest';
import { BusinessStateService } from './business-state.service.js';
import { Business } from './entities/business.entity.js';
import { BusinessStatus } from './entities/business-status.enum.js';

describe('BusinessStateService', () => {
  it('activa el negocio cuando tiene ubicación, servicio y estilista', async () => {
    const business = {
      id: 'b5cd2a31-3aa3-4479-94b9-2e3dca83a7e6',
      latitud: 3.4516,
      longitud: -76.532,
      estado: BusinessStatus.EN_CONFIGURACION,
    } as Business;
    const businessRepository = { save: vi.fn().mockResolvedValue({ ...business, estado: BusinessStatus.ACTIVO }) };
    const serviceRepository = { count: vi.fn().mockResolvedValue(1) };
    const stylistRepository = { count: vi.fn().mockResolvedValue(1) };
    const service = new BusinessStateService(
      businessRepository as never,
      serviceRepository as never,
      stylistRepository as never,
    );

    const result = await service.refresh(business);

    expect(result.estado).toBe(BusinessStatus.ACTIVO);
    expect(businessRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ estado: BusinessStatus.ACTIVO }),
    );
  });

  it('mantiene el negocio en configuración cuando aún no tiene estilistas', async () => {
    const business = {
      id: 'bbf6012c-4f75-4b56-a09c-dc5e8c54f349',
      latitud: 3.4516,
      longitud: -76.532,
      estado: BusinessStatus.EN_CONFIGURACION,
    } as Business;
    const businessRepository = { save: vi.fn() };
    const serviceRepository = { count: vi.fn().mockResolvedValue(1) };
    const stylistRepository = { count: vi.fn().mockResolvedValue(0) };
    const service = new BusinessStateService(
      businessRepository as never,
      serviceRepository as never,
      stylistRepository as never,
    );

    const result = await service.refresh(business);

    expect(result.estado).toBe(BusinessStatus.EN_CONFIGURACION);
    expect(businessRepository.save).not.toHaveBeenCalled();
  });
});
