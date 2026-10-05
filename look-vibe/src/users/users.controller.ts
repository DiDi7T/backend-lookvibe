import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { UserService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard.js';
import { RoleProtected } from '../auth/decorators/role-protected.decorator.js';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }
  @Get()
  findAll() {
    return this.userService.findAll();
  }
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findById(id); 
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.remove(id);
  }

  @Get(':id/role')
  @UseGuards(AuthGuard('jwt'), UserRoleGuard)
  @RoleProtected(AppRoles.admin)
  async findUserRole(@Param('id') id: string){
    const user = await this.userService.findById(id);
    return { roles: user.roles };
    }


}