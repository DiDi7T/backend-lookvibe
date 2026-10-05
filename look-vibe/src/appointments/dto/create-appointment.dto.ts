import { Type } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAppointmentDto {
  @IsNotEmpty()
  @IsUUID()
  usuarioId: string;

  @IsOptional()
  @IsUUID()
  negocioId?: string;

  @IsOptional()
  @IsUUID()
  estilistaId?: string;

  @IsNotEmpty()
  @IsUUID()
  servicioId: string;

  @IsNotEmpty()
  @IsDateString()
  fechaHora: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;

  @IsOptional()
  @Type(() => Date)
  readonly fecha?: Date;
}
