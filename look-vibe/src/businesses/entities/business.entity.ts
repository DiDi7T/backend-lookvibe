import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from '../../users/entities/user.entity.js';
import type { Service } from '../../services/entities/service.entity.js';
import type { Stylist } from '../../stylists/entities/stylist.entity.js';
import { BusinessStatus } from './business-status.enum.js';

@Entity('business')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('User', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  direccion: string | null;

  @Column({ type: 'double precision', nullable: true })
  latitud: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitud: number | null;

  @Column({ name: 'google_place_id', type: 'varchar', length: 255, nullable: true })
  googlePlaceId: string | null;

  @Column({ type: 'enum', enum: BusinessStatus, default: BusinessStatus.EN_CONFIGURACION })
  estado: BusinessStatus;

  @OneToMany('Stylist', (stylist: Stylist) => stylist.negocio)
  estilistas: Stylist[];

  @OneToMany('Service', (service: Service) => service.negocio)
  servicios: Service[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
