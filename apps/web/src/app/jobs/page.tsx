import JobsClient from "./JobsClient";

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

type SearchParams = {
  page?: string | string[];
  q?: string | string[];
  source?: string | string[];
  workplace_type?: string | string[];
  category?: string | string[];
};

type JobsPageProps = {
  searchParams: Promise<SearchParams>;
};

type JobsResponse = {
  jobs: Job[];
  total: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PAGE_SIZE = 20;

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

async function getJobs(
  page: number,
  filters: {
    q: string;
    source: string;
    workplaceType: string;
    categories: string[];
  }
): Promise<JobsResponse> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  });

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.source) {
    params.set("source", filters.source);
  }

  if (filters.workplaceType) {
    params.set("workplace_type", filters.workplaceType);
  }

  filters.categories.forEach((category) => {
    params.append("category", category);
  });

  try {
    const response = await fetch(`${API_URL}/jobs?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return { jobs: [], total: 0 };
    }

    const total = Number.parseInt(response.headers.get("X-Total-Count") ?? "0", 10);

    return {
      jobs: (await response.json()) as Job[],
      total: Number.isFinite(total) ? total : 0,
    };
  } catch {
    return { jobs: [], total: 0 };
  }
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const resolvedSearchParams = await searchParams;

  const requestedPage = getPageNumber(resolvedSearchParams.page);
  const q = getSingleValue(resolvedSearchParams.q).trim();
  const source = getSingleValue(resolvedSearchParams.source).trim();
  const workplaceType = getSingleValue(resolvedSearchParams.workplace_type).trim();
  const categories = getMultipleValues(resolvedSearchParams.category);

  const { jobs, total } = await getJobs(requestedPage, {
    q,
    source,
    workplaceType,
    categories,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  return (
    <JobsClient
      initialFilters={{
        categories,
        q,
        source,
        workplaceType,
      }}
      initialJobs={jobs}
      initialPage={page}
      pageSize={PAGE_SIZE}
      totalJobs={total}
      totalPages={totalPages}
    />
  );
}
