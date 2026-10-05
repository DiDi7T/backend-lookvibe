import { PartialType } from '@nestjs/mapped-types';
import { CreateFavoriteDto } from './create-favorite.dto.js';

export class UpdateFavoriteDto extends PartialType(CreateFavoriteDto) {}
