import { Injectable } from '@nestjs/common';
import { CreateEstablishmentDto } from './dto/create-establishment.dto.js';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto.js';

@Injectable()
export class EstablishmentsService {
  create(createEstablishmentDto: CreateEstablishmentDto) {
    return 'This action adds a new establishment';
  }

  findAll() {
    return `This action returns all establishments`;
  }

  findOne(id: number) {
    return `This action returns a #${id} establishment`;
  }

  update(id: number, updateEstablishmentDto: UpdateEstablishmentDto) {
    return `This action updates a #${id} establishment`;
  }

  remove(id: number) {
    return `This action removes a #${id} establishment`;
  }
}
