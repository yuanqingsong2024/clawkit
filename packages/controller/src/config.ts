import { z } from 'zod';
import { getEnvString, getEnvNumber, validateConfig } from '@clawkit/shared';

const ControllerConfigSchema = z.object({
  host: z.string().default('127.0.0.1'),
  port: z.number().int().positive().default(8787),
  dbPath: z.string().default('.clawkit/controller.db'),
});

export type ControllerConfig = z.infer<typeof ControllerConfigSchema>;

export function loadControllerConfig(): ControllerConfig {
  const rawConfig = {
    host: getEnvString('CONTROLLER_HOST', '127.0.0.1'),
    port: getEnvNumber('CONTROLLER_PORT', 8787),
    dbPath: getEnvString('CONTROLLER_DB_PATH', '.clawkit/controller.db'),
  };

  return validateConfig(ControllerConfigSchema, rawConfig, 'Controller');
}
