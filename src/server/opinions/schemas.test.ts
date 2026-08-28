import { describe, expect, it } from "vitest";

import { rejectionSchema, submissionSchema } from "./schemas";

describe("opinion request schemas", () => {
  it("trims and accepts only a nullable day from one through five with a 1–1000 character body", () => {
    expect(submissionSchema.parse({ targetDay: null, body: "  전체 일정 제안  " })).toEqual({
      targetDay: null,
      body: "전체 일정 제안",
    });
    expect(submissionSchema.safeParse({ targetDay: 1.5, body: "제안" }).success).toBe(false);
    expect(submissionSchema.safeParse({ targetDay: 6, body: "제안" }).success).toBe(false);
    expect(submissionSchema.safeParse({ targetDay: 1, body: "   " }).success).toBe(false);
    expect(submissionSchema.safeParse({ targetDay: 1, body: "가".repeat(1001) }).success).toBe(false);
  });

  it("accepts only defined rejection categories and trimmed public fields within their limits", () => {
    expect(rejectionSchema.parse({
      category: "schedule",
      publicSummary: "  일정 조정 필요  ",
      reason: "  이동 시간이 부족합니다.  ",
    })).toEqual({
      category: "schedule",
      publicSummary: "일정 조정 필요",
      reason: "이동 시간이 부족합니다.",
    });
    expect(rejectionSchema.safeParse({ category: "invalid", publicSummary: "요약", reason: "사유" }).success).toBe(false);
    expect(rejectionSchema.safeParse({ category: "budget", publicSummary: " ", reason: "사유" }).success).toBe(false);
    expect(rejectionSchema.safeParse({ category: "budget", publicSummary: "가".repeat(81), reason: "사유" }).success).toBe(false);
    expect(rejectionSchema.safeParse({ category: "budget", publicSummary: "요약", reason: "가".repeat(301) }).success).toBe(false);
  });
});
