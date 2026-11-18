import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator.js';
import { UserDecorator } from '../auth/decorators/user/user.decorator.js';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { User } from '../users/entities/user.entity.js';
import { AppointmentsService } from './appointments.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { UpdateAppointmentDto } from './dto/update-appointment.dto.js';
import { SetScheduleDto } from './dto/set-schedule.dto.js';
import { toAppointmentResponse } from './dto/appointment-response.dto.js';

@Controller(['citas', 'appointments'])
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Auth(AppRoles.cliente, AppRoles.admin)
  create(@UserDecorator() user: User, @Body() createAppointmentDto: CreateAppointmentDto) {
    const dto = user.roles.includes(AppRoles.admin)
      ? createAppointmentDto
      : { ...createAppointmentDto, usuarioId: user.id };
    return this.appointmentsService.create(dto).then(toAppointmentResponse);
  }

  @Get()
  @Auth(AppRoles.cliente, AppRoles.negocio, AppRoles.estilista, AppRoles.admin)
  findAll(@UserDecorator() user: User) {
    return this.appointmentsService.findAll(user).then((appointments) => appointments.map(toAppointmentResponse));
  }

  @Get('negocios/:id/disponibilidad')
  getBusinessAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('fecha') fecha?: string,
    @Query('duracionMin') duracionMin?: string,
    @Query('pasoMin') pasoMin?: string,
  ) {
    return this.appointmentsService.getBusinessAvailability(id, fecha, duracionMin, pasoMin);
  }

  @Get('negocios/:id/horarios')
  getBusinessSchedule(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.getBusinessSchedule(id);
  }

  @Get('estilistas/:id/disponibilidad')
  getStylistAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('fecha') fecha?: string,
    @Query('duracionMin') duracionMin?: string,
    @Query('pasoMin') pasoMin?: string,
  ) {
    return this.appointmentsService.getStylistAvailability(id, fecha, duracionMin, pasoMin);
  }

  @Put('negocios/:id/horarios')
  @Auth(AppRoles.negocio, AppRoles.admin)
  setBusinessSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @UserDecorator() user: User,
    @Body() dto: SetScheduleDto,
  ) {
    return this.appointmentsService.setBusinessSchedule(id, user, dto);
  }

  @Put('estilistas/:id/horarios')
  @Auth(AppRoles.estilista, AppRoles.negocio, AppRoles.admin)
  setStylistSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @UserDecorator() user: User,
    @Body() dto: SetScheduleDto,
  ) {
    return this.appointmentsService.setStylistSchedule(id, user, dto);
  }

  @Get(':id')
  @Auth(AppRoles.cliente, AppRoles.negocio, AppRoles.estilista, AppRoles.admin)
  findOne(@Param('id', ParseUUIDPipe) id: string, @UserDecorator() user: User) {
    return this.appointmentsService.findOne(id, user).then(toAppointmentResponse);
  }

  @Put(':id')
  @Auth(AppRoles.cliente, AppRoles.negocio, AppRoles.estilista, AppRoles.admin)
  update(@Param('id', ParseUUIDPipe) id: string, @UserDecorator() user: User, @Body() updateAppointmentDto: UpdateAppointmentDto) {
    return this.appointmentsService.update(id, updateAppointmentDto, user).then(toAppointmentResponse);
  }

  @Patch(':id')
  @Auth(AppRoles.cliente, AppRoles.negocio, AppRoles.estilista, AppRoles.admin)
  patch(@Param('id', ParseUUIDPipe) id: string, @UserDecorator() user: User, @Body() updateAppointmentDto: UpdateAppointmentDto) {
    return this.appointmentsService.update(id, updateAppointmentDto, user).then(toAppointmentResponse);
  }

  @Patch(':id/completada')
  @Auth(AppRoles.negocio, AppRoles.estilista, AppRoles.admin)
  markCompleted(@Param('id', ParseUUIDPipe) id: string, @UserDecorator() user: User, @Body('completada') completada = true) {
    return this.appointmentsService.markCompleted(id, completada, user).then(toAppointmentResponse);
  }

  @Delete(':id')
  @Auth(AppRoles.cliente, AppRoles.negocio, AppRoles.estilista, AppRoles.admin)
  remove(@Param('id', ParseUUIDPipe) id: string, @UserDecorator() user: User, @Query('motivo') motivo?: string) {
    return this.appointmentsService.remove(id, motivo, user);
  }
}
