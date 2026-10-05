import { IsEmail, IsArray, IsOptional, IsString, MinLength, IsEnum } from 'class-validator';
import { AppRoles } from '../../auth/interfaces/app-roles.js';

export class CreateUserDto {
    @IsString()
    nombre: string;

    @IsEmail({}, { message: 'El correo electrónico no es válido' })
    email: string;

    @IsString()
    @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
    password: string;

    @IsArray()
    @IsOptional()
    @IsEnum(AppRoles, { each: true, message: 'Rol no válido' })
    roles?: AppRoles[];
}