import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  citaId: string;

  @IsOptional()
  @IsUUID()
  negocioId?: string;

  @IsOptional()
  @IsUUID()
  estilistaId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  calificacion: number;

  @IsString()
  @MaxLength(1000)
  comentario: string;
}
