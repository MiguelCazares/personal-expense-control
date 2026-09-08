import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Health')
@Controller('/api')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get('health')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check del servicio (incluye ping a la DB)' })
  @ApiOkResponse({
    description: 'El servicio está sano.',
    schema: {
      example: {
        status: 'ok',
        service: 'ms-expenses',
        version: '1.0.0',
        info: { database: { status: 'up' } },
      },
    },
  })
  async getHealth(): Promise<object> {
    const result = await this.health.check([
      () => this.db.pingCheck('database'),
    ]);
    return { ...this.appService.getHealth(), ...result };
  }
}
