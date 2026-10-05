import { describe, expect, it, vi } from 'vitest';
import { BusinessesService } from '../../src/businesses/businesses.service.js';
import { StylistsService } from '../../src/stylists/stylists.service.js';
import { PortfolioService } from '../../src/portfolio/portfolio.service.js';

describe('PortfolioService', () => {
  const business = { id: 'business-1' };
  const stylist = { id: 'stylist-1' };
  const actor = { id: 'owner-1', roles: ['negocio'] };

  it('adds a photo URL to a managed business portfolio', async () => {
    const item = { id: 'portfolio-1', negocio: business, estilista: null };
    const repository = {
      create: vi.fn().mockReturnValue(item),
      save: vi.fn().mockResolvedValue(item),
    };
    const businesses = { findManaged: vi.fn().mockResolvedValue(business) };
    const service = new PortfolioService(
      repository as never,
      businesses as never,
      {} as never,
    );
    const dto = {
      fotoUrl: 'https://example.com/photo.jpg',
      descripcion: 'Trabajo realizado',
    };

    await expect(
      service.addForBusiness(business.id, actor as never, dto),
    ).resolves.toBe(item);
    expect(repository.create).toHaveBeenCalledWith({
      ...dto,
      negocio: business,
      estilista: null,
    });
  });

  it('adds a photo URL to a stylist portfolio after checking permissions', async () => {
    const item = { id: 'portfolio-2', negocio: null, estilista: stylist };
    const repository = {
      create: vi.fn().mockReturnValue(item),
      save: vi.fn().mockResolvedValue(item),
    };
    const stylists = { findManaged: vi.fn().mockResolvedValue(stylist) };
    const service = new PortfolioService(
      repository as never,
      {} as never,
      stylists as never,
    );
    const dto = { fotoUrl: 'https://example.com/style.jpg' };

    await expect(
      service.addForStylist(stylist.id, actor as never, dto),
    ).resolves.toBe(item);
    expect(repository.create).toHaveBeenCalledWith({
      ...dto,
      estilista: stylist,
      negocio: null,
    });
  });

  it('lists portfolio items after verifying the profile exists', async () => {
    const items = [{ id: 'portfolio-1' }];
    const repository = { find: vi.fn().mockResolvedValue(items) };
    const businesses = { findPublic: vi.fn().mockResolvedValue(business) };
    const stylists = { findOne: vi.fn().mockResolvedValue(stylist) };
    const service = new PortfolioService(
      repository as never,
      businesses as never as BusinessesService,
      stylists as never as StylistsService,
    );

    await expect(service.findByBusiness(business.id)).resolves.toEqual(items);
    await expect(service.findByStylist(stylist.id)).resolves.toEqual(items);
    expect(repository.find).toHaveBeenNthCalledWith(1, {
      where: { negocio: { id: business.id } },
    });
    expect(repository.find).toHaveBeenNthCalledWith(2, {
      where: { estilista: { id: stylist.id } },
    });
  });
});
