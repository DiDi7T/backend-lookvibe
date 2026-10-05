import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('horarios_citas')
@Index(['tipoRecurso', 'recursoId', 'diaSemana'])
export class AppointmentSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, name: 'tipo_recurso' })
  tipoRecurso: 'negocio' | 'estilista';

  @Column({ type: 'uuid', name: 'recurso_id' })
  recursoId: string;

  @Column({ type: 'smallint', name: 'dia_semana' })
  diaSemana: number;

  @Column({ type: 'time', name: 'hora_inicio' })
  horaInicio: string;

  @Column({ type: 'time', name: 'hora_fin' })
  horaFin: string;

  @Column({ type: 'varchar', length: 64, default: 'America/Bogota', name: 'zona_horaria' })
  zonaHoraria: string;
}