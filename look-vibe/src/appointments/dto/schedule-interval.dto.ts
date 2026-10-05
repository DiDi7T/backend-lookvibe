import { IsInt, Matches, Max, Min } from 'class-validator';

export class ScheduleIntervalDto {
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaInicio: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaFin: string;
}