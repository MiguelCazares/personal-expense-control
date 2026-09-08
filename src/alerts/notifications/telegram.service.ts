import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramConfig } from 'src/config/telegram.config';
import { INotificationChannel } from 'src/alerts/notifications/notification.interface';

interface TelegramError {
  description?: string;
}

@Injectable()
export class TelegramService implements INotificationChannel {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;

  constructor(configService: ConfigService) {
    this.botToken = configService.get<TelegramConfig>('telegram')!.botToken;
  }

  async send(chatId: string, message: string): Promise<void> {
    const response = await fetch(
      `https://api.telegram.org/bot${this.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      },
    );

    if (!response.ok) {
      // La descripción de Telegram es lo único accionable ("chat not found",
      // "bot was blocked"), así que se propaga en el error.
      const body = (await response.json().catch(() => ({}))) as TelegramError;
      const detail = body.description ?? response.statusText;

      this.logger.error(`Telegram respondió ${response.status}: ${detail}`);
      throw new Error(`Telegram ${response.status}: ${detail}`);
    }
  }
}
