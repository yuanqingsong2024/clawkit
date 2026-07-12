import { z } from 'zod';
export declare const PromptDraftVersionSchema: z.ZodObject<{
    generation: z.ZodNumber;
    revision: z.ZodNumber;
}, z.core.$strip>;
export type PromptDraftVersion = z.infer<typeof PromptDraftVersionSchema>;
//# sourceMappingURL=prompt-draft.d.ts.map