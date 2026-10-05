import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateStylistDto {
  @IsString()
  @MaxLength(160)
  especialidad: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  fotoUrl?: string;
}
