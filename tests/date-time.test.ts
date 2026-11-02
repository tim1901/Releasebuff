import { describe, expect, it } from "vitest";
import { isFutureIso, localDateTimeToUtc } from "@/lib/date-time";

describe("localDateTimeToUtc", () => {
  it("converts Lagos local time to UTC", () => {
    expect(localDateTimeToUtc("2026-11-03", "10:30", "Africa/Lagos")).toBe("2026-11-03T09:30:00.000Z");
  });
  it("converts Paris local time using the applicable timezone offset", () => {
    expect(localDateTimeToUtc("2026-11-03", "10:30", "Europe/Paris")).toBe("2026-11-03T09:30:00.000Z");
  });
  it("rejects invalid time input", () => {
    expect(() => localDateTimeToUtc("2026-11-03", "25:73", "UTC")).toThrow(/24-hour/i);
  });
  it("rejects non-existent daylight-saving local time", () => {
    expect(() => localDateTimeToUtc("2026-03-08", "02:30", "America/New_York")).toThrow(/does not exist/i);
  });
});

describe("isFutureIso", () => {
  it("accepts an ISO time after now", () => expect(isFutureIso("2026-11-01T10:00:00.000Z", Date.parse("2026-10-31T10:00:00.000Z"))).toBe(true));
  it("rejects an ISO time before now", () => expect(isFutureIso("2026-10-30T10:00:00.000Z", Date.parse("2026-10-31T10:00:00.000Z"))).toBe(false));
});
