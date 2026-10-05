import { Test } from '@nestjs/testing';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

describe('ReportsController', () => {
  it('is defined', async () => {
    const module = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: {} }],
    }).compile();

    expect(module.get(ReportsController)).toBeDefined();
  });
});
