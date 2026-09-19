export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

export type KeywordGroup = {
  id: string;
  label: string;
  keywords: string[];
  enabled: boolean;
};

export type DateRange = "all" | "yesterday" | "week" | "month";

export type JobFilters = {
  q: string;
  locationQuery: string;
  sources: string[];
  workplaceTypes: string[];
  applicationStatuses: ApplicationStatus[];
  minMatchScore: number | null;
  dateRange: DateRange;
  keywordGroups: KeywordGroup[];
  sort: string;
  sortDirection: string;
};

export type JobsSearchParamsUpdate = {
  page?: number;
  q?: string;
  locationQuery?: string;
  sources?: string[];
  workplaceTypes?: string[];
  applicationStatuses?: ApplicationStatus[];
  minMatchScore?: number | null;
  dateRange?: DateRange;
  sort?: string;
  sortDirection?: string;
  keywordGroups?: KeywordGroup[];
};

export function encodeKeywordGroup(group: KeywordGroup): string {
  const enabledFlag = group.enabled ? "1" : "0";
  const encodedLabel = encodeURIComponent(group.label);
  const encodedKeywords = group.keywords.map((keyword) => encodeURIComponent(keyword)).join(",");

  return `${enabledFlag}::${group.id}::${encodedLabel}::${encodedKeywords}`;
}

export function buildJobsSearchParams(
  currentParams: URLSearchParams | string,
  next: JobsSearchParamsUpdate,
  baseFilters?: Partial<JobFilters>
): URLSearchParams {
  const params = new URLSearchParams(
    typeof currentParams === "string" ? currentParams : currentParams.toString()
  );

  const page = next.page ?? 1;
  const q = next.q !== undefined ? next.q : (baseFilters?.q ?? "");
  const locationQuery =
    next.locationQuery !== undefined ? next.locationQuery : (baseFilters?.locationQuery ?? "");
  const sources = next.sources ?? baseFilters?.sources ?? [];
  const workplaceTypes = next.workplaceTypes ?? baseFilters?.workplaceTypes ?? [];
  const applicationStatuses =
    next.applicationStatuses ?? baseFilters?.applicationStatuses ?? [];
  const minMatchScore =
    next.minMatchScore !== undefined
      ? next.minMatchScore
      : (baseFilters?.minMatchScore ?? null);
  const dateRange = next.dateRange ?? baseFilters?.dateRange ?? "all";
  const sort = next.sort ?? baseFilters?.sort ?? "match_score";
  const sortDirection = next.sortDirection ?? baseFilters?.sortDirection ?? "desc";
  const groups = next.keywordGroups ?? baseFilters?.keywordGroups ?? [];

  if (page <= 1) {
    params.delete("page");
  } else {
    params.set("page", String(page));
  }

  if (q && q.trim()) {
    params.set("q", q.trim());
  } else {
    params.delete("q");
  }

  if (locationQuery && locationQuery.trim()) {
    params.set("location_query", locationQuery.trim());
  } else {
    params.delete("location_query");
  }

  params.delete("source");
  sources.forEach((source) => {
    params.append("source", source);
  });

  params.delete("workplace_type");
  workplaceTypes.forEach((workplaceType) => {
    params.append("workplace_type", workplaceType);
  });

  params.delete("application_status");
  applicationStatuses.forEach((status) => {
    params.append("application_status", status);
  });

  if (minMatchScore === null || minMatchScore === undefined) {
    params.delete("min_match_score");
  } else {
    params.set("min_match_score", String(minMatchScore));
  }

  if (dateRange === "all") {
    params.delete("date_range");
  } else {
    params.set("date_range", dateRange);
  }

  params.set("sort", sort);
  params.set("sort_direction", sortDirection);

  params.delete("kw");
  groups.forEach((group) => {
    params.append("kw", encodeKeywordGroup(group));
  });

  return params;
}
