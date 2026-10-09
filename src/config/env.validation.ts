import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  APP_URL: Joi.string().default('http://localhost:3000'),
  CORS_ORIGINS: Joi.string().allow('').default(''),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  DB_LOGGING: Joi.boolean().default(false),

  JWT_ACCESS_SECRET: Joi.string().min(8).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(8).required(),
  JWT_REFRESH_TTL_DAYS: Joi.number().default(30),
  OTP_TTL_SECONDS: Joi.number().default(300),
  OTP_MAX_ATTEMPTS: Joi.number().default(5),
  OTP_DEV_MODE: Joi.boolean().default(false),
  OTP_SECRET: Joi.string().min(8).required(),

  STORAGE_DRIVER: Joi.string().valid('local').default('local'),
  UPLOAD_DIR: Joi.string().default('uploads'),
  MAX_UPLOAD_MB: Joi.number().default(10),

  TELEGRAM_BOT_TOKEN: Joi.string().allow('').default(''),
  VIN_DECODER_EXTERNAL: Joi.boolean().default(true),
  PAYMENT_WEBHOOK_SECRET: Joi.string().default('change-me-webhook'),
  PAYMENT_PROVIDER: Joi.string().valid('mock', 'manual').default('mock'),
  ADMIN_PHONE: Joi.string().default('+996700000000'),
});