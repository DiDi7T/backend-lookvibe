import { PartialType } from '@nestjs/mapped-types';
import { CreateEstablishmentDto } from './create-establishment.dto.js';

export class UpdateEstablishmentDto extends PartialType(CreateEstablishmentDto) {}
