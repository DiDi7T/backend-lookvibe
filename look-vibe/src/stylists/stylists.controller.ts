import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator.js';
import { UserDecorator } from '../auth/decorators/user/user.decorator.js';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { User } from '../users/entities/user.entity.js';
import { CreateStylistDto } from './dto/create-stylist.dto.js';
import { UpdateStylistDto } from './dto/update-stylist.dto.js';
import { StylistsService } from './stylists.service.js';

@Controller()
export class StylistsController {
  constructor(private readonly stylistsService: StylistsService) {}

  @Post('estilistas')
  @Auth(AppRoles.estilista, AppRoles.admin)
  createIndependent(@UserDecorator() user: User, @Body() dto: CreateStylistDto) {
    return this.stylistsService.createIndependent(user, dto);
  }

  @Post('negocios/:businessId/estilistas')
  @Auth(AppRoles.negocio, AppRoles.admin)
  createManual(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @UserDecorator() user: User,
    @Body() dto: CreateStylistDto,
  ) {
    return this.stylistsService.createManual(businessId, user, dto);
  }

  @Get('negocios/:businessId/estilistas')
  findByBusiness(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.stylistsService.findByBusiness(businessId);
  }

  @Get('negocios/:businessId/estilistas/gestion')
  @Auth(AppRoles.negocio, AppRoles.admin)
  findByBusinessManaged(@Param('businessId', ParseUUIDPipe) businessId: string, @UserDecorator() user: User) {
    return this.stylistsService.findByBusinessManaged(businessId, user);
  }

  @Get('estilistas/:id/disponibilidad')
  getAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('fecha') fecha?: string,
    @Query('duracionMin') duracionMin?: string,
    @Query('pasoMin') pasoMin?: string,
  ) {
    return this.stylistsService.getAvailability(id, fecha, duracionMin, pasoMin);
  }

  @Get('estilistas/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.stylistsService.findOne(id);
  }

  @Patch('estilistas/:id')
  @Auth(AppRoles.estilista, AppRoles.negocio, AppRoles.admin)
  update(@Param('id', ParseUUIDPipe) id: string, @UserDecorator() user: User, @Body() dto: UpdateStylistDto) {
    return this.stylistsService.update(id, user, dto);
  }

  @Delete('estilistas/:id')
  @Auth(AppRoles.estilista, AppRoles.negocio, AppRoles.admin)
  remove(@Param('id', ParseUUIDPipe) id: string, @UserDecorator() user: User) {
    return this.stylistsService.remove(id, user);
  }

  @Post('estilistas/:id/solicitar-afiliacion')
  @Auth(AppRoles.estilista, AppRoles.admin)
  solicitarAfiliacion(
    @Param('id', ParseUUIDPipe) id: string,
    @UserDecorator() user: User,
    @Body('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.stylistsService.solicitarAfiliacion(id, user, businessId);
  }

  @Put('negocios/:businessId/estilistas/:estilistaId/afiliar')
  @Auth(AppRoles.negocio, AppRoles.admin)
  afiliarEstilista(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('estilistaId', ParseUUIDPipe) estilistaId: string,
    @UserDecorator() user: User,
  ) {
    return this.stylistsService.afiliarEstilista(businessId, estilistaId, user);
  }
}
