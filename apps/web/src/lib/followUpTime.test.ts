import { describe, it, expect } from "vitest";
import {
  browserTimezone,
  isValidTimezone,
  serializeZonedDatetime,
  getTomorrow10amLocalDatetime,
  buildThankYouFollowUpPayload,
} from "./followUpTime";

describe("followUpTime utilities", () => {
  describe("browserTimezone", () => {
    it("returns a non-empty string", () => {
      const tz = browserTimezone();
      expect(typeof tz).toBe("string");
      expect(tz.length).toBeGreaterThan(0);
    });
  });

  describe("isValidTimezone", () => {
    it("validates standard IANA timezones", () => {
      expect(isValidTimezone("UTC")).toBe(true);
      expect(isValidTimezone("America/New_York")).toBe(true);
      expect(isValidTimezone("Europe/London")).toBe(true);
      expect(isValidTimezone("Asia/Tokyo")).toBe(true);
    });

    it("rejects invalid timezones", () => {
      expect(isValidTimezone("Invalid/Zone")).toBe(false);
      expect(isValidTimezone("Mars/Olympus_Mons")).toBe(false);
      expect(isValidTimezone("")).toBe(false);
    });
  });

  describe("serializeZonedDatetime", () => {
    it("converts local datetime in America/New_York (EDT, UTC-4) to UTC ISO", () => {
      // 2026-10-21 10:00 AM EDT is 14:00 UTC
      const result = serializeZonedDatetime("2026-10-21T10:00", "America/New_York");
      expect(result).toBe("2026-10-21T14:00:00.000Z");
    });

    it("converts local datetime in UTC to UTC ISO", () => {
      const result = serializeZonedDatetime("2026-10-21T10:00", "UTC");
      expect(result).toBe("2026-10-21T10:00:00.000Z");
    });

    it("converts local datetime in Asia/Tokyo (JST, UTC+9) to UTC ISO", () => {
      // 2026-10-21 10:00 AM JST is 01:00 UTC on the same day
      const result = serializeZonedDatetime("2026-10-21T10:00", "Asia/Tokyo");
      expect(result).toBe("2026-10-21T01:00:00.000Z");
    });

    it("throws an error for invalid datetime format", () => {
      expect(() => serializeZonedDatetime("invalid", "UTC")).toThrow(
        "Enter a valid due date, time, and IANA timezone."
      );
    });

    it("throws an error for invalid calendar dates (e.g. Feb 30)", () => {
      expect(() => serializeZonedDatetime("2026-02-30T10:00", "UTC")).toThrow(
        "Enter a valid due date and time."
      );
    });
  });

  describe("getTomorrow10amLocalDatetime", () => {
    it("advances one calendar day in America/New_York", () => {
      // 2:00 PM EDT on 2026-09-19
      const refDate = new Date("2026-09-19T18:00:00Z");
      const result = getTomorrow10amLocalDatetime("America/New_York", refDate);
      expect(result).toBe("2026-09-20T10:00");
    });

    it("handles month rollover correctly", () => {
      // 11:00 PM EDT on 2026-09-30
      const refDate = new Date("2026-10-01T03:00:00Z");
      const result = getTomorrow10amLocalDatetime("America/New_York", refDate);
      expect(result).toBe("2026-10-01T10:00");
    });

    it("handles year rollover correctly", () => {
      // 2:00 PM EST on 2026-12-31
      const refDate = new Date("2026-12-31T19:00:00Z");
      const result = getTomorrow10amLocalDatetime("America/New_York", refDate);
      expect(result).toBe("2027-01-01T10:00");
    });
  });

  describe("buildThankYouFollowUpPayload", () => {
    it("builds a canonical thank-you follow-up payload", () => {
      const refDate = new Date("2026-10-20T18:00:00Z");
      const interview = {
        id: "interview-123",
        title: "Staff Architecture Screen",
      };

      const payload = buildThankYouFollowUpPayload(interview, {
        timeZone: "America/New_York",
        referenceDate: refDate,
      });

      expect(payload).toEqual({
        interview_id: "interview-123",
        type: "thank_you",
        title: "Send thank-you note: Staff Architecture Screen",
        due_at_utc: "2026-10-21T14:00:00.000Z",
        timezone: "America/New_York",
        notes: "Thank-you note reminder after Staff Architecture Screen",
      });
    });
  });
});
