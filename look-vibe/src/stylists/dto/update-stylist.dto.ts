import { PartialType } from '@nestjs/mapped-types';
import { CreateStylistDto } from './create-stylist.dto.js';

export class UpdateStylistDto extends PartialType(CreateStylistDto) {}
