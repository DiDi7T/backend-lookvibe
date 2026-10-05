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
import { Service } from '../../services/entities/service.entity.js';

@Entity('citas')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @ManyToOne(() => Business, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'negocio_id' })
  negocio: Business | null;

  @ManyToOne(() => Stylist, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'estilista_id' })
  estilista: Stylist | null;

  @ManyToOne(() => Service, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'servicio_id' })
  servicio: Service;

  @Column({ type: 'timestamptz', name: 'fecha_hora' })
  fechaHora: Date;

  @Column({ type: 'int', default: 60, name: 'duracion_min' })
  duracionMin: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true, name: 'precio_base' })
  precioBase: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, name: 'descuento_bienvenida' })
  descuentoBienvenida: number;

  @Column({ type: 'boolean', default: false, name: 'beneficio_bienvenida_aplicado' })
  beneficioBienvenidaAplicado: boolean;

  @Column({ type: 'numeric', precision: 10, scale: 2, name: 'precio_total', nullable: true })
  precioTotal: number | null;

  @Column({ type: 'varchar', length: 50, default: 'pendiente' })
  estado: string; // 'pendiente', 'completada', 'cancelada', 'no_realizada'

  @Column({ type: 'varchar', length: 500, nullable: true })
  nota: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
