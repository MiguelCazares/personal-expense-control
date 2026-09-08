import { Injectable, Logger } from '@nestjs/common';
import { INotificationChannel } from 'src/alerts/notifications/notification.interface';

/**
 * Sustituye a TelegramService cuando el canal está apagado o en tests: registra
 * el mensaje en el log en vez de salir a la red. Mismo patrón que el
 * StripeMockService de ms-payments.
 */
@Injectable()
export class TelegramMockService implements INotificationChannel {
  private readonly logger = new Logger(TelegramMockService.name);

  readonly sent: { chatId: string; message: string }[] = [];

  send(chatId: string, message: string): Promise<void> {
    this.sent.push({ chatId, message });
    this.logger.log(`[mock] a ${chatId}: ${message.replace(/\n/g, ' | ')}`);
    return Promise.resolve();
  }
}
