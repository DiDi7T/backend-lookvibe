import { Controller, Get, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginUserDto } from '../users/dto/login-user.dto.js';
import { CreateUserDto } from '../users/dto/create-user.dto.js';
import { Auth } from './decorators/auth.decorator.js';
import { AppRoles } from './interfaces/app-roles.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  registerUser(@Body() createUserDto: CreateUserDto) {
    return this.authService.registerUser(createUserDto);
  }

  @Post('login')
  loginUser(@Body() loginUserDto: LoginUserDto) {
    return this.authService.loginUser(loginUserDto);
  }

  @Get('status')
  @Auth(AppRoles.admin)
  checkAuthStatus() {
    return { ok: true, message: 'Autenticado y autorizado correctamente' };
  }
  
  @Post('logout')
  async logout(@Body('token') token: string) {
    return this.authService.logoutUser(token);
  }






}