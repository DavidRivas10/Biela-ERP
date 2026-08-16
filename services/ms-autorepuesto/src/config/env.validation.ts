import Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  MS_AUTOREPUESTO_PORT: Joi.number().port().default(4002),
  DATABASE_URL: Joi.string().uri().required(),
  CORS_ORIGINS: Joi.string().default("http://localhost:4000"),
});
