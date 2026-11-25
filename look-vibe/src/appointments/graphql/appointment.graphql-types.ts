import { InputType, Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {ArrayMaxSize,IsArray,IsDateString,IsInt,IsNotEmpty,IsOptional,IsString,IsUUID,Matches,Max,MaxLength,Min,ValidateNested,} from 'class-validator';
@ObjectType('AppointmentUser')
export class AppointmentUserGraphql {
  @Field(() => ID)
  id: string;

  @Field()
  nombre: string;

  @Field()
  email: string;

  @Field(() => [String])
  roles: string[];
}

@ObjectType('AppointmentBusiness')
export class AppointmentBusinessGraphql {
  @Field(() => ID)
  id: string;

  @Field()
  nombre: string;

  @Field(() => String, { nullable: true })
  direccion: string | null;
}

@ObjectType('AppointmentStylist')
export class AppointmentStylistGraphql {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  fotoUrl: string | null;

  @Field()
  especialidad: string;

  @Field()
  estadoAfiliacion: string;

  @Field(() => AppointmentBusinessGraphql, { nullable: true })
  negocio?: AppointmentBusinessGraphql | null;
}

@ObjectType('AppointmentService')
export class AppointmentServiceGraphql {
  @Field(() => ID)
  id: string;

  @Field()
  nombre: string;

  @Field(() => Float)
  precio: number;

  @Field(() => Int)
  duracionMin: number;
}

@ObjectType('Appointment')
export class AppointmentGraphql {
  @Field(() => ID)
  id: string;

  @Field(() => AppointmentUserGraphql)
  usuario: AppointmentUserGraphql;

  @Field(() => AppointmentBusinessGraphql, { nullable: true })
  negocio: AppointmentBusinessGraphql | null;

  @Field(() => AppointmentStylistGraphql, { nullable: true })
  estilista: AppointmentStylistGraphql | null;

  @Field(() => AppointmentServiceGraphql)
  servicio: AppointmentServiceGraphql;

  @Field()
  fechaHora: string;

  @Field(() => Int)
  duracionMin: number;

  @Field(() => Float, { nullable: true })
  precioBase: number | null;

  @Field(() => Float)
  descuentoBienvenida: number;

  @Field()
  beneficioBienvenidaAplicado: boolean;

  @Field(() => Float, { nullable: true })
  precioTotal: number | null;

  @Field()
  estado: string;

  @Field(() => String, { nullable: true })
  nota: string | null;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}




@ObjectType('AvailabilitySlot')
export class AvailabilitySlotGraphql {
  @Field()
  fecha: string;

  @Field(() => [String])
  slots: string[];
}


@InputType('ScheduleIntervalInput')
export class ScheduleIntervalInput {
  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana: number;

  @Field()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaInicio: string;

  @Field()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaFin: string;
}


@InputType('CreateAppointmentInput')
export class CreateAppointmentInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsUUID()
  usuarioId: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  negocioId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  estilistaId?: string;

  @Field(() => ID)
  @IsNotEmpty()
  @IsUUID()
  servicioId: string;

  @Field()
  @IsNotEmpty()
  @IsDateString()
  fechaHora: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;
}


@InputType('UpdateAppointmentInput')
export class UpdateAppointmentInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  negocioId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  estilistaId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  servicioId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  fechaHora?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivoCancelacion?: string;
}


@ObjectType('ScheduleInterval') //el intervalo de horario es un objeto que tiene el dia de la semana, 
// //la hora de inicio y la hora de fin
export class ScheduleIntervalGraphql {
  @Field(() => Int)
  diaSemana: number;

  @Field()
  horaInicio: string;

  @Field()
  horaFin: string;
}

@ObjectType('BusinessSchedule') //definimos la respuesta de la consulta de horarios de un negocio
export class BusinessScheduleGraphql {
  @Field(() => ID)
  businessId: string;

  @Field()
  zonaHoraria: string;

  @Field(() => [ScheduleIntervalGraphql])
  horarios: ScheduleIntervalGraphql[];
}

@ObjectType('ScheduleResult') //aca lo mismo pero para la consulta en estilista 
export class ScheduleResultGraphql {
  @Field()
  tipoRecurso: string;

  @Field(() => ID)
  recursoId: string;

  @Field()
  zonaHoraria: string;

  @Field(() => [ScheduleIntervalGraphql])
  horarios: ScheduleIntervalGraphql[];
}

@ObjectType('TimeSlot')
//Creé TimeSlot en lugar de reutilizar el AvailabilitySlot que
// ya existía porque ese decía slots que era un string y el servicio devuelve objetos { inicio, fin, disponible }
export class TimeSlotGraphql {
  @Field()
  inicio: string;

  @Field()
  fin: string;

  @Field()
  disponible: boolean;
}

@ObjectType('Availability')
export class AvailabilityGraphql {
  @Field()
  fecha: string;

  @Field()
  zonaHoraria: string;

  @Field(() => Int)
  ocupadas: number;

  @Field(() => [TimeSlotGraphql])
  slots: TimeSlotGraphql[];
}

@InputType('SetScheduleInput')
export class SetScheduleInput {
  @Field(() => [ScheduleIntervalInput])
  @IsArray()
  @ArrayMaxSize(56)
  @ValidateNested({ each: true })
  @Type(() => ScheduleIntervalInput)
  horarios: ScheduleIntervalInput[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  zonaHoraria?: string;
}