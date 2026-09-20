export function dashboardSummaryRequestPath(timezone: string): string {
  return `/dashboard/summary?timezone=${encodeURIComponent(timezone)}`;
}
