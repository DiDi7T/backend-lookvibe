import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginUserDto {
    @IsEmail({}, { message: 'El correo electrónico no es válido' })
    email: string;

    @IsString()
    @MinLength(6)
    password: string;
}