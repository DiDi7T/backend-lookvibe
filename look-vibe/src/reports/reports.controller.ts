import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator.js';
import { UserDecorator } from '../auth/decorators/user/user.decorator.js';
import { AppRoles } from '../auth/interfaces/app-roles.js';
import { User } from '../users/entities/user.entity.js';
import { ReportPeriodDto } from './dto/report-period.dto.js';
import { ReportsService } from './reports.service.js';

@Controller('reportes')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('negocio/:id')
  @Auth(AppRoles.negocio, AppRoles.admin)
  getBusinessReport(
    @Param('id', ParseUUIDPipe) id: string,
    @UserDecorator() actor: User,
    @Query() period: ReportPeriodDto,
  ) {
    return this.reportsService.getBusinessReport(id, actor, period);
  }

  @Get('negocio/:id/pdf')
  @Auth(AppRoles.negocio, AppRoles.admin)
  async getBusinessPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @UserDecorator() actor: User,
    @Query() period: ReportPeriodDto,
  ) {
    const pdf = await this.reportsService.createBusinessPdf(id, actor, period);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="reporte-negocio-${id}.pdf"`,
      length: pdf.length,
    });
  }

  @Get('uso')
  @Auth(AppRoles.admin)
  getUsageReport(@UserDecorator() actor: User) {
    return this.reportsService.getUsageReport(actor);
  }

  @Get('usuario/:id/citas')
  @Auth(AppRoles.cliente, AppRoles.user, AppRoles.admin)
  getUserAppointmentHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @UserDecorator() actor: User,
  ) {
    return this.reportsService.getUserAppointmentHistory(id, actor);
  }
}
