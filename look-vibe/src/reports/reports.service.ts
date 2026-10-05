import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import PDFDocument from 'pdfkit';
import { Repository } from 'typeorm';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { AppointmentSchedule } from '../appointments/entities/appointment-schedule.entity.js';
import { Business } from '../businesses/entities/business.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Review } from '../reviews/entities/review.entity.js';
import { ReportPeriodDto } from './dto/report-period.dto.js';

type PeriodRow = {
  periodo: string;
  total: string | number;
  pendientes: string | number;
  completadas: string | number;
  canceladas: string | number;
  no_realizadas: string | number;
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(AppointmentSchedule)
    private readonly scheduleRepository: Repository<AppointmentSchedule>,
  ) {}

  async getBusinessReport(
    businessId: string,
    actor: User,
    period: ReportPeriodDto = {},
  ) {
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
      relations: { owner: true },
    });
    if (!business)
      throw new NotFoundException(`Negocio con ID ${businessId} no encontrado`);
    if (
      !actor.roles.includes(AppRoles.admin) &&
      business.owner.id !== actor.id
    ) {
      throw new ForbiddenException(
        'No puedes consultar los reportes de este negocio',
      );
    }

    const { desde, hasta } = this.resolvePeriod(period);
    const schedule = await this.scheduleRepository.findOne({
      where: { tipoRecurso: 'negocio', recursoId: businessId },
      order: { diaSemana: 'ASC' },
    });
    const zonaHoraria = schedule?.zonaHoraria ?? 'America/Bogota';
    const query = this.businessAppointmentsQuery(
      businessId,
      desde,
      hasta,
      zonaHoraria,
    );
    const [semanal, mensual, resumen, topService, revenue, rating] =
      await Promise.all([
        this.periodAggregation(query.clone(), zonaHoraria, 'week'),
        this.periodAggregation(query.clone(), zonaHoraria, 'month'),
        query
          .clone()
          .select('COUNT(*)', 'total')
          .addSelect(
            "COUNT(*) FILTER (WHERE appointment.estado = 'pendiente')",
            'pendientes',
          )
          .addSelect(
            "COUNT(*) FILTER (WHERE appointment.estado IN ('completada', 'completado'))",
            'completadas',
          )
          .addSelect(
            "COUNT(*) FILTER (WHERE appointment.estado = 'cancelada')",
            'canceladas',
          )
          .addSelect(
            "COUNT(*) FILTER (WHERE appointment.estado IN ('no_realizada', 'no realizado'))",
            'no_realizadas',
          )
          .getRawOne(),
        query
          .clone()
          .select('service.id', 'servicioId')
          .addSelect('service.nombre', 'nombre')
          .addSelect('COUNT(*)', 'cantidad')
          .andWhere(
            "appointment.estado NOT IN ('cancelada', 'no_realizada', 'no realizado')",
          )
          .groupBy('service.id')
          .addGroupBy('service.nombre')
          .orderBy('COUNT(*)', 'DESC')
          .addOrderBy('service.nombre', 'ASC')
          .limit(1)
          .getRawOne(),
        query
          .clone()
          .select(
            "COALESCE(SUM(CASE WHEN appointment.estado IN ('pendiente', 'completada', 'completado') THEN COALESCE(appointment.precioTotal, service.precio) ELSE 0 END), 0)",
            'ingresosEstimados',
          )
          .getRawOne(),
        this.reviewRepository
          .createQueryBuilder('review')
          .select('AVG(review.calificacion)', 'promedio')
          .addSelect('COUNT(review.id)', 'cantidad')
          .where('review.negocio.id = :businessId', { businessId })
          .andWhere('review.reportado = false')
          .getRawOne(),
      ]);

    return {
      negocio: { id: business.id, nombre: business.nombre },
      periodo: { desde, hasta, zonaHoraria },
      citas: {
        total: this.number(resumen?.total),
        pendientes: this.number(resumen?.pendientes),
        completadas: this.number(resumen?.completadas),
        canceladas: this.number(resumen?.canceladas),
        noRealizadas: this.number(resumen?.no_realizadas),
        semanal,
        mensual,
      },
      servicioMasSolicitado: topService
        ? {
            id: topService.servicioId,
            nombre: topService.nombre,
            cantidad: this.number(topService.cantidad),
          }
        : null,
      ingresosEstimados: this.number(revenue?.ingresosEstimados),
      calificacionPromedio:
        rating?.promedio === null || rating?.promedio === undefined
          ? null
          : Number(rating.promedio),
      cantidadResenas: this.number(rating?.cantidad),
    };
  }

  async getUsageReport(actor: User) {
    if (!actor.roles.includes(AppRoles.admin))
      throw new ForbiddenException(
        'Solo admin puede consultar el reporte global',
      );
    const [usuarios, negocios, negociosActivos, citas, resenas, monthlyUsage] =
      await Promise.all([
        this.userRepository.count(),
        this.businessRepository.count(),
        this.businessRepository.count({ where: { estado: 'ACTIVO' as never } }),
        this.appointmentRepository.count(),
        this.reviewRepository.count(),
        this.appointmentRepository.query(
          `SELECT to_char(date_trunc('month', fecha_hora), 'YYYY-MM') AS periodo, COUNT(*)::int AS citas
         FROM citas
         WHERE fecha_hora >= NOW() - INTERVAL '12 months'
         GROUP BY date_trunc('month', fecha_hora)
         ORDER BY date_trunc('month', fecha_hora)`,
        ),
      ]);
    return {
      generadoEn: new Date().toISOString(),
      usuarios,
      negocios,
      negociosActivos,
      citas,
      resenas,
      citasPorMes: monthlyUsage.map(
        (row: { periodo: string; citas: string | number }) => ({
          periodo: row.periodo,
          citas: this.number(row.citas),
        }),
      ),
    };
  }

  async getUserAppointmentHistory(userId: string, actor: User) {
    if (actor.id !== userId && !actor.roles.includes(AppRoles.admin)) {
      throw new ForbiddenException('Solo puedes consultar tu propio historial de citas');
    }

    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);

    const appointments = await this.appointmentRepository.find({
      where: { usuario: { id: userId } },
      relations: { negocio: true, estilista: { negocio: true }, servicio: true },
      order: { fechaHora: 'DESC' },
    });
    const summary = {
      total: appointments.length,
      pendientes: 0,
      completadas: 0,
      canceladas: 0,
      noRealizadas: 0,
    };

    for (const appointment of appointments) {
      const status = appointment.estado?.toLowerCase();
      if (status === 'pendiente') summary.pendientes += 1;
      else if (status === 'completada' || status === 'completado') summary.completadas += 1;
      else if (status === 'cancelada') summary.canceladas += 1;
      else if (status === 'no_realizada' || status === 'no realizado') summary.noRealizadas += 1;
    }

    return {
      usuario: { id: user.id, nombre: user.nombre },
      resumen: summary,
      citas: appointments.map((appointment) => ({
        id: appointment.id,
        fechaHora: appointment.fechaHora,
        estado: appointment.estado,
        negocio: appointment.negocio
          ? { id: appointment.negocio.id, nombre: appointment.negocio.nombre }
          : appointment.estilista?.negocio
            ? { id: appointment.estilista.negocio.id, nombre: appointment.estilista.negocio.nombre }
            : null,
        estilista: appointment.estilista
          ? { id: appointment.estilista.id, especialidad: appointment.estilista.especialidad }
          : null,
        servicio: {
          id: appointment.servicio.id,
          nombre: appointment.servicio.nombre,
          duracionMin: appointment.duracionMin,
        },
        precioBase: appointment.precioBase,
        descuentoBienvenida: appointment.descuentoBienvenida,
        beneficioBienvenidaAplicado: appointment.beneficioBienvenidaAplicado,
        precioTotal: appointment.precioTotal,
        nota: appointment.nota,
      })),
    };
  }

  async createBusinessPdf(
    businessId: string,
    actor: User,
    period: ReportPeriodDto = {},
  ): Promise<Buffer> {
    const report = await this.getBusinessReport(businessId, actor, period);
    const document = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });

    document.fontSize(20).text(`Reporte de ${report.negocio.nombre}`);
    document
      .moveDown(0.5)
      .fontSize(10)
      .text(`Periodo: ${report.periodo.desde} a ${report.periodo.hasta}`);
    document.text(`Zona horaria: ${report.periodo.zonaHoraria}`);
    document.moveDown().fontSize(14).text('Resumen');
    document
      .fontSize(10)
      .text(`Citas: ${report.citas.total}`)
      .text(`Pendientes: ${report.citas.pendientes}`)
      .text(`Completadas: ${report.citas.completadas}`)
      .text(`Canceladas: ${report.citas.canceladas}`)
      .text(
        `Ingresos estimados: ${report.ingresosEstimados.toLocaleString('es-CO')}`,
      )
      .text(
        `Calificacion promedio: ${report.calificacionPromedio ?? 'Sin calificaciones'} (${report.cantidadResenas} resenas)`,
      )
      .text(
        `Servicio mas solicitado: ${report.servicioMasSolicitado?.nombre ?? 'Sin solicitudes'}`,
      );

    document.moveDown().fontSize(14).text('Citas por semana');
    document.fontSize(9);
    for (const row of report.citas.semanal)
      document.text(`${row.periodo}: ${row.total} citas`);
    document.moveDown().fontSize(14).text('Citas por mes');
    document.fontSize(9);
    for (const row of report.citas.mensual)
      document.text(`${row.periodo}: ${row.total} citas`);
    document.end();
    return completed;
  }

  private businessAppointmentsQuery(
    businessId: string,
    desde: string,
    hasta: string,
    zonaHoraria: string,
  ) {
    return this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoin('appointment.negocio', 'business')
      .leftJoin('appointment.estilista', 'stylist')
      .leftJoin('stylist.negocio', 'stylistBusiness')
      .leftJoin('appointment.servicio', 'service')
      .where(
        '(business.id = :businessId OR stylistBusiness.id = :businessId)',
        { businessId },
      )
      .andWhere(
        '((appointment.fechaHora AT TIME ZONE :zonaHoraria)::date >= :desde)',
        { zonaHoraria, desde },
      )
      .andWhere(
        '((appointment.fechaHora AT TIME ZONE :zonaHoraria)::date <= :hasta)',
        { zonaHoraria, hasta },
      );
  }

  private async periodAggregation(
    query: ReturnType<Repository<Appointment>['createQueryBuilder']>,
    zonaHoraria: string,
    unit: 'week' | 'month',
  ) {
    const truncation = `date_trunc('${unit}', appointment.fechaHora AT TIME ZONE :zonaHoraria)`;
    const rows = await query
      .select(`to_char(${truncation}, 'YYYY-MM-DD')`, 'periodo')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        "COUNT(*) FILTER (WHERE appointment.estado = 'pendiente')",
        'pendientes',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE appointment.estado IN ('completada', 'completado'))",
        'completadas',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE appointment.estado = 'cancelada')",
        'canceladas',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE appointment.estado IN ('no_realizada', 'no realizado'))",
        'no_realizadas',
      )
      .setParameter('zonaHoraria', zonaHoraria)
      .groupBy(truncation)
      .orderBy(truncation, 'ASC')
      .getRawMany<PeriodRow>();
    return rows.map((row) => ({
      periodo: row.periodo,
      total: this.number(row.total),
      pendientes: this.number(row.pendientes),
      completadas: this.number(row.completadas),
      canceladas: this.number(row.canceladas),
      noRealizadas: this.number(row.no_realizadas),
    }));
  }

  private resolvePeriod(period: ReportPeriodDto) {
    const hasta = period.hasta ?? new Date().toISOString().slice(0, 10);
    const end = new Date(`${hasta}T00:00:00.000Z`);
    if (
      Number.isNaN(end.getTime()) ||
      end.toISOString().slice(0, 10) !== hasta
    ) {
      throw new BadRequestException(
        'hasta debe ser una fecha válida con formato YYYY-MM-DD',
      );
    }
    const defaultStart = new Date(end);
    defaultStart.setUTCFullYear(defaultStart.getUTCFullYear() - 1);
    const desde = period.desde ?? defaultStart.toISOString().slice(0, 10);
    const start = new Date(`${desde}T00:00:00.000Z`);
    if (
      Number.isNaN(start.getTime()) ||
      start.toISOString().slice(0, 10) !== desde ||
      desde > hasta
    ) {
      throw new BadRequestException(
        'desde debe ser una fecha válida anterior o igual a hasta',
      );
    }
    return { desde, hasta };
  }

  private number(value: string | number | null | undefined): number {
    return value === null || value === undefined ? 0 : Number(value);
  }
}
