import { z } from "zod";
import { DAY_OPTIONS, REJECTION_CATEGORIES, type DayNumber } from "../../trip/public";

const daySchema = z.custom<DayNumber>((value) => typeof value === "number" && DAY_OPTIONS.includes(value as DayNumber));

export const opinionIdSchema = z.object({ id: z.uuid() }).strict();

export const submissionSchema = z.object({
  targetDay: daySchema.nullable(),
  body: z.string().trim().min(1).max(1000),
}).strict();

export const rejectionSchema = z.object({
  category: z.enum(REJECTION_CATEGORIES),
  publicSummary: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(300),
}).strict();
