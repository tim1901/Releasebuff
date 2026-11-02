import { describe, expect, it } from "vitest";
import { ALL_CATEGORIES, CATEGORY_GROUPS, CATEGORY_NAMES } from "@/lib/story-categories";

describe("Releasebuff story taxonomy", () => {
  it("contains exactly 16 agreed categories", () => {
    expect(ALL_CATEGORIES).toHaveLength(16);
    expect(new Set(CATEGORY_NAMES).size).toBe(16);
  });
  it("keeps four category groups with four items each", () => {
    expect(CATEGORY_GROUPS).toHaveLength(4);
    expect(CATEGORY_GROUPS.map(g => g.categories.length)).toEqual([4, 4, 4, 4]);
  });
  it("includes categories that need external context rather than requiring GitHub evidence", () => {
    expect(CATEGORY_NAMES).toContain("Traction and milestones");
    expect(CATEGORY_NAMES).toContain("Customer feedback and learning");
    expect(CATEGORY_NAMES).toContain("Founder journey / personal reflection");
  });
});
