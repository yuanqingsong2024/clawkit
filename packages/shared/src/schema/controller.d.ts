import { z } from 'zod';
/**
 * Controller 配置 Schema
 */
export declare const ControllerSchema: z.ZodObject<{
    node: z.ZodString;
    port: z.ZodDefault<z.ZodNumber>;
    apiPrefix: z.ZodDefault<z.ZodString>;
    publicUrl: z.ZodString;
}, z.core.$strip>;
export type Controller = z.infer<typeof ControllerSchema>;
//# sourceMappingURL=controller.d.ts.map