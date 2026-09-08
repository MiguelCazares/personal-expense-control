import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): object {
    return {
      status: 'ok',
      service: 'ms-expenses',
      version: process.env.npm_package_version ?? '1.0.0',
    };
  }
}
