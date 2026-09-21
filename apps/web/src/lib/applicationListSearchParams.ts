import type { ApplicationStatus } from "./api";

export type ApplicationFollowUpFilter = "all" | "today" | "overdue" | "scheduled";

export function buildApplicationsHref(
  status: ApplicationStatus | null,
  followUp: ApplicationFollowUpFilter
): string {
  const params = new URLSearchParams();

  if (status) params.set("status", status);
  if (followUp !== "all") params.set("follow_up", followUp);

  const query = params.toString();
  return query ? `/applications?${query}` : "/applications";
}

export function buildApplicationsRequestPath(
  status: ApplicationStatus | null,
  followUp: ApplicationFollowUpFilter,
  timezone: string
): string {
  const params = new URLSearchParams({ limit: "100", timezone });

  if (status) params.set("status", status);
  if (followUp !== "all") params.set("follow_up", followUp);

  return `/applications?${params.toString()}`;
}
