/**
 * Timezone and scheduling utilities for canonical follow-up reminders.
 */

export type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function zonedParts(date: Date, timeZone: string): DateParts | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour),
      minute: Number(values.minute),
      second: Number(values.second),
    };
  } catch {
    return null;
  }
}

export function serializeZonedDatetime(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match || !isValidTimezone(timeZone)) {
    throw new Error("Enter a valid due date, time, and IANA timezone.");
  }
  const target: DateParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: 0,
  };
  const targetEpoch = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute
  );
  const calendarCheck = new Date(targetEpoch);
  if (
    calendarCheck.getUTCFullYear() !== target.year ||
    calendarCheck.getUTCMonth() + 1 !== target.month ||
    calendarCheck.getUTCDate() !== target.day ||
    target.hour > 23 ||
    target.minute > 59
  ) {
    throw new Error("Enter a valid due date and time.");
  }

  let candidate = targetEpoch;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(candidate), timeZone);
    if (!actual) throw new Error("Enter a valid IANA timezone.");
    const actualEpoch = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    candidate += targetEpoch - actualEpoch;
  }
  const verified = zonedParts(new Date(candidate), timeZone);
  if (
    !verified ||
    verified.year !== target.year ||
    verified.month !== target.month ||
    verified.day !== target.day ||
    verified.hour !== target.hour ||
    verified.minute !== target.minute
  ) {
    throw new Error("That local time does not exist in the selected timezone.");
  }
  return new Date(candidate).toISOString();
}

export function toDatetimeInput(value: string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = zonedParts(date, timeZone);
  if (!parts) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatTimestamp(value: string, timeZone?: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timeZone && isValidTimezone(timeZone) ? { timeZone } : {}),
    }).format(date);
  } catch {
    return "Date unavailable";
  }
}

export function getTomorrow10amLocalDatetime(
  timeZone: string,
  referenceDate: Date = new Date()
): string {
  const parts = zonedParts(referenceDate, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (!parts) {
    const fallback = new Date(referenceDate);
    fallback.setDate(fallback.getDate() + 1);
    return `${fallback.getFullYear()}-${pad(fallback.getMonth() + 1)}-${pad(fallback.getDate())}T10:00`;
  }
  const tomorrowUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const year = tomorrowUtc.getUTCFullYear();
  const month = pad(tomorrowUtc.getUTCMonth() + 1);
  const day = pad(tomorrowUtc.getUTCDate());
  return `${year}-${month}-${day}T10:00`;
}

export type ThankYouFollowUpPayload = {
  interview_id: string;
  type: "thank_you";
  title: string;
  due_at_utc: string;
  timezone: string;
  notes: string;
};

export function buildThankYouFollowUpPayload(
  interview: { id: string; title: string },
  options?: { timeZone?: string; referenceDate?: Date }
): ThankYouFollowUpPayload {
  const resolvedTimeZone =
    options?.timeZone && isValidTimezone(options.timeZone) ? options.timeZone : browserTimezone();
  const localDatetime = getTomorrow10amLocalDatetime(resolvedTimeZone, options?.referenceDate);
  const dueAtUtc = serializeZonedDatetime(localDatetime, resolvedTimeZone);

  return {
    interview_id: interview.id,
    type: "thank_you",
    title: `Send thank-you note: ${interview.title}`,
    due_at_utc: dueAtUtc,
    timezone: resolvedTimeZone,
    notes: `Thank-you note reminder after ${interview.title}`,
  };
}
