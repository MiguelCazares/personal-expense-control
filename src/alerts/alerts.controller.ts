import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  JsonResponse,
  ResponseHelper,
} from '@miguelcazares/nestjs-response-helper';
import { AlertsService } from 'src/alerts/alerts.service';
import { AlertEntity } from 'src/alerts/entities/alert.entity';
import { FilterAlertDto } from 'src/alerts/dto/filter-alert.dto';
import { PaginatedResponseDto } from 'src/common/dto/pagination-response.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { UserEntity } from 'src/auth/entities/user.entity';

@ApiTags('Alerts')
@ApiBearerAuth('bearer')
@Controller('/api/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Historial de avisos enviados y pendientes' })
  @ApiOkResponse({ description: 'Listado paginado, del más reciente.' })
  async findAll(
    @UserId() userId: number,
    @Query() filter: FilterAlertDto,
  ): Promise<JsonResponse<PaginatedResponseDto<AlertEntity>>> {
    const result = await this.alertsService.paginate(userId, filter);
    return ResponseHelper.jsendSuccess(result);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manda un mensaje de prueba para verificar el bot de Telegram',
  })
  @ApiBadRequestResponse({ description: 'Falta configurar telegramChatId.' })
  async sendTest(
    @CurrentUser() user: UserEntity,
  ): Promise<JsonResponse<{ delivered: boolean }>> {
    await this.alertsService.sendTestMessage(user);
    return ResponseHelper.jsendSuccess({ delivered: true });
  }
}
