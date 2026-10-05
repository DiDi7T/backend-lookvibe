import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}
  async create(createUserDto: CreateUserDto): Promise<User> {
    const { password, ...userData } = createUserDto;
    const existingUser = await this.findOne(userData.email);
    
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está en uso');
    }
    // Hasheamos la contraseña y la guardamos en passwordHash de la entidad 
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      ...userData,
      passwordHash: hashedPassword,
    });
    return this.userRepository.save(user);
  }
  findAll(): Promise<User[]> {
    return this.userRepository.find();
  }
  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return user;
  }
  async findOne(email: string): Promise<User | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .addSelect('user.passwordHash') 
      .getOne();
    return user;
  }
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const { password, ...toUpdate } = updateUserDto;
    const userToUpdate = await this.userRepository.preload({id,...toUpdate,});
    if (!userToUpdate) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    if (password) {
      userToUpdate.passwordHash = await bcrypt.hash(password, 10);
    }
    return this.userRepository.save(userToUpdate);
  }
  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.userRepository.remove(user);
  }

  



















}