import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ScheduleIntervalDto } from './schedule-interval.dto.js';

export class SetScheduleDto {
  @IsArray()
  @ArrayMaxSize(56)
  @ValidateNested({ each: true })
  @Type(() => ScheduleIntervalDto)
  horarios: ScheduleIntervalDto[];

  @IsOptional()
  @IsString()
  zonaHoraria?: string;
}