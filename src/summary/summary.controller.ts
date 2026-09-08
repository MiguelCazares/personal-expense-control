import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  JsonResponse,
  ResponseHelper,
} from '@miguelcazares/nestjs-response-helper';
import { SummaryService } from 'src/summary/summary.service';
import {
  CashflowQueryDto,
  MonthlySummaryQueryDto,
} from 'src/summary/dto/summary-query.dto';
import {
  CashflowPointDto,
  MonthlySummaryDto,
} from 'src/summary/dto/summary-response.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UserEntity } from 'src/auth/entities/user.entity';

@ApiTags('Summary')
@ApiBearerAuth('bearer')
@Controller('/api/summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get('monthly')
  @ApiOperation({
    summary: 'Ingresos, egresos, balance y desglose por categoría de un mes',
  })
  @ApiOkResponse({ type: MonthlySummaryDto })
  async monthly(
    // El usuario completo, no solo el id: el mes en curso depende de su zona.
    @CurrentUser() user: UserEntity,
    @Query() query: MonthlySummaryQueryDto,
  ): Promise<JsonResponse<MonthlySummaryDto>> {
    const result = await this.summaryService.monthly(
      user.id,
      user.timezone,
      query.period,
    );
    return ResponseHelper.jsendSuccess(result);
  }

  @Get('cashflow')
  @ApiOperation({ summary: 'Serie mensual de ingresos, egresos y balance' })
  @ApiOkResponse({ type: [CashflowPointDto] })
  async cashflow(
    @CurrentUser() user: UserEntity,
    @Query() query: CashflowQueryDto,
  ): Promise<JsonResponse<CashflowPointDto[]>> {
    const result = await this.summaryService.cashflow(
      user.id,
      user.timezone,
      query.months,
      query.until,
    );
    return ResponseHelper.jsendSuccess(result);
  }
}
