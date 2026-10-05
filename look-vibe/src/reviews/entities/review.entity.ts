import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Business } from '../../businesses/entities/business.entity.js';
import { Stylist } from '../../stylists/entities/stylist.entity.js';
import { Appointment } from '../../appointments/entities/appointment.entity.js';

@Entity('reseñas')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @ManyToOne(() => Business, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'negocio_id' })
  negocio: Business | null;

  @ManyToOne(() => Stylist, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'estilista_id' })
  estilista: Stylist | null;

  @ManyToOne(() => Appointment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cita_id' })
  cita: Appointment;

  @Column({ type: 'int' })
  calificacion: number;

  @Column({ type: 'varchar', length: 1000 })
  comentario: string;

  @Column({ type: 'boolean', default: false })
  reportado: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
