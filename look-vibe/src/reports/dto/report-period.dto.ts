import { IsDateString, IsOptional, Matches } from 'class-validator';

export class ReportPeriodDto {
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  desde?: string;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  hasta?: string;
}
