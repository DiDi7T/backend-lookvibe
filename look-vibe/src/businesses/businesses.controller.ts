import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator.js';
import { UserDecorator } from '../auth/decorators/user/user.decorator.js';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { User } from '../users/entities/user.entity.js';
import { CreateBusinessDto } from './dto/create-business.dto.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';
import { BusinessesService } from './businesses.service.js';

@Controller('negocios')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  @Auth(AppRoles.negocio, AppRoles.admin)
  create(@UserDecorator() user: User, @Body() dto: CreateBusinessDto) {
    return this.businessesService.create(user, dto);
  }

  @Get('mios')
  @Auth(AppRoles.negocio, AppRoles.admin)
  findOwned(@UserDecorator('id') userId: string) {
    return this.businessesService.findOwned(userId);
  }

  @Get()
  findNearby(
    @Query('cerca_de') cercaDe?: string,
    @Query('servicio') service?: string,
    @Query('radioKm') radiusKm?: string,
  ) {
    const location = this.parseLocation(cercaDe);
    const parsedRadiusKm = radiusKm === undefined ? undefined : Number(radiusKm);
    if (parsedRadiusKm !== undefined && (!Number.isFinite(parsedRadiusKm) || parsedRadiusKm <= 0)) {
      throw new BadRequestException('radioKm debe ser un número mayor a cero');
    }
    return this.businessesService.findNearby({
      latitud: location?.latitud,
      longitud: location?.longitud,
      service,
      radiusKm: parsedRadiusKm,
    });
  }

  @Get(':id/disponibilidad')
  getAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('fecha') fecha?: string,
    @Query('duracionMin') duracionMin?: string,
    @Query('pasoMin') pasoMin?: string,
  ) {
    return this.businessesService.getAvailability(id, fecha, duracionMin, pasoMin);
  }

  @Get(':id')
  findPublic(@Param('id', ParseUUIDPipe) id: string) {
    return this.businessesService.findPublic(id);
  }

  @Patch(':id')
  @Auth(AppRoles.negocio, AppRoles.admin)
  update(@Param('id', ParseUUIDPipe) id: string, @UserDecorator() user: User, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.update(id, user, dto);
  }

  @Put(':id')
  @Auth(AppRoles.negocio, AppRoles.admin)
  updatePut(@Param('id', ParseUUIDPipe) id: string, @UserDecorator() user: User, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.update(id, user, dto);
  }

  private parseLocation(cercaDe?: string): { latitud: number; longitud: number } | undefined {
    if (!cercaDe) {
      return undefined;
    }
    const [latitudeText, longitudeText, extraValue] = cercaDe.split(',');
    const latitud = Number(latitudeText);
    const longitud = Number(longitudeText);
    if (
      extraValue !== undefined ||
      !Number.isFinite(latitud) ||
      !Number.isFinite(longitud) ||
      latitud < -90 ||
      latitud > 90 ||
      longitud < -180 ||
      longitud > 180
    ) {
      throw new BadRequestException('cerca_de debe tener el formato latitud,longitud');
    }
    return { latitud, longitud };
  }
}
