import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator.js';
import { UserDecorator } from '../auth/decorators/user/user.decorator.js';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { User } from '../users/entities/user.entity.js';
import { CreatePortfolioDto } from './dto/create-portfolio.dto.js';
import { PortfolioService } from './portfolio.service.js';

@Controller()
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Post('negocios/:id/portafolio')
  @Auth(AppRoles.negocio, AppRoles.admin)
  addForBusiness(
    @Param('id', ParseUUIDPipe) id: string,
    @UserDecorator() user: User,
    @Body() dto: CreatePortfolioDto,
  ) {
    return this.portfolioService.addForBusiness(id, user, dto);
  }

  @Get('negocios/:id/portafolio')
  findByBusiness(@Param('id', ParseUUIDPipe) id: string) {
    return this.portfolioService.findByBusiness(id);
  }

  @Post('estilistas/:id/portafolio')
  @Auth(AppRoles.estilista, AppRoles.negocio, AppRoles.admin)
  addForStylist(
    @Param('id', ParseUUIDPipe) id: string,
    @UserDecorator() user: User,
    @Body() dto: CreatePortfolioDto,
  ) {
    return this.portfolioService.addForStylist(id, user, dto);
  }

  @Get('estilistas/:id/portafolio')
  findByStylist(@Param('id', ParseUUIDPipe) id: string) {
    return this.portfolioService.findByStylist(id);
  }
}
