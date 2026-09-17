import { redirect } from "next/navigation";
import JobsClient from "./JobsClient";
import { serverApiFetch } from "@/lib/serverApi";

type Job = {
  id: string;
  company_name: string;
  source: string;
  source_type: string;
  title: string;
  location: string | null;
  workplace_type: string | null;
  application_url: string;
  match_score: number | null;
  posted_at: string | null;
  first_seen_at: string;
};

type DateRange = "all" | "yesterday" | "week" | "month";

type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";

const APPLICATION_STATUSES: ApplicationStatus[] = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
];

type SearchParams = {
  page?: string | string[];
  q?: string | string[];
  location_query?: string | string[];
  source?: string | string[];
  workplace_type?: string | string[];
  application_status?: string | string[];
  min_match_score?: string | string[];
  date_range?: string | string[];
  kw?: string | string[];
  sort?: string | string[];
  sort_direction?: string | string[];
};

type JobsPageProps = {
  searchParams: Promise<SearchParams>;
};

type JobsResponse = {
  jobs: Job[];
  total: number;
};

type KeywordGroup = {
  id: string;
  label: string;
  keywords: string[];
  enabled: boolean;
};

const PAGE_SIZE = 20;
const DEFAULT_SORT = "match_score";
const DEFAULT_SORT_DIRECTION = "desc";

function getSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getMultipleValues(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
}

function getPageNumber(value: string | string[] | undefined): number {
  const parsedValue = Number.parseInt(getSingleValue(value) || "1", 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return 1;
  }

  return parsedValue;
}

function parseDateRange(value: string): DateRange {
  if (value === "yesterday" || value === "week" || value === "month") {
    return value;
  }

  return "all";
}

function parseMinMatchScore(value: string): number | null {
  const parsedValue = Number.parseInt(value, 10);

  if (parsedValue === 50 || parsedValue === 75 || parsedValue === 90) {
    return parsedValue;
  }

  return null;
}

function parseApplicationStatuses(values: string[]): ApplicationStatus[] {
  const validStatuses = new Set<ApplicationStatus>(APPLICATION_STATUSES);

  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter((value): value is ApplicationStatus =>
          validStatuses.has(value as ApplicationStatus)
        )
    )
  );
}

function parseSort(value: string): string {
  if (value === "recent" || value === "match_score") {
    return value;
  }

  return DEFAULT_SORT;
}

function parseSortDirection(value: string): string {
  if (value === "asc" || value === "desc") {
    return value;
  }

  return DEFAULT_SORT_DIRECTION;
}

function parseKeywordGroups(rawGroups: string[]): KeywordGroup[] {
  return rawGroups
    .map((rawGroup) => {
      const [enabledFlag, id, encodedLabel, keywordsPart] = rawGroup.split("::");

      if (!id || !encodedLabel) {
        return null;
      }

      try {
        const keywords = (keywordsPart ?? "")
          .split(",")
          .map((keyword) => keyword.trim())
          .filter(Boolean)
          .map((keyword) => decodeURIComponent(keyword));

        if (keywords.length === 0) {
          return null;
        }

        return {
          id,
          label: decodeURIComponent(encodedLabel),
          keywords,
          enabled: enabledFlag !== "0",
        };
      } catch {
        return null;
      }
    })
    .filter((group): group is KeywordGroup => group !== null);
}

async function getJobs(
  page: number,
  filters: {
    q: string;
    locationQuery: string;
    sources: string[];
    workplaceTypes: string[];
    applicationStatuses: ApplicationStatus[];
    minMatchScore: number | null;
    dateRange: DateRange;
    activeKeywords: string[];
    sort: string;
    sortDirection: string;
  },
  resolvedSearchParams: SearchParams
): Promise<JobsResponse> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
    sort: filters.sort,
    sort_direction: filters.sortDirection,
  });

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.locationQuery) {
    params.set("location_query", filters.locationQuery);
  }

  filters.sources.forEach((source) => {
    params.append("source", source);
  });

  filters.workplaceTypes.forEach((workplaceType) => {
    params.append("workplace_type", workplaceType);
  });

  filters.applicationStatuses.forEach((status) => {
    params.append("application_status", status);
  });

  if (filters.minMatchScore !== null) {
    params.set("min_match_score", String(filters.minMatchScore));
  }

  if (filters.dateRange !== "all") {
    params.set("date_range", filters.dateRange);
  }

  filters.activeKeywords.forEach((keyword) => {
    params.append("keywords", keyword);
  });

  let response: Response;

  try {
    response = await serverApiFetch(`/jobs?${params.toString()}`, {
      cache: "no-store",
    });
  } catch {
    return { jobs: [], total: 0 };
  }

  if (response.status === 401) {
    const nextParams = new URLSearchParams();

    Object.entries(resolvedSearchParams).forEach(([key, rawValue]) => {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];

      values.filter(Boolean).forEach((value) => {
        nextParams.append(key, value);
      });
    });

    const nextPath = nextParams.toString() ? `/jobs?${nextParams}` : "/jobs";
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (!response.ok) {
    return { jobs: [], total: 0 };
  }

  const total = Number.parseInt(response.headers.get("X-Total-Count") ?? "0", 10);

  return {
    jobs: (await response.json()) as Job[],
    total: Number.isFinite(total) ? total : 0,
  };
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const resolvedSearchParams = await searchParams;

  const requestedPage = getPageNumber(resolvedSearchParams.page);

  const q = getSingleValue(resolvedSearchParams.q).trim();

  const locationQuery = getSingleValue(resolvedSearchParams.location_query).trim();

  const sources = Array.from(
    new Set(
      getMultipleValues(resolvedSearchParams.source)
        .map((source) => source.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const workplaceTypes = Array.from(
    new Set(
      getMultipleValues(resolvedSearchParams.workplace_type)
        .map((workplaceType) => workplaceType.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const applicationStatuses = parseApplicationStatuses(
    getMultipleValues(resolvedSearchParams.application_status)
  );

  const minMatchScore = parseMinMatchScore(
    getSingleValue(resolvedSearchParams.min_match_score).trim()
  );

  const dateRange = parseDateRange(
    getSingleValue(resolvedSearchParams.date_range).trim().toLowerCase()
  );

  const sort = parseSort(getSingleValue(resolvedSearchParams.sort).trim().toLowerCase());

  const sortDirection = parseSortDirection(
    getSingleValue(resolvedSearchParams.sort_direction).trim().toLowerCase()
  );

  const keywordGroups = parseKeywordGroups(getMultipleValues(resolvedSearchParams.kw));

  const activeKeywords = keywordGroups
    .filter((group) => group.enabled)
    .flatMap((group) => group.keywords);

  const { jobs, total } = await getJobs(
    requestedPage,
    {
      q,
      locationQuery,
      sources,
      workplaceTypes,
      applicationStatuses,
      minMatchScore,
      dateRange,
      activeKeywords,
      sort,
      sortDirection,
    },
    resolvedSearchParams
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  return (
    <JobsClient
      initialFilters={{
        q,
        locationQuery,
        sources,
        workplaceTypes,
        applicationStatuses,
        minMatchScore,
        dateRange,
        keywordGroups,
        sort,
        sortDirection,
      }}
      initialJobs={jobs}
      initialPage={page}
      pageSize={PAGE_SIZE}
      totalJobs={total}
      totalPages={totalPages}
    />
  );
}
