import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { AppRoles } from '../../auth/interfaces/app-roles.js';
@Entity('usuarios')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ type: 'varchar', length: 100 })
    nombre: string;
    @Column({ type: 'varchar', unique: true })
    email: string;
    @Column({ type: 'varchar', select: false })
    passwordHash: string;

    @Column('varchar', { array: true, default: [AppRoles.user] })
    roles: AppRoles[];
    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt: Date;
}
