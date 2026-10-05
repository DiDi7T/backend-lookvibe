import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity.js'; 
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    ) {super({secretOrKey: process.env.JWT_SECRET || 'JWT_SECRET_LOOKVIBE_SECRETO', 
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
    }
    async validate(payload: { user_id: string }): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: payload.user_id });
    if (!user) {
        throw new UnauthorizedException('Token no válido o usuario no encontrado');
    }
    return user; 
  }
}

