import { z } from 'zod';
/**
 * Profile 配置 Schema
 */
export declare const ProfileSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodDefault<z.ZodString>;
    topology: z.ZodEnum<{
        "all-in-one": "all-in-one";
        hybrid: "hybrid";
        split: "split";
    }>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Profile = z.infer<typeof ProfileSchema>;
//# sourceMappingURL=profile.d.ts.map