import { z } from "zod";
import { VISION_PROVIDER } from "../../enums/index";

export const visionStepSchema = z.object({
  vision_provider: z.enum(VISION_PROVIDER),
});
export type VisionStep = z.infer<typeof visionStepSchema>;
