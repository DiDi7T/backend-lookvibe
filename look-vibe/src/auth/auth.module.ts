import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { RevokedToken } from './entities/revoked-token.entity.js';
import { User } from '../users/entities/user.entity.js'; 
import { UsersModule } from '../users/users.module.js'; 


@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, RevokedToken]), 
    UsersModule, 
    
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Configuración del JWT Module de manera asíncrona (leyendo variables de entorno)
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get('JWT_SECRET') || 'JWT_SECRET_LOOKVIBE_SECRETO',
          signOptions: { expiresIn: '2h' }, // El token expira en 2 horas, un monton pero x es para probar mientras, si algo luego se baja
        };
      },
    }),
  ],
  exports: [JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}