export function localDateTimeToUtc(date: string, time: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Enter a valid date.");
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Enter a time in 24-hour format, such as 10:30.");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const targetLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  if (!Number.isFinite(targetLocalAsUtc)) throw new Error("Date and time are invalid.");

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  let candidate = targetLocalAsUtc;
  for (let i = 0; i < 4; i++) {
    const parts = formatter.formatToParts(new Date(candidate));
    const value = (type: string) => Number(parts.find(p => p.type === type)?.value);
    const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
    const offset = asUtc - candidate;
    candidate = targetLocalAsUtc - offset;
  }
  const final = formatter.formatToParts(new Date(candidate));
  const get = (type: string) => final.find(p => p.type === type)?.value;
  if (get("year") !== String(year) || get("month") !== String(month).padStart(2, "0") || get("day") !== String(day).padStart(2, "0") || get("hour") !== String(hour).padStart(2, "0") || get("minute") !== String(minute).padStart(2, "0")) {
    throw new Error("That local time does not exist in this timezone, possibly because of a daylight-saving transition. Choose another time.");
  }
  return new Date(candidate).toISOString();
}

export function isFutureIso(value: string, now = Date.now()): boolean {
  const ms = Date.parse(value);
  return Number.isFinite(ms) && ms > now;
}
