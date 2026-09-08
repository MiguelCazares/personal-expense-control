import * as Joi from 'joi';

export interface LoggerConfig {
  level: string;
  path: string;
}

export const loggerValidationSchema = {
  LOG_LEVEL: Joi.string()
    .valid('debug', 'info', 'warn', 'error', 'fatal', 'silent')
    .required(),
  LOG_PATH: Joi.string().required(),
};

export default (): { log: LoggerConfig } => ({
  log: {
    level: process.env.LOG_LEVEL || 'info',
    path: process.env.LOG_PATH || 'logs/app.log',
  },
});
