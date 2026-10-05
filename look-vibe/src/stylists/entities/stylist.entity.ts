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
import type { User } from '../../users/entities/user.entity.js';

@Entity('estilistas')
export class Stylist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Business', (business: Business) => business.estilistas, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'negocio_id' })
  negocio: Business | null;

  @ManyToOne('User', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User | null;

  @Column({ name: 'foto_url', type: 'varchar', length: 2048, nullable: true })
  fotoUrl: string | null;

  @Column({ type: 'varchar', length: 160 })
  especialidad: string;

  @Column({ name: 'estado_afiliacion', type: 'varchar', length: 30, default: 'INDEPENDIENTE' })
  estadoAfiliacion: string; // 'INDEPENDIENTE', 'PENDIENTE', 'AFILIADO'

  @ManyToOne('Business', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'negocio_solicitado_id' })
  negocioSolicitado: Business | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
