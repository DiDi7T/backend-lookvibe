import { Test, TestingModule } from '@nestjs/testing';
import { EstablishmentsController } from './establishments.controller.js';
import { EstablishmentsService } from './establishments.service.js';

describe('EstablishmentsController', () => {
  let controller: EstablishmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EstablishmentsController],
      providers: [EstablishmentsService],
    }).compile();

    controller = module.get<EstablishmentsController>(EstablishmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
