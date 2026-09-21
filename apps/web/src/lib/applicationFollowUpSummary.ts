export type ApplicationFollowUpSummaryDisplay = {
  label: string;
  className: string;
  needsAttention: boolean;
  countLabel: string | null;
};

function normalizedOpenCount(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function localDayStart(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function getApplicationFollowUpSummaryDisplay(
  nextOpenFollowUpAt: string | null,
  openFollowUpCount: number,
  now: Date = new Date()
): ApplicationFollowUpSummaryDisplay | null {
  const count = normalizedOpenCount(openFollowUpCount);
  if (count === 0) return null;

  const countLabel = count > 1 ? `${count} open` : null;
  if (!nextOpenFollowUpAt) {
    return {
      label: "Follow-up scheduled",
      className: "border-border bg-muted text-muted-foreground",
      needsAttention: false,
      countLabel,
    };
  }

  const dueAt = new Date(nextOpenFollowUpAt);
  if (Number.isNaN(dueAt.getTime())) {
    return {
      label: "Follow-up scheduled",
      className: "border-border bg-muted text-muted-foreground",
      needsAttention: false,
      countLabel,
    };
  }

  const todayStart = localDayStart(now);
  const tomorrowStart = new Date(
    todayStart.getFullYear(),
    todayStart.getMonth(),
    todayStart.getDate() + 1
  );

  if (dueAt < todayStart) {
    return {
      label: "Overdue",
      className: "border-error-border bg-error-background text-destructive",
      needsAttention: true,
      countLabel,
    };
  }

  if (dueAt < tomorrowStart) {
    return {
      label: "Due today",
      className: "border-warning-border bg-warning-background text-warning",
      needsAttention: true,
      countLabel,
    };
  }

  let formattedDate = "Follow-up scheduled";
  try {
    formattedDate = `Follow up ${new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
    }).format(dueAt)}`;
  } catch {
    // Retain the neutral fallback without exposing an invalid date.
  }

  return {
    label: formattedDate,
    className: "border-border bg-muted text-muted-foreground",
    needsAttention: false,
    countLabel,
  };
}
