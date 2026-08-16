import Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  API_GATEWAY_PORT: Joi.number().port().default(4000),
  MS_USERS_URL: Joi.string().uri().required(),
  MS_AUTOREPUESTO_URL: Joi.string().uri().required(),
  UPSTREAM_TIMEOUT_MS: Joi.number().integer().min(100).max(30000).required(),
  CORS_ORIGINS: Joi.string().default("http://localhost:3000"),
});
