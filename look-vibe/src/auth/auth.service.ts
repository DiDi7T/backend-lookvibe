import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt'; 
import { RevokedToken } from './entities/revoked-token.entity.js';
import { UserService } from '../users/users.service.js';
import { LoginUserDto } from '../users/dto/login-user.dto.js'; 
import { CreateUserDto } from '../users/dto/create-user.dto.js'; 
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm/browser/repository/Repository.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService, 
    private readonly jwtService: JwtService,
    @InjectRepository(RevokedToken)
    private readonly revokedTokenRepository: Repository<RevokedToken>,
  ){}
  async registerUser(createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    const { passwordHash, ...userRest } = user as any;
    return {
      ...userRest,
      token: this.jwtService.sign({ user_id: user.id }),
    };
  }
  async loginUser(loginUserDto: LoginUserDto) {
    try {
      const { password, email } = loginUserDto;
      const user = await this.userService.findOne(email);
      if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        throw new UnauthorizedException('Invalid Credentials');
      }
      return {
        user_id: user.id,
        email: user.email, 
        roles: user.roles,
        token: this.jwtService.sign({ user_id: user.id }),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw error;
    }
  }

  async logoutUser(token: string) {
    const existingToken =
      await this.revokedTokenRepository.findOneBy({
        token,
      });

    if (!existingToken) {
      await this.revokedTokenRepository.save({
        token,
      });
    }

    return {
      message: 'User logged out successfully',
    };
  }

  async isTokenRevoked(token: string): Promise<boolean> {
    const revokedToken =
      await this.revokedTokenRepository.findOneBy({
        token,
      });

    return !!revokedToken;
  }
}