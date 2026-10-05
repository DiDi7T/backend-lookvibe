import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity.js';
import { Stylist } from '../../stylists/entities/stylist.entity.js';

@Entity('portafolio')
export class PortfolioItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'negocio_id' })
  negocio: Business | null;

  @ManyToOne(() => Stylist, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'estilista_id' })
  estilista: Stylist | null;

  @Column({ name: 'foto_url', type: 'varchar', length: 2048 })
  fotoUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
