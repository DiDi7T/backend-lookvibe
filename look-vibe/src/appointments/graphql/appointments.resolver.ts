import { UseGuards } from '@nestjs/common';
import {Args,Context,ID,Mutation,Query,Int,Resolver,} from '@nestjs/graphql';import { RoleProtected } from '../../auth/decorators/role-protected.decorator.js';
import { GqlJwtAuthGuard } from '../../auth/guards/gql-jwt-auth.guard.js';
import { UserRoleGuard } from '../../auth/guards/user-role/user-role.guard.js';
import { AppRoles } from '../../auth/interfaces/app-roles.js';
import type { User } from '../../users/entities/user.entity.js';
import { AppointmentsService } from '../appointments.service.js';
import { toAppointmentResponse } from '../dto/appointment-response.dto.js';
import type { Appointment } from '../entities/appointment.entity.js';
import { AppointmentGraphql } from './appointment.graphql-types.js';
//Traigo lo de el types
//todo esto es para poder usarlo en el resolver, y asi poder hacer las mutaciones y queries
import {
  AvailabilityGraphql,
  BusinessScheduleGraphql,
  CreateAppointmentInput,
  ScheduleResultGraphql,
  SetScheduleInput,
  UpdateAppointmentInput,
} from './appointment.graphql-types.js';
import type { UpdateAppointmentDto } from '../dto/update-appointment.dto.js';
type GraphQLContext = { req: { user: User } };
import { CreateAppointmentDto } from '../dto/create-appointment.dto.js';

@Resolver(() => AppointmentGraphql)
export class AppointmentsResolver {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Query(() => [AppointmentGraphql], { name: 'appointments' })
  @RoleProtected(
    AppRoles.cliente,
    AppRoles.negocio,
    AppRoles.estilista,
    AppRoles.admin,
  )
  @UseGuards(GqlJwtAuthGuard, UserRoleGuard)
  async findAll(
    @Context() context: GraphQLContext,
  ): Promise<AppointmentGraphql[]> {
    const appointments = await this.appointmentsService.findAll(
      context.req.user,
    );
    return appointments.map((appointment) =>
      this.toGraphqlAppointment(appointment),
    );
  }

  @Query(() => AppointmentGraphql, { name: 'appointment', nullable: true })
  @RoleProtected(
    AppRoles.cliente,
    AppRoles.negocio,
    AppRoles.estilista,
    AppRoles.admin,
  )
  @UseGuards(GqlJwtAuthGuard, UserRoleGuard)
  async findOne(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: GraphQLContext,
  ): Promise<AppointmentGraphql> {
    const appointment = await this.appointmentsService.findOne(
      id,
      context.req.user,
    );
    return this.toGraphqlAppointment(appointment);
  }

  //Aca lets do las mutaciones
@Mutation(() => AppointmentGraphql, { name: 'createAppointment' })
  @RoleProtected(AppRoles.cliente, AppRoles.negocio, AppRoles.admin)
  @UseGuards(GqlJwtAuthGuard, UserRoleGuard)
  async createAppointment(
    @Args('input') input: CreateAppointmentInput,
    @Context() context: GraphQLContext,
  ): Promise<AppointmentGraphql> {
    const dto = this.toCreateAppointmentDto(input, context.req.user);
    const created = await this.appointmentsService.create(dto);
    return this.toGraphqlAppointment(created);
  }

  private toCreateAppointmentDto(
    input: CreateAppointmentInput,
    actor: User,
  ): CreateAppointmentDto {
    const isAdmin = actor.roles.includes(AppRoles.admin);
    return {
      usuarioId: isAdmin ? input.usuarioId : actor.id,
      negocioId: input.negocioId,
      estilistaId: input.estilistaId,
      servicioId: input.servicioId,
      fechaHora: input.fechaHora,
      nota: input.nota,
    };
  }
  //El marcar como completado es relativamente sensillo, 
  //los args hacen casi todo el trabajo
  @Mutation(() => AppointmentGraphql, { name: 'completeAppointment' })
  @RoleProtected(AppRoles.negocio, AppRoles.estilista, AppRoles.admin)
  @UseGuards(GqlJwtAuthGuard, UserRoleGuard)
  async completeAppointment(
    @Args('id', { type: () => ID }) id: string,
    @Args('completed', { type: () => Boolean, defaultValue: true })
    completed: boolean,
    @Context() context: GraphQLContext,
  ): Promise<AppointmentGraphql> {
    const updated = await this.appointmentsService.markCompleted(
      id,
      completed,
      context.req.user,
    );
    return this.toGraphqlAppointment(updated);
  }
  //Mutacion para poder cancelar el appointment
  @Mutation(() => Boolean, { name: 'cancelAppointment' })
  @RoleProtected(
    AppRoles.cliente,
    AppRoles.negocio,
    AppRoles.estilista,
    AppRoles.admin,
  )
  //se cancela el appointment, trae lo del types 
  @UseGuards(GqlJwtAuthGuard, UserRoleGuard)
  async cancelAppointment(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: GraphQLContext,
    @Args('motivo', { type: () => String, nullable: true }) motivo?: string,
  ): Promise<boolean> {
    await this.appointmentsService.remove(id, motivo, context.req.user);
    return true;
  }

