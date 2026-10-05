import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreatePortfolioDto {
  @IsUrl()
  @MaxLength(2048)
  fotoUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;
}
