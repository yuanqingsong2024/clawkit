import { z } from 'zod';

export const PromptDraftVersionSchema = z.object({
  generation: z.number().int().min(1).describe('生成轮次，从 1 开始递增'),
  revision: z.number().int().min(0).describe('同一生成轮次下的修订次数，从 0 开始'),
});

export type PromptDraftVersion = z.infer<typeof PromptDraftVersionSchema>;
