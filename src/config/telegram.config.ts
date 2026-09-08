import * as Joi from 'joi';

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  /** Hora local (0-23) a la que el cron de alertas evalúa los vencimientos. */
  alertsCronHour: number;
}

export const telegramValidationSchema = {
  TELEGRAM_ENABLED: Joi.boolean().default(false),
  // Solo se exige el token cuando el canal está encendido: en local y en los
  // tests el servicio arranca sin credenciales de Telegram.
  TELEGRAM_BOT_TOKEN: Joi.string()
    .allow('')
    .when('TELEGRAM_ENABLED', {
      is: true,
      then: Joi.string().min(1).required(),
    }),
  ALERTS_CRON_HOUR: Joi.number().min(0).max(23).default(7),
};

export default (): { telegram: TelegramConfig } => ({
  telegram: {
    enabled: process.env.TELEGRAM_ENABLED === 'true',
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    alertsCronHour: parseInt(process.env.ALERTS_CRON_HOUR || '7', 10),
  },
});
