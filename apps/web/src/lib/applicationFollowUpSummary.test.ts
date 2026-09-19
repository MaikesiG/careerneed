import { describe, expect, it } from "vitest";
import { getApplicationFollowUpSummaryDisplay } from "./applicationFollowUpSummary";

const now = new Date(2026, 9, 21, 12, 0, 0);

describe("getApplicationFollowUpSummaryDisplay", () => {
  it("marks an earlier local-day timestamp overdue", () => {
    const result = getApplicationFollowUpSummaryDisplay(
      new Date(2026, 9, 20, 23, 59).toISOString(),
      1,
      now
    );

    expect(result).toMatchObject({ label: "Overdue", needsAttention: true });
  });

  it("marks a timestamp inside the current local day due today", () => {
    const result = getApplicationFollowUpSummaryDisplay(
      new Date(2026, 9, 21, 18, 0).toISOString(),
      1,
      now
    );

    expect(result).toMatchObject({ label: "Due today", needsAttention: true });
  });

  it("formats a future timestamp without marking it for attention", () => {
    const result = getApplicationFollowUpSummaryDisplay(
      new Date(2026, 9, 22, 10, 0).toISOString(),
      1,
      now
    );

    expect(result).toMatchObject({ label: "Follow up Oct 22, 2026", needsAttention: false });
  });

  it("returns no badge for a null timestamp and zero open records", () => {
    expect(getApplicationFollowUpSummaryDisplay(null, 0, now)).toBeNull();
  });

  it("uses a neutral fallback for invalid or missing timestamps with open records", () => {
    expect(getApplicationFollowUpSummaryDisplay("not-a-date", 1, now)).toMatchObject({
      label: "Follow-up scheduled",
      needsAttention: false,
    });
    expect(getApplicationFollowUpSummaryDisplay(null, 1, now)).toMatchObject({
      label: "Follow-up scheduled",
      needsAttention: false,
    });
  });

  it("shows multiple open records without multiplying application attention", () => {
    const result = getApplicationFollowUpSummaryDisplay(
      new Date(2026, 9, 21, 9, 0).toISOString(),
      3,
      now
    );

    expect(result).toMatchObject({
      label: "Due today",
      needsAttention: true,
      countLabel: "3 open",
    });
  });
});
