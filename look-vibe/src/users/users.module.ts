import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { User } from './entities/user.entity.js'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), 
  ],
  controllers: [UsersController],
  providers: [UserService],
  exports: [UserService], 
})
export class UsersModule {}