import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @MaxLength(120)
  nombre: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precio: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  duracionMin: number;
}
