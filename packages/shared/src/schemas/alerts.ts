import { z } from "zod";

export const alertSnoozeInput = z.object({
  days: z.number().int().min(1).max(30).default(7),
});
export type AlertSnoozeInput = z.infer<typeof alertSnoozeInput>;

// ack has no body; kept for symmetry / future note field.
export const alertAckInput = z.object({}).strict();
export type AlertAckInput = z.infer<typeof alertAckInput>;
