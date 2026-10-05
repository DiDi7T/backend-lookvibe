import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Business } from '../../businesses/entities/business.entity.js';

@Entity('servicios')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Business', (business: Business) => business.servicios, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'negocio_id' })
  negocio: Business;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  precio: number;

  @Column({ name: 'duracion_min', type: 'int' })
  duracionMin: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
