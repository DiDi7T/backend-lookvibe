import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { Business } from '../businesses/entities/business.entity.js';
import { BusinessStatus } from '../businesses/entities/business-status.enum.js';
import { Service } from '../services/entities/service.entity.js';
import { Stylist } from '../stylists/entities/stylist.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { UpdateAppointmentDto } from './dto/update-appointment.dto.js';
import { Appointment } from './entities/appointment.entity.js';
import { AppointmentSchedule } from './entities/appointment-schedule.entity.js';
import { SetScheduleDto } from './dto/set-schedule.dto.js';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Stylist)
    private readonly stylistRepository: Repository<Stylist>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AppointmentSchedule)
    private readonly scheduleRepository: Repository<AppointmentSchedule>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateAppointmentDto) {
    const { usuario, negocio, estilista, servicio } = await this.resolveContext(dto);
    const fechaHora = new Date(dto.fechaHora);
    if (Number.isNaN(fechaHora.getTime())) {
      throw new BadRequestException('La fecha y hora de la cita no es válida.');
    }
    const durationMinutes = servicio.duracionMin ?? 60;
    const assignedBusiness = negocio ?? estilista?.negocio ?? null;

    return this.dataSource.transaction(async (manager) => {
      const resources: Array<{ tipo: 'negocio' | 'estilista'; id: string }> = [];
      if (assignedBusiness) resources.push({ tipo: 'negocio', id: assignedBusiness.id });
      if (estilista) resources.push({ tipo: 'estilista', id: estilista.id });
      await this.lockResources(manager, resources);

      const withinSchedule = await this.fitsSchedule(manager, assignedBusiness, estilista, fechaHora, durationMinutes);
      if (!withinSchedule) {
        throw new ConflictException('La hora seleccionada está fuera del horario disponible.');
      }

      const overlap = await this.findOverlap(manager, {
        negocioId: assignedBusiness?.id,
        estilistaId: estilista?.id,
        startDate: fechaHora,
        durationMinutes,
      });
      if (overlap.length > 0) {
        throw new ConflictException('La fecha seleccionada ya no está disponible para ese negocio o estilista.');
      }

      const pricing = await this.calculateAppointmentPrice(manager, usuario.id, assignedBusiness, estilista, servicio.precio);
      const appointmentRepository = manager.getRepository(Appointment);
      const appointment = appointmentRepository.create({
        usuario,
        negocio: assignedBusiness,
        estilista: estilista ?? null,
        servicio,
        fechaHora,
        duracionMin: durationMinutes,
        precioBase: pricing.precioBase,
        descuentoBienvenida: pricing.descuentoBienvenida,
        beneficioBienvenidaAplicado: pricing.aplicado,
        precioTotal: pricing.precioTotal,
        estado: 'pendiente',
        nota: dto.nota ?? null,
      });
      return appointmentRepository.save(appointment);
    });
  }

  async findAll() {
    return this.appointmentRepository.find({
      relations: {
        usuario: true,
        negocio: true,
        estilista: true,
        servicio: true,
      },
      order: { fechaHora: 'ASC' },
    });
  }

  async findOne(id: string) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: {
        usuario: true,
        negocio: true,
        estilista: true,
        servicio: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Cita con ID ${id} no encontrada`);
    }

    return appointment;
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    return this.dataSource.transaction(async (manager) => {
      const appointmentRepository = manager.getRepository(Appointment);
      const appointment = await appointmentRepository.findOne({
        where: { id },
        relations: { usuario: true, negocio: true, estilista: { negocio: true }, servicio: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!appointment) throw new NotFoundException(`Cita con ID ${id} no encontrada`);

      const fechaHora = dto.fechaHora ? new Date(dto.fechaHora) : appointment.fechaHora;
      if (dto.fechaHora && Number.isNaN(fechaHora.getTime())) {
        throw new BadRequestException('La nueva fecha y hora no es válida.');
      }

      const rescheduling = Boolean(dto.negocioId || dto.estilistaId || dto.servicioId || dto.fechaHora);
      if (rescheduling) {
        const stylistId = dto.estilistaId ?? (dto.negocioId ? undefined : appointment.estilista?.id);
        const businessId = dto.estilistaId
          ? undefined
          : dto.negocioId ?? (appointment.estilista ? undefined : this.appointmentBusinessId(appointment));
        const { negocio, estilista, servicio } = await this.resolveContext({
          usuarioId: appointment.usuario.id,
          negocioId: businessId,
          estilistaId: stylistId,
          servicioId: dto.servicioId ?? appointment.servicio.id,
          fechaHora: dto.fechaHora ?? appointment.fechaHora.toISOString(),
        });
        const assignedBusiness = negocio ?? estilista?.negocio ?? null;
        const resources: Array<{ tipo: 'negocio' | 'estilista'; id: string }> = [];
        const existingBusinessId = this.appointmentBusinessId(appointment);
        if (existingBusinessId) resources.push({ tipo: 'negocio', id: existingBusinessId });
        if (appointment.estilista) resources.push({ tipo: 'estilista', id: appointment.estilista.id });
        if (assignedBusiness) resources.push({ tipo: 'negocio', id: assignedBusiness.id });
        if (estilista) resources.push({ tipo: 'estilista', id: estilista.id });
        await this.lockResources(manager, resources);

        const durationMinutes = servicio.duracionMin ?? 60;
        if (!(await this.fitsSchedule(manager, assignedBusiness, estilista, fechaHora, durationMinutes))) {
          throw new ConflictException('La hora seleccionada está fuera del horario disponible.');
        }
        const overlap = await this.findOverlap(manager, {
          negocioId: assignedBusiness?.id,
          estilistaId: estilista?.id,
          startDate: fechaHora,
          durationMinutes,
          excludeAppointmentId: id,
        });
        if (overlap.length) throw new ConflictException('La fecha seleccionada ya no está disponible para ese negocio o estilista.');

        const pricing = await this.calculateAppointmentPrice(
          manager,
          appointment.usuario.id,
          assignedBusiness,
          estilista,
          servicio.precio,
          appointment.id,
        );
        appointment.negocio = assignedBusiness;
        appointment.estilista = estilista ?? null;
        appointment.servicio = servicio;
        appointment.fechaHora = fechaHora;
        appointment.duracionMin = durationMinutes;
        appointment.precioBase = pricing.precioBase;
        appointment.descuentoBienvenida = pricing.descuentoBienvenida;
        appointment.beneficioBienvenidaAplicado = pricing.aplicado;
        appointment.precioTotal = pricing.precioTotal;
      }

      if (dto.nota !== undefined) appointment.nota = dto.nota ?? null;
      if (dto.motivoCancelacion) appointment.estado = 'cancelada';
      return appointmentRepository.save(appointment);
    });
  }

  async remove(id: string, motivo?: string) {
    const appointment = await this.findOne(id);
    appointment.estado = 'cancelada';
    if (motivo) {
      appointment.nota = motivo;
    }

    await this.appointmentRepository.save(appointment);
    return { message: 'Cita cancelada exitosamente', id: appointment.id };
  }

  async markCompleted(id: string, completed = true) {
    const appointment = await this.findOne(id);
    appointment.estado = completed ? 'completada' : 'no_realizada';
    return this.appointmentRepository.save(appointment);
  }

  async setBusinessSchedule(businessId: string, actor: User, dto: SetScheduleDto) {
    const business = await this.businessRepository.findOne({ where: { id: businessId }, relations: { owner: true } });
    if (!business) throw new NotFoundException(`Negocio con ID ${businessId} no encontrado`);
    if (!actor.roles.includes(AppRoles.admin) && business.owner.id !== actor.id) {
      throw new ForbiddenException('No puedes administrar este negocio');
    }
    return this.replaceSchedule('negocio', businessId, dto);
  }

  async setStylistSchedule(stylistId: string, actor: User, dto: SetScheduleDto) {
    const stylist = await this.stylistRepository.findOne({
      where: { id: stylistId },
      relations: { usuario: true, negocio: { owner: true } },
    });
    if (!stylist) throw new NotFoundException(`Estilista con ID ${stylistId} no encontrado`);
    const isOwner = stylist.usuario?.id === actor.id || stylist.negocio?.owner?.id === actor.id;
    if (!actor.roles.includes(AppRoles.admin) && !isOwner) {
      throw new ForbiddenException('No puedes administrar este horario');
    }
    return this.replaceSchedule('estilista', stylistId, dto);
  }

  async getBusinessAvailability(businessId: string, fecha?: string, duracionMin?: string, pasoMin?: string) {
    const business = await this.businessRepository.findOne({
      where: { id: businessId, estado: BusinessStatus.ACTIVO },
    });
    if (!business) throw new NotFoundException(`Negocio con ID ${businessId} no encontrado`);
    const date = this.parseDate(fecha);
    const duration = this.parsePositiveMinutes(duracionMin, 60, 'duracionMin');
    const step = this.parsePositiveMinutes(pasoMin, 30, 'pasoMin');
    const windows = await this.getWindows('negocio', businessId, date);
    const appointments = await this.appointmentRepository.find({
      where: [
        { negocio: { id: businessId }, estado: In(['pendiente', 'completada', 'no_realizada']) },
        { estilista: { negocio: { id: businessId } }, estado: In(['pendiente', 'completada', 'no_realizada']) },
      ],
      relations: { negocio: true, estilista: { negocio: true } },
    });
    const slots = this.makeSlots(windows, appointments, duration, step, (appointment) => this.appointmentBusinessId(appointment) === businessId);
    return { businessId, fecha: date, zonaHoraria: windows[0]?.zonaHoraria ?? 'America/Bogota', ocupadas: slots.filter((slot) => !slot.disponible).length, slots };
  }

  async getStylistAvailability(stylistId: string, fecha?: string, duracionMin?: string, pasoMin?: string) {
    const stylist = await this.stylistRepository.findOne({ where: { id: stylistId }, relations: { negocio: true } });
    if (!stylist) throw new NotFoundException(`Estilista con ID ${stylistId} no encontrado`);
    const date = this.parseDate(fecha);
    const duration = this.parsePositiveMinutes(duracionMin, 60, 'duracionMin');
    const step = this.parsePositiveMinutes(pasoMin, 30, 'pasoMin');
    const stylistWindows = await this.getWindows('estilista', stylistId, date);
    let windows = stylistWindows;
    if (stylist.negocio) {
      const configuredStylistHours = await this.scheduleRepository.count({
        where: { tipoRecurso: 'estilista', recursoId: stylistId },
      });
      const businessWindows = await this.getWindows('negocio', stylist.negocio.id, date);
      windows = configuredStylistHours === 0 ? businessWindows : this.intersectWindows(businessWindows, stylistWindows);
    }
    const appointments = await this.appointmentRepository.find({
      where: stylist.negocio
        ? [
            { estilista: { id: stylistId }, estado: In(['pendiente', 'completada', 'no_realizada']) },
            { negocio: { id: stylist.negocio.id }, estado: In(['pendiente', 'completada', 'no_realizada']) },
          ]
        : { estilista: { id: stylistId }, estado: In(['pendiente', 'completada', 'no_realizada']) },
      relations: { negocio: true, estilista: { negocio: true } },
    });
    const slots = this.makeSlots(windows, appointments, duration, step, (appointment) =>
      appointment.estilista?.id === stylistId ||
      (this.appointmentBusinessId(appointment) === stylist.negocio?.id && !appointment.estilista),
    );
    return { stylistId, fecha: date, zonaHoraria: windows[0]?.zonaHoraria ?? 'America/Bogota', ocupadas: slots.filter((slot) => !slot.disponible).length, slots };
  }

  private async replaceSchedule(tipoRecurso: 'negocio' | 'estilista', recursoId: string, dto: SetScheduleDto) {
    const zonaHoraria = dto.zonaHoraria ?? 'America/Bogota';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zonaHoraria });
    } catch {
      throw new BadRequestException('zonaHoraria debe ser una zona IANA válida');
    }

    const intervalsByDay = new Map<number, Array<{ horaInicio: string; horaFin: string }>>();
    for (const interval of dto.horarios) {
      if (interval.horaInicio >= interval.horaFin) {
        throw new BadRequestException('Cada intervalo debe terminar después de iniciar y dentro del mismo día');
      }
      const intervals = intervalsByDay.get(interval.diaSemana) ?? [];
      intervals.push(interval);
      intervalsByDay.set(interval.diaSemana, intervals);
    }
    for (const intervals of intervalsByDay.values()) {
      intervals.sort((left, right) => left.horaInicio.localeCompare(right.horaInicio));
      for (let index = 1; index < intervals.length; index += 1) {
        if (intervals[index].horaInicio < intervals[index - 1].horaFin) {
          throw new BadRequestException('Los intervalos del mismo día no pueden solaparse');
        }
      }
    }

    return this.dataSource.transaction(async (manager) => {
      await this.lockResources(manager, [{ tipo: tipoRecurso, id: recursoId }]);
      const repository = manager.getRepository(AppointmentSchedule);
      await repository.delete({ tipoRecurso, recursoId });
      const schedules = dto.horarios.map((interval) => repository.create({
        tipoRecurso,
        recursoId,
        diaSemana: interval.diaSemana,
        horaInicio: interval.horaInicio,
        horaFin: interval.horaFin,
        zonaHoraria,
      }));
      if (schedules.length) await repository.save(schedules);
      return { tipoRecurso, recursoId, zonaHoraria, horarios: dto.horarios };
    });
  }

  private async lockResources(manager: EntityManager, resources: Array<{ tipo: 'negocio' | 'estilista'; id: string }>) {
    const keys = resources.map(({ tipo, id }) => `look-vibe:citas:${tipo}:${id}`).sort();
    for (const key of keys) {
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    }
  }

  private parseDate(fecha?: string): string {
    const date = fecha ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('fecha debe tener formato YYYY-MM-DD');
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('fecha no es válida');
    }
    return date;
  }

  private parsePositiveMinutes(value: string | undefined, defaultValue: number, field: string): number {
    if (value === undefined) return defaultValue;
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      throw new BadRequestException(`${field} debe ser un entero entre 1 y 1440`);
    }
    return minutes;
  }

  private async getWindows(tipoRecurso: 'negocio' | 'estilista', recursoId: string, date: string, manager?: EntityManager) {
    const dayOfWeek = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const repository = manager?.getRepository(AppointmentSchedule) ?? this.scheduleRepository;
    const schedules = await repository.find({ where: { tipoRecurso, recursoId, diaSemana: dayOfWeek } });
    return schedules.map((schedule) => ({
      inicio: this.localTimeToUtc(date, schedule.horaInicio, schedule.zonaHoraria),
      fin: this.localTimeToUtc(date, schedule.horaFin, schedule.zonaHoraria),
      zonaHoraria: schedule.zonaHoraria,
    }));
  }

  private async fitsSchedule(
    manager: EntityManager,
    business: Business | null,
    stylist: Stylist | null,
    start: Date,
    durationMinutes: number,
  ): Promise<boolean> {
    const repository = manager.getRepository(AppointmentSchedule);
    let windows: Array<{ inicio: Date; fin: Date; zonaHoraria: string }> = [];
    const businessSchedules = business
      ? await repository.find({ where: { tipoRecurso: 'negocio', recursoId: business.id } })
      : [];
    const stylistSchedules = stylist
      ? await repository.find({ where: { tipoRecurso: 'estilista', recursoId: stylist.id } })
      : [];

    if (business) {
      if (!businessSchedules.length) return false;
      const businessDate = this.localDate(start, businessSchedules[0].zonaHoraria);
      const businessWindows = await this.getWindows('negocio', business.id, businessDate, manager);
      if (stylist && stylistSchedules.length) {
        const stylistDate = this.localDate(start, stylistSchedules[0].zonaHoraria);
        const ownWindows = await this.getWindows('estilista', stylist.id, stylistDate, manager);
        windows = this.intersectWindows(businessWindows, ownWindows);
      } else {
        windows = businessWindows;
      }
    } else if (stylist) {
      if (!stylistSchedules.length) return false;
      const stylistDate = this.localDate(start, stylistSchedules[0].zonaHoraria);
      windows = await this.getWindows('estilista', stylist.id, stylistDate, manager);
    }

    const end = start.getTime() + durationMinutes * 60_000;
    return windows.some((window) => start.getTime() >= window.inicio.getTime() && end <= window.fin.getTime());
  }

  private localDate(date: Date, timeZone: string): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  private localTimeToUtc(date: string, time: string, timeZone: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.slice(0, 5).split(':').map(Number);
    const targetWallTime = Date.UTC(year, month - 1, day, hour, minute);
    let timestamp = targetWallTime;
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
      const representedWallTime = Date.UTC(
        Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute),
      );
      timestamp += targetWallTime - representedWallTime;
    }
    return new Date(timestamp);
  }

  private intersectWindows(
    businessWindows: Array<{ inicio: Date; fin: Date; zonaHoraria: string }>,
    stylistWindows: Array<{ inicio: Date; fin: Date; zonaHoraria: string }>,
  ) {
    const intersections: Array<{ inicio: Date; fin: Date; zonaHoraria: string }> = [];
    for (const business of businessWindows) {
      for (const stylist of stylistWindows) {
        const inicio = new Date(Math.max(business.inicio.getTime(), stylist.inicio.getTime()));
        const fin = new Date(Math.min(business.fin.getTime(), stylist.fin.getTime()));
        if (inicio < fin) intersections.push({ inicio, fin, zonaHoraria: business.zonaHoraria });
      }
    }
    return intersections;
  }

  private makeSlots(
    windows: Array<{ inicio: Date; fin: Date; zonaHoraria: string }>,
    appointments: Appointment[],
    durationMinutes: number,
    stepMinutes: number,
    isRelevant: (appointment: Appointment) => boolean,
  ) {
    const slots: Array<{ inicio: string; fin: string; disponible: boolean }> = [];
    const duration = durationMinutes * 60_000;
    const step = stepMinutes * 60_000;
    for (const window of windows) {
      for (let start = window.inicio.getTime(); start + duration <= window.fin.getTime(); start += step) {
        const end = start + duration;
        const disponible = !appointments.some((appointment) => {
          if (!isRelevant(appointment)) return false;
          const appointmentStart = new Date(appointment.fechaHora).getTime();
          const appointmentEnd = appointmentStart + (appointment.duracionMin ?? 60) * 60_000;
          return appointmentStart < end && appointmentEnd > start;
        });
        slots.push({ inicio: new Date(start).toISOString(), fin: new Date(end).toISOString(), disponible });
      }
    }
    return slots;
  }

  private appointmentBusinessId(appointment: Appointment): string | undefined {
    return appointment.negocio?.id ?? appointment.estilista?.negocio?.id;
  }

  private async calculateAppointmentPrice(
    manager: EntityManager,
    userId: string,
    business: Business | null,
    stylist: Stylist | null,
    servicePrice: string | number | null,
    excludeAppointmentId?: string,
  ) {
    const precioBase = Number(servicePrice) || 0;
    const priorVisit = await this.hasPriorVisit(manager, userId, business?.id, business ? undefined : stylist?.id, excludeAppointmentId);
    const aplicado = !priorVisit;
    const descuentoBienvenida = aplicado ? Math.round((precioBase * 0.1 + Number.EPSILON) * 100) / 100 : 0;
    return {
      precioBase,
      descuentoBienvenida,
      precioTotal: Math.round((precioBase - descuentoBienvenida + Number.EPSILON) * 100) / 100,
      aplicado,
    };
  }

  private async hasPriorVisit(
    manager: EntityManager,
    userId: string,
    businessId?: string,
    stylistId?: string,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    const where: FindOptionsWhere<Appointment>[] = [];
    if (businessId) {
      where.push(
        { usuario: { id: userId }, negocio: { id: businessId } },
        { usuario: { id: userId }, estilista: { negocio: { id: businessId } } },
      );
    } else if (stylistId) {
      where.push({ usuario: { id: userId }, estilista: { id: stylistId } });
    }
    if (!where.length) return false;

    const history = await manager.getRepository(Appointment).find({
      where,
      relations: { negocio: true, estilista: { negocio: true } },
    });
    return history.some((appointment) => {
      if (appointment.id === excludeAppointmentId) return false;
      return businessId
        ? this.appointmentBusinessId(appointment) === businessId
        : appointment.estilista?.id === stylistId;
    });
  }

  private async resolveContext(dto: {
    usuarioId: string;
    negocioId?: string | null;
    estilistaId?: string | null;
    servicioId: string;
    fechaHora?: string;
  }) {
    if (!dto.negocioId && !dto.estilistaId) {
      throw new BadRequestException('Debes seleccionar un negocio o un estilista para agendar la cita.');
    }

    if (dto.negocioId && dto.estilistaId) {
      throw new BadRequestException('Selecciona solo un negocio o un estilista, no ambos.');
    }

    const usuario = await this.userRepository.findOne({ where: { id: dto.usuarioId } });
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${dto.usuarioId} no encontrado`);
    }

    const servicio = await this.serviceRepository.findOne({
      where: { id: dto.servicioId },
      relations: { negocio: true },
    });
    if (!servicio) {
      throw new NotFoundException(`Servicio con ID ${dto.servicioId} no encontrado`);
    }

    const negocio = dto.negocioId
      ? await this.businessRepository.findOne({ where: { id: dto.negocioId } })
      : null;
    if (dto.negocioId && !negocio) {
      throw new NotFoundException(`Negocio con ID ${dto.negocioId} no encontrado`);
    }

    const estilista = dto.estilistaId
      ? await this.stylistRepository.findOne({ where: { id: dto.estilistaId }, relations: { negocio: true } })
      : null;
    if (dto.estilistaId && !estilista) {
      throw new NotFoundException(`Estilista con ID ${dto.estilistaId} no encontrado`);
    }

    if (negocio && servicio.negocio.id !== negocio.id) {
      throw new BadRequestException('El servicio no pertenece al negocio seleccionado.');
    }

    if (estilista && estilista.negocio && servicio.negocio.id !== estilista.negocio.id) {
      throw new BadRequestException('El servicio no pertenece al negocio del estilista seleccionado.');
    }

    return { usuario, negocio, estilista, servicio };
  }

  private async findOverlap(manager: EntityManager, params: {
    negocioId?: string;
    estilistaId?: string;
    startDate: Date;
    durationMinutes: number;
    excludeAppointmentId?: string;
  }) {
    const where = [];
    const blockingStates = In(['pendiente', 'completada', 'no_realizada']);
    if (params.negocioId) {
      where.push({ negocio: { id: params.negocioId }, estado: blockingStates });
      where.push({ estilista: { negocio: { id: params.negocioId } }, estado: blockingStates });
    }
    if (params.estilistaId) where.push({ estilista: { id: params.estilistaId }, estado: blockingStates });
    if (!where.length) return [];
    const pending = await manager.getRepository(Appointment).find({
      where,
      relations: {
        negocio: true,
        estilista: { negocio: true },
      },
    });

    const startEpoch = params.startDate.getTime();
    const endEpoch = startEpoch + params.durationMinutes * 60 * 1000;

    return pending.filter((appointment) => {
      if (params.excludeAppointmentId && appointment.id === params.excludeAppointmentId) return false;
      const appointmentDate = new Date(appointment.fechaHora);
      const appointmentStart = appointmentDate.getTime();
      const appointmentEnd = appointmentStart + (appointment.duracionMin ?? 60) * 60 * 1000;

      const sameBusiness = params.negocioId && this.appointmentBusinessId(appointment) === params.negocioId;
      const sameScope = params.estilistaId
        ? appointment.estilista?.id === params.estilistaId || (sameBusiness && !appointment.estilista)
        : sameBusiness;

      return sameScope && appointmentStart < endEpoch && appointmentEnd > startEpoch;
    });
  }
}
