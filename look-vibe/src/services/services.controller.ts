import { Controller, Get, Post, Body, Patch, Put, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator.js';
import { UserDecorator } from '../auth/decorators/user/user.decorator.js';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { User } from '../users/entities/user.entity.js';
import { ServicesService } from './services.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';

@Controller('negocios/:businessId/servicios')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @Auth(AppRoles.negocio, AppRoles.admin)
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @UserDecorator() user: User,
    @Body() createServiceDto: CreateServiceDto,
  ) {
    return this.servicesService.create(businessId, user, createServiceDto);
  }

  @Get()
  findAll(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.servicesService.findAll(businessId);
  }

  @Get('gestion')
  @Auth(AppRoles.negocio, AppRoles.admin)
  findAllManaged(@Param('businessId', ParseUUIDPipe) businessId: string, @UserDecorator() user: User) {
    return this.servicesService.findAllManaged(businessId, user);
  }

  @Get(':id')
  findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.servicesService.findPublic(businessId, id);
  }

  @Patch(':id')
  @Auth(AppRoles.negocio, AppRoles.admin)
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UserDecorator() user: User,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.servicesService.update(businessId, id, user, updateServiceDto);
  }

  @Put(':id')
  @Auth(AppRoles.negocio, AppRoles.admin)
  updatePut(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UserDecorator() user: User,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.servicesService.update(businessId, id, user, updateServiceDto);
  }

  @Delete(':id')
  @Auth(AppRoles.negocio, AppRoles.admin)
  remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UserDecorator() user: User,
  ) {
    return this.servicesService.remove(businessId, id, user);
  }
}