  //update 
  @Mutation(() => AppointmentGraphql, { name: 'updateAppointment' })
  @RoleProtected(
    AppRoles.cliente,
    AppRoles.negocio,
    AppRoles.estilista,
    AppRoles.admin,
  )
  @UseGuards(GqlJwtAuthGuard, UserRoleGuard)
  async updateAppointment(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateAppointmentInput,
    @Context() context: GraphQLContext,
  ): Promise<AppointmentGraphql> {
    const actor = context.req.user;
    const dto: UpdateAppointmentDto = {
      ...input,
      usuarioId: actor.roles.includes(AppRoles.admin) ? input.usuarioId : undefined,
    };
    const updated = await this.appointmentsService.update(id, dto, actor); //reutlizamos de el servicio para las validaciones y demas, y luego lo retornamos a graphql
    return this.toGraphqlAppointment(updated);
  }

  @Mutation(() => ScheduleResultGraphql, { name: 'setBusinessSchedule' })
  @RoleProtected(AppRoles.negocio, AppRoles.admin)
  @UseGuards(GqlJwtAuthGuard, UserRoleGuard)
  setBusinessSchedule(
    @Args('businessId', { type: () => ID }) businessId: string,
    @Args('input') input: SetScheduleInput,
    @Context() context: GraphQLContext,
  ): Promise<ScheduleResultGraphql> {
    return this.appointmentsService.setBusinessSchedule(businessId, context.req.user, input);
  }

  @Mutation(() => ScheduleResultGraphql, { name: 'setStylistSchedule' })
  @RoleProtected(AppRoles.estilista, AppRoles.negocio, AppRoles.admin)
  @UseGuards(GqlJwtAuthGuard, UserRoleGuard)
  setStylistSchedule(
    @Args('stylistId', { type: () => ID }) stylistId: string,
    @Args('input') input: SetScheduleInput,
    @Context() context: GraphQLContext,
  ): Promise<ScheduleResultGraphql> {
    return this.appointmentsService.setStylistSchedule(stylistId, context.req.user, input);
  }

  @Query(() => BusinessScheduleGraphql, { name: 'businessSchedule' })
  businessSchedule(
    @Args('businessId', { type: () => ID }) businessId: string,
  ): Promise<BusinessScheduleGraphql> {
    return this.appointmentsService.getBusinessSchedule(businessId);
  }

  @Query(() => AvailabilityGraphql, { name: 'businessAvailability' })
  businessAvailability(
    @Args('businessId', { type: () => ID }) businessId: string,
    @Args('fecha', { type: () => String, nullable: true }) fecha?: string,
    @Args('duracionMin', { type: () => Int, nullable: true }) duracionMin?: number,
    @Args('pasoMin', { type: () => Int, nullable: true }) pasoMin?: number,
  ): Promise<AvailabilityGraphql> {
    return this.appointmentsService.getBusinessAvailability(
      businessId,
      fecha,
      duracionMin?.toString(),
      pasoMin?.toString(),
    );
  }

  @Query(() => AvailabilityGraphql, { name: 'stylistAvailability' })
  stylistAvailability(
    @Args('stylistId', { type: () => ID }) stylistId: string,
    @Args('fecha', { type: () => String, nullable: true }) fecha?: string,
    @Args('duracionMin', { type: () => Int, nullable: true }) duracionMin?: number,
    @Args('pasoMin', { type: () => Int, nullable: true }) pasoMin?: number,
  ): Promise<AvailabilityGraphql> {
    return this.appointmentsService.getStylistAvailability(
      stylistId,
      fecha,
      duracionMin?.toString(),
      pasoMin?.toString(),
    );
  }

  //


  private toGraphqlAppointment(appointment: Appointment): AppointmentGraphql {
    const response = toAppointmentResponse(appointment);
    return {
      ...response,
      servicio: {
        ...response.servicio,
        precio: Number(response.servicio.precio),
      },
      precioBase:
        response.precioBase === null ? null : Number(response.precioBase),
      descuentoBienvenida: Number(response.descuentoBienvenida),
      precioTotal:
        response.precioTotal === null ? null : Number(response.precioTotal),
    };
  }
  




}
