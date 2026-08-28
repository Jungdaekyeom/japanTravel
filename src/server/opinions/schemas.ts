import { z } from "zod";

const daySchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const opinionIdSchema = z.object({ id: z.uuid() }).strict();

export const submissionSchema = z.object({
  targetDay: daySchema.nullable(),
  body: z.string().trim().min(1).max(1000),
}).strict();

export const rejectionSchema = z.object({
  category: z.enum(["schedule", "budget", "feasibility", "other"]),
  publicSummary: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(300),
}).strict();
