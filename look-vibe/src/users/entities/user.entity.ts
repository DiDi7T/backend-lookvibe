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
    //Momentaniamente desactive el select false para debugear el login y pues no podia ver bien que estaba pasando
    @Column({ type: 'varchar'})
    passwordHash: string;

    @Column('varchar', { array: true, default: [AppRoles.user] })
    roles: AppRoles[];
    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt: Date;
}