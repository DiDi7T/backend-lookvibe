import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator.js';
import { UserDecorator } from '../auth/decorators/user/user.decorator.js';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { User } from '../users/entities/user.entity.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ReviewsService } from './reviews.service.js';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('rese%C3%B1as')
  @Auth(AppRoles.cliente, AppRoles.user, AppRoles.admin)
  create(@UserDecorator() user: User, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user, dto);
  }

  @Get('negocios/:id/rese%C3%B1as')
  findByBusiness(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.findByBusiness(id);
  }

  @Get('estilistas/:id/rese%C3%B1as')
  findByStylist(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.findByStylist(id);
  }

  @Delete('rese%C3%B1as/:id')
  @Auth(AppRoles.admin)
  remove(@Param('id', ParseUUIDPipe) id: string, @UserDecorator() user: User) {
    return this.reviewsService.remove(id, user);
  }

  @Patch('rese%C3%B1as/:id/reportar')
  @Auth(AppRoles.negocio, AppRoles.estilista, AppRoles.admin)
  report(@Param('id', ParseUUIDPipe) id: string, @UserDecorator() user: User) {
    return this.reviewsService.report(id, user);
  }
}
