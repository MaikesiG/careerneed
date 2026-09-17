"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch, getApiErrorMessage } from "@/lib/api";

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

type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";

type ApplicationState = {
  id: string;
  job_id: string;
  resume_id: string | null;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
};

type Resume = {
  id: string;
  filename: string;
  label: string | null;
  is_default: boolean;
};

type ApplicationStateResponse = {
  states: Record<string, ApplicationState>;
};

type KeywordGroup = {
  id: string;
  label: string;
  keywords: string[];
  enabled: boolean;
};

type DateRange = "all" | "yesterday" | "week" | "month";

type JobFilters = {
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

type JobsClientProps = {
  initialFilters: JobFilters;
  initialJobs: Job[];
  initialPage: number;
  pageSize: number;
  totalJobs: number;
  totalPages: number;
};

const SORT_OPTIONS = [
  { value: "match_score", label: "Best match" },
  { value: "recent", label: "Most recent" },
];

const DEFAULT_SORT = "match_score";
const DEFAULT_SORT_DIRECTION = "desc";

const MATCH_SCORE_OPTIONS = [
  { value: null, label: "All scores" },
  { value: 50, label: "50+" },
  { value: 75, label: "75+" },
  { value: 90, label: "90+" },
];
const PROVIDER_OPTIONS = [
  { value: "ashby", label: "Ashby" },
  { value: "greenhouse", label: "Greenhouse" },
  { value: "lever", label: "Lever" },
  { value: "manual", label: "Manual" },
];

const WORKPLACE_OPTIONS = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "yesterday", label: "Since yesterday" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
];

const APPLICATION_STATUS_OPTIONS: {
  value: ApplicationStatus;
  label: string;
}[] = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Not interested" },
];

function formatDate(value: string | null): string {
  if (!value) {
    return "Not provided";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(parsedDate);
}

function formatWorkplaceType(value: string | null): string {
  if (!value || value === "unknown") {
    return "Not specified";
  }

  if (value === "onsite") {
    return "On-site";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function providerLabel(source: string): string {
  const normalizedSource = source.trim().toLowerCase();

  if (normalizedSource === "ashby") {
    return "Ashby";
  }

  if (normalizedSource === "greenhouse") {
    return "Greenhouse";
  }

  if (normalizedSource === "lever") {
    return "Lever";
  }

  if (normalizedSource === "manual") {
    return "Manual";
  }

  return source;
}

function sourceBadgeClass(source: string): string {
  const normalizedSource = source.trim().toLowerCase();

  if (normalizedSource === "greenhouse") {
    return "border-success-border bg-success-background text-success";
  }

  if (normalizedSource === "manual") {
    return "border-warning-border bg-warning-background text-warning";
  }

  if (normalizedSource === "ashby" || normalizedSource === "lever") {
    return "border-primary/30 bg-primary/10 text-primary";
  }

  return "border-border bg-muted text-muted-foreground";
}

function scoreBadgeClass(score: number | null): string {
  if (score === null) {
    return "border-border bg-muted text-muted-foreground";
  }

  if (score >= 70) {
    return "border-success-border bg-success-background text-success";
  }

  if (score >= 40) {
    return "border-warning-border bg-warning-background text-warning";
  }

  return "border-border bg-muted text-muted-foreground";
}

function trackingBadgeClass(status: ApplicationStatus): string {
  if (status === "applied") {
    return "border-success-border bg-success-background text-success";
  }

  if (status === "saved") {
    return "border-primary/30 bg-primary/10 text-primary";
  }

  if (status === "offer") {
    return "border-warning-border bg-warning-background text-warning";
  }

  if (status === "interviewing") {
    return "border-primary/30 bg-primary/10 text-primary";
  }

  return "border-border bg-muted text-muted-foreground";
}

function trackingLabel(status: ApplicationStatus): string {
  if (status === "saved") {
    return "Saved";
  }

  if (status === "applied") {
    return "Applied";
  }

  if (status === "interviewing") {
    return "Interviewing";
  }

  if (status === "offer") {
    return "Offer";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Not interested";
}

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const firstPage = Math.max(1, currentPage - 2);
  const lastPage = Math.min(totalPages, currentPage + 2);

  return Array.from({ length: lastPage - firstPage + 1 }, (_, index) => firstPage + index);
}

function encodeKeywordGroup(group: KeywordGroup): string {
  const enabledFlag = group.enabled ? "1" : "0";
  const encodedLabel = encodeURIComponent(group.label);
  const encodedKeywords = group.keywords.map((keyword) => encodeURIComponent(keyword)).join(",");

  return `${enabledFlag}::${group.id}::${encodedLabel}::${encodedKeywords}`;
}

function createKeywordGroupId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function JobsClient({
  initialFilters,
  initialJobs,
  initialPage,
  pageSize,
  totalJobs,
  totalPages,
}: JobsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(initialFilters.q);
  const [locationInput, setLocationInput] = useState(initialFilters.locationQuery);
  const [applicationStates, setApplicationStates] = useState<Record<string, ApplicationState>>({});
  const [isLoadingStates, setIsLoadingStates] = useState(true);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [draftResumeId, setDraftResumeId] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>(initialFilters.keywordGroups);
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [newGroupKeywords, setNewGroupKeywords] = useState("");
  const [suggestions, setSuggestions] = useState<{ value: string; label: string }[]>([]);

  const jobIds = useMemo(() => initialJobs.map((job) => job.id), [initialJobs]);

  const firstJobNumber = totalJobs === 0 ? 0 : (initialPage - 1) * pageSize + 1;
  const lastJobNumber = Math.min(initialPage * pageSize, totalJobs);
  const visiblePages = getVisiblePages(initialPage, totalPages);

  const handleUnauthenticated = useCallback(() => {
    const query = searchParams.toString();
    const next = query ? `${pathname}?${query}` : pathname;

    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadApplicationStates() {
      if (jobIds.length === 0) {
        setApplicationStates({});
        setIsLoadingStates(false);
        return;
      }

      setIsLoadingStates(true);

      try {
        const params = new URLSearchParams();

        jobIds.forEach((jobId) => {
          params.append("job_id", jobId);
        });

        const response = await apiFetch(`/applications/me/job-states?${params.toString()}`, {
          cache: "no-store",
        });

        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        if (!response.ok) {
          throw new Error(
            await getApiErrorMessage(response, "Unable to load application tracking states.")
          );
        }

        const data = (await response.json()) as ApplicationStateResponse;
        setApplicationStates(data.states);
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load application tracking states."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingStates(false);
        }
      }
    }

    void loadApplicationStates();

    return () => {
      controller.abort();
    };
  }, [handleUnauthenticated, jobIds]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadResumes() {
      try {
        const response = await apiFetch("/resumes", {
          cache: "no-store",
          // signal: controller.signal,
        });

        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response, "Unable to load resumes."));
        }

        setResumes((await response.json()) as Resume[]);
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : "Unable to load resumes.");
      }
    }

    void loadResumes();

    return () => controller.abort();
  }, [handleUnauthenticated]);

  useEffect(() => {
    const controller = new AbortController();
    const lastToken = newGroupKeywords.split(",").pop()?.trim() ?? "";

    const timeoutId = window.setTimeout(() => {
      async function loadSuggestions() {
        try {
          const response = await apiFetch(
            `/jobs/keyword-suggestions?q=${encodeURIComponent(lastToken)}`,
            { signal: controller.signal }
          );

          if (response.status === 401) {
            handleUnauthenticated();
            return;
          }

          if (response.ok) {
            const data = (await response.json()) as {
              suggestions: { value: string; label: string }[];
            };
            setSuggestions(data.suggestions);
          }
        } catch (caughtError) {
          if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
            return;
          }
        }
      }

      void loadSuggestions();
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [newGroupKeywords, handleUnauthenticated]);

  function clearFeedback() {
    setError(null);
    setNotice(null);
  }

  function navigateWithFilters(next: {
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
  }) {
    const params = new URLSearchParams(searchParams.toString());

    const page = next.page ?? 1;
    const q = next.q ?? initialFilters.q;
    const locationQuery = next.locationQuery ?? initialFilters.locationQuery;
    const sources = next.sources ?? initialFilters.sources;
    const workplaceTypes = next.workplaceTypes ?? initialFilters.workplaceTypes;
    const applicationStatuses = next.applicationStatuses ?? initialFilters.applicationStatuses;
    const minMatchScore =
      next.minMatchScore !== undefined ? next.minMatchScore : initialFilters.minMatchScore;
    const dateRange = next.dateRange ?? initialFilters.dateRange;
    const sort = next.sort ?? initialFilters.sort;
    const sortDirection = next.sortDirection ?? initialFilters.sortDirection;
    const groups = next.keywordGroups ?? keywordGroups;

    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }

    if (q.trim()) {
      params.set("q", q.trim());
    } else {
      params.delete("q");
    }

    if (locationQuery.trim()) {
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

    if (minMatchScore === null) {
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

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    navigateWithFilters({
      page: 1,
      q: searchInput,
      locationQuery: locationInput,
    });
  }

  function normalizeKeywordSet(keywords: string[]): Set<string> {
    return new Set(keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean));
  }

  function getOverlapRatio(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 || setB.size === 0) {
      return 0;
    }

    let intersectionCount = 0;

    setA.forEach((keyword) => {
      if (setB.has(keyword)) {
        intersectionCount += 1;
      }
    });

    return intersectionCount / Math.min(setA.size, setB.size);
  }

  function addKeywordGroup() {
    clearFeedback();

    const label = newGroupLabel.trim();
    const keywords = Array.from(
      new Set(
        newGroupKeywords
          .split(",")
          .map((keyword) => keyword.trim())
          .filter(Boolean)
      )
    );

    if (!label || keywords.length === 0) {
      setError("Enter a direction name and at least one keyword.");
      return;
    }

    const newKeywordSet = normalizeKeywordSet(keywords);

    const exactDuplicate = keywordGroups.find((group) => {
      const existingSet = normalizeKeywordSet(group.keywords);

      return (
        existingSet.size === newKeywordSet.size &&
        [...existingSet].every((keyword) => newKeywordSet.has(keyword))
      );
    });

    if (exactDuplicate) {
      setError(`This exact keyword combination already exists as "${exactDuplicate.label}".`);
      return;
    }

    const overlappingGroup = keywordGroups.find((group) => {
      const existingSet = normalizeKeywordSet(group.keywords);

      return getOverlapRatio(newKeywordSet, existingSet) >= 0.7;
    });

    if (overlappingGroup) {
      const confirmed = window.confirm(
        `"${label}" overlaps heavily with your existing direction "${overlappingGroup.label}". Add it anyway?`
      );

      if (!confirmed) {
        return;
      }
    }

    const nextGroups = [
      ...keywordGroups,
      {
        id: createKeywordGroupId(),
        label,
        keywords,
        enabled: true,
      },
    ];

    setKeywordGroups(nextGroups);
    setNewGroupLabel("");
    setNewGroupKeywords("");
    navigateWithFilters({
      page: 1,
      keywordGroups: nextGroups,
    });
  }

  function toggleKeywordGroup(groupId: string) {
    const nextGroups = keywordGroups.map((group) =>
      group.id === groupId ? { ...group, enabled: !group.enabled } : group
    );

    setKeywordGroups(nextGroups);
    navigateWithFilters({
      page: 1,
      keywordGroups: nextGroups,
    });
  }

  function removeKeywordGroup(groupId: string) {
    const nextGroups = keywordGroups.filter((group) => group.id !== groupId);

    setKeywordGroups(nextGroups);
    navigateWithFilters({
      page: 1,
      keywordGroups: nextGroups,
    });
  }

  function toggleMultiValue(values: string[], value: string): string[] {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  }

  function toggleProvider(provider: string) {
    navigateWithFilters({
      page: 1,
      sources: toggleMultiValue(initialFilters.sources, provider),
    });
  }

  function toggleWorkplaceType(workplaceType: string) {
    navigateWithFilters({
      page: 1,
      workplaceTypes: toggleMultiValue(initialFilters.workplaceTypes, workplaceType),
    });
  }

  function toggleApplicationStatus(status: ApplicationStatus) {
    navigateWithFilters({
      page: 1,
      applicationStatuses: toggleMultiValue(
        initialFilters.applicationStatuses,
        status
      ) as ApplicationStatus[],
    });
  }

  function updateMinMatchScore(minMatchScore: number | null) {
    navigateWithFilters({
      page: 1,
      minMatchScore,
    });
  }

  function updateDateRange(dateRange: DateRange) {
    navigateWithFilters({
      page: 1,
      dateRange,
    });
  }

  function updateSort(sort: string, sortDirection: string) {
    navigateWithFilters({
      page: 1,
      sort,
      sortDirection,
    });
  }

  function toggleSortDirection() {
    updateSort(initialFilters.sort, initialFilters.sortDirection === "desc" ? "asc" : "desc");
  }

  function clearFilters() {
    clearFeedback();
    setSearchInput("");
    setLocationInput("");
    setKeywordGroups([]);

    navigateWithFilters({
      page: 1,
      q: "",
      locationQuery: "",
      sources: [],
      workplaceTypes: [],
      applicationStatuses: [],
      minMatchScore: null,
      dateRange: "all",
      sort: DEFAULT_SORT,
      sortDirection: DEFAULT_SORT_DIRECTION,
      keywordGroups: [],
    });
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages || page === initialPage) {
      return;
    }

    navigateWithFilters({ page });
  }

  function refreshJobs() {
    clearFeedback();
    setIsRefreshing(true);
    router.refresh();

    window.setTimeout(() => {
      setIsRefreshing(false);
    }, 300);
  }

  async function updateApplicationStatus(
    jobId: string,
    status: ApplicationStatus,
    details?: { notes?: string | null; resumeId?: string | null }
  ) {
    clearFeedback();
    setUpdatingJobId(jobId);

    try {
      const response = await apiFetch(`/applications/by-job/${jobId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          ...(details?.notes !== undefined ? { notes: details.notes } : {}),
          ...(details?.resumeId !== undefined ? { resume_id: details.resumeId } : {}),
        }),
      });

      if (response.status === 401) {
        handleUnauthenticated();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, "Unable to update application tracking.")
        );
      }

      const updated = (await response.json()) as ApplicationState;

      setApplicationStates((previous) => ({
        ...previous,
        [jobId]: updated,
      }));

      setNotice(`Job marked as ${trackingLabel(updated.status)}.`);
      setEditingJobId(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update application tracking."
      );
    } finally {
      setUpdatingJobId(null);
    }
  }

  function openApplicationDetails(jobId: string) {
    const applicationState = applicationStates[jobId];
    setEditingJobId(jobId);
    setDraftNotes(applicationState?.notes ?? "");
    setDraftResumeId(applicationState?.resume_id ?? "");
  }

  function saveApplicationDetails(jobId: string) {
    void updateApplicationStatus(jobId, applicationStates[jobId]?.status ?? "saved", {
      notes: draftNotes.trim() || null,
      resumeId: draftResumeId || null,
    });
  }

  async function removeApplicationTracking(jobId: string) {
    clearFeedback();
    setUpdatingJobId(jobId);

    try {
      const response = await apiFetch(`/applications/by-job/${jobId}`, {
        method: "DELETE",
      });

      if (response.status === 401) {
        handleUnauthenticated();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, "Unable to remove application tracking.")
        );
      }

      setApplicationStates((previous) => {
        const next = { ...previous };
        delete next[jobId];
        return next;
      });

      setNotice("Personal job tracking removed.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to remove application tracking."
      );
    } finally {
      setUpdatingJobId(null);
    }
  }

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
              CareerNeed
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Job dashboard</h1>
            <p className="text-muted-foreground mt-3 max-w-3xl">
              Search and filter jobs across all synced Ashby, Greenhouse, and Lever company sources.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold transition hover:opacity-90"
              href="/jobs/add"
            >
              + Add a job
            </Link>

            <Link
              className="border-border bg-card text-foreground hover:bg-muted inline-flex h-10 items-center rounded-lg border px-4 text-sm font-semibold transition"
              href="/applications"
            >
              My applications
            </Link>

            <button
              className="border-border bg-card text-foreground hover:bg-muted h-10 rounded-lg border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isRefreshing}
              onClick={refreshJobs}
              type="button"
            >
              {isRefreshing ? "Refreshing..." : "Refresh jobs"}
            </button>
          </div>
        </header>

        {error ? (
          <div
            className="border-error-border bg-error-background text-destructive mb-6 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm"
            role="alert"
          >
            <p>{error}</p>
            <button
              aria-label="Dismiss error"
              className="text-destructive shrink-0 font-semibold hover:opacity-80"
              onClick={() => setError(null)}
              type="button"
            >
              ×
            </button>
          </div>
        ) : null}

        {notice ? (
          <div
            className="border-success-border bg-success-background text-success mb-6 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm"
            role="status"
          >
            <p>{notice}</p>
            <button
              aria-label="Dismiss notification"
              className="text-success shrink-0 font-semibold hover:opacity-80"
              onClick={() => setNotice(null)}
              type="button"
            >
              ×
            </button>
          </div>
        ) : null}

        <section className="border-border bg-card rounded-2xl border p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-lg font-semibold">Find relevant roles</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Showing {firstJobNumber}–{lastJobNumber} of {totalJobs} matching jobs.
                </p>
              </div>

              {(initialFilters.q ||
                initialFilters.locationQuery ||
                initialFilters.sources.length > 0 ||
                initialFilters.workplaceTypes.length > 0 ||
                initialFilters.applicationStatuses.length > 0 ||
                initialFilters.minMatchScore !== null ||
                initialFilters.dateRange !== "all" ||
                keywordGroups.length > 0) && (
                <button
                  className="text-primary text-sm font-semibold hover:opacity-80"
                  onClick={clearFilters}
                  type="button"
                >
                  Clear all filters
                </button>
              )}
            </div>

            <form
              className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              onSubmit={handleSearch}
            >
              <label className="sr-only" htmlFor="job-search">
                Search title or company
              </label>

              <input
                className="border-border focus:border-primary focus:ring-primary/20 h-10 min-w-0 rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                id="job-search"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search title or company"
                type="search"
                value={searchInput}
              />

              <label className="sr-only" htmlFor="location-search">
                Location
              </label>

              <input
                className="border-border focus:border-primary focus:ring-primary/20 h-10 min-w-0 rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                id="location-search"
                onChange={(event) => setLocationInput(event.target.value)}
                placeholder="Country, state, province, or city"
                type="search"
                value={locationInput}
              />

              <button
                className="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-sm font-semibold transition hover:opacity-90"
                type="submit"
              >
                Search
              </button>
            </form>

            <div className="grid gap-5 lg:grid-cols-2">
              <fieldset>
                <legend className="text-foreground mb-2 text-sm font-medium">Match score</legend>

                <div className="flex flex-wrap gap-2">
                  {MATCH_SCORE_OPTIONS.map((option) => (
                    <label
                      className="border-border bg-background text-foreground hover:bg-muted flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition"
                      key={option.label}
                    >
                      <input
                        checked={initialFilters.minMatchScore === option.value}
                        className="accent-primary h-4 w-4"
                        name="min-match-score"
                        onChange={() => updateMinMatchScore(option.value)}
                        type="radio"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="text-foreground grid gap-2 text-sm font-medium">
                Sort results
                <div className="flex h-10 gap-2">
                  <select
                    className="border-border bg-background focus:border-primary focus:ring-primary/20 h-10 flex-1 rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                    onChange={(event) =>
                      updateSort(event.target.value, initialFilters.sortDirection)
                    }
                    value={initialFilters.sort}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <button
                    aria-label={
                      initialFilters.sortDirection === "desc"
                        ? "Switch to ascending order"
                        : "Switch to descending order"
                    }
                    className="border-border bg-background text-foreground hover:bg-muted h-10 shrink-0 rounded-lg border px-3 text-sm font-semibold transition"
                    onClick={toggleSortDirection}
                    type="button"
                  >
                    {initialFilters.sortDirection === "desc" ? "↓ Desc" : "↑ Asc"}
                  </button>
                </div>
              </label>

              <fieldset>
                <legend className="text-foreground mb-2 text-sm font-medium">Providers</legend>
                <div className="flex flex-wrap gap-2">
                  {PROVIDER_OPTIONS.map((option) => (
                    <label
                      className="border-border bg-background text-foreground hover:bg-muted flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition"
                      key={option.value}
                    >
                      <input
                        checked={initialFilters.sources.includes(option.value)}
                        className="accent-primary h-4 w-4"
                        onChange={() => toggleProvider(option.value)}
                        type="checkbox"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-foreground mb-2 text-sm font-medium">Workplace type</legend>
                <div className="flex flex-wrap gap-2">
                  {WORKPLACE_OPTIONS.map((option) => (
                    <label
                      className="border-border bg-background text-foreground hover:bg-muted flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition"
                      key={option.value}
                    >
                      <input
                        checked={initialFilters.workplaceTypes.includes(option.value)}
                        className="accent-primary h-4 w-4"
                        onChange={() => toggleWorkplaceType(option.value)}
                        type="checkbox"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="lg:col-span-2">
                <legend className="text-foreground mb-2 text-sm font-medium">
                  My tracking status
                </legend>
                <div className="flex flex-wrap gap-2">
                  {APPLICATION_STATUS_OPTIONS.map((option) => (
                    <label
                      className="border-border bg-background text-foreground hover:bg-muted flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition"
                      key={option.value}
                    >
                      <input
                        checked={initialFilters.applicationStatuses.includes(option.value)}
                        className="accent-primary h-4 w-4"
                        onChange={() => toggleApplicationStatus(option.value)}
                        type="checkbox"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="lg:col-span-2">
                <legend className="text-foreground mb-2 text-sm font-medium">
                  Added or posted
                </legend>
                <div className="flex flex-wrap gap-2">
                  {DATE_RANGE_OPTIONS.map((option) => (
                    <label
                      className="border-border bg-background text-foreground hover:bg-muted flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition"
                      key={option.value}
                    >
                      <input
                        checked={initialFilters.dateRange === option.value}
                        className="accent-primary h-4 w-4"
                        name="date-range"
                        onChange={() => updateDateRange(option.value)}
                        type="radio"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div>
              <p className="text-foreground mb-2 text-sm font-medium">Search directions</p>

              <div className="flex flex-wrap gap-2">
                {keywordGroups.map((group) => (
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      group.enabled
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                    key={group.id}
                  >
                    <button
                      aria-pressed={group.enabled}
                      onClick={() => toggleKeywordGroup(group.id)}
                      title={group.keywords.join(", ")}
                      type="button"
                    >
                      {group.label}
                    </button>
                    <button
                      aria-label={`Remove ${group.label}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeKeywordGroup(group.id)}
                      type="button"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {keywordGroups.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No search directions yet. Add one below.
                  </p>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  className="border-border focus:border-primary focus:ring-primary/20 h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none focus:ring-2"
                  onChange={(event) => setNewGroupLabel(event.target.value)}
                  placeholder="Direction name, e.g. MLOps"
                  type="text"
                  value={newGroupLabel}
                />

                <input
                  className="border-border focus:border-primary focus:ring-primary/20 h-10 min-w-0 flex-[2] rounded-lg border px-3 text-sm outline-none focus:ring-2"
                  list="keyword-suggestions"
                  onChange={(event) => setNewGroupKeywords(event.target.value)}
                  placeholder="Keywords, comma separated: mlops, ml platform"
                  type="text"
                  value={newGroupKeywords}
                />

                <datalist id="keyword-suggestions">
                  {suggestions.map((suggestion) => (
                    <option key={suggestion.value} value={suggestion.value} />
                  ))}
                </datalist>

                <button
                  className="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-sm font-semibold transition hover:opacity-90"
                  onClick={addKeywordGroup}
                  type="button"
                >
                  Add direction
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Jobs</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Page {initialPage} of {totalPages}
              </p>
            </div>

            <p className="text-muted-foreground text-sm">
              Results are filtered, sorted, and paginated by the API.
            </p>
          </div>

          {totalJobs === 0 ? (
            <div className="border-border bg-card rounded-2xl border border-dashed p-8 text-center shadow-sm">
              <h3 className="text-lg font-semibold">No jobs match these filters</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Try removing a filter, changing your search, or sync another company source.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {initialJobs.map((job) => {
                const applicationState = applicationStates[job.id];
                const isUpdating = updatingJobId === job.id;

                return (
                  <article
                    className="border-border bg-card rounded-2xl border p-5 shadow-sm"
                    key={job.id}
                  >
                    <div className="flex flex-col justify-between gap-5 lg:flex-row">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">{job.title}</h3>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${sourceBadgeClass(
                              job.source
                            )}`}
                          >
                            {providerLabel(job.source)}
                          </span>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${scoreBadgeClass(
                              job.match_score
                            )}`}
                          >
                            Match: {job.match_score ?? "—"}
                          </span>

                          {applicationState ? (
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${trackingBadgeClass(
                                applicationState.status
                              )}`}
                            >
                              {trackingLabel(applicationState.status)}
                            </span>
                          ) : null}
                        </div>

                        <p className="text-foreground mt-2 text-sm font-medium">
                          {job.company_name}
                        </p>

                        <dl className="text-muted-foreground mt-4 grid gap-3 text-sm sm:grid-cols-3">
                          <div>
                            <dt className="text-foreground font-medium">Location</dt>
                            <dd className="mt-1">{job.location ?? "Not specified"}</dd>
                          </div>
                          <div>
                            <dt className="text-foreground font-medium">Work type</dt>
                            <dd className="mt-1">{formatWorkplaceType(job.workplace_type)}</dd>
                          </div>
                          <div>
                            <dt className="text-foreground font-medium">
                              {job.posted_at ? "Posted" : "Added or posted"}
                            </dt>
                            <dd className="mt-1">
                              {formatDate(job.posted_at ?? job.first_seen_at)}
                            </dd>
                          </div>
                        </dl>

                        {applicationState?.applied_at ? (
                          <p className="text-muted-foreground mt-3 text-sm">
                            Applied {formatDate(applicationState.applied_at)}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap content-start gap-2 lg:max-w-80 lg:justify-end">
                        <a
                          className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition"
                          href={job.application_url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          View posting
                        </a>

                        <label className="sr-only" htmlFor={`application-status-${job.id}`}>
                          Tracking status for {job.title}
                        </label>
                        <select
                          className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 rounded-lg border px-3 py-2 text-sm font-semibold transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isLoadingStates || isUpdating}
                          id={`application-status-${job.id}`}
                          onChange={(event) => {
                            const status = event.target.value as ApplicationStatus;
                            if (status) {
                              void updateApplicationStatus(job.id, status);
                            }
                          }}
                          value={applicationState?.status ?? ""}
                        >
                          <option disabled value="">
                            {isUpdating ? "Updating..." : "Track job"}
                          </option>
                          {APPLICATION_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <button
                          className="border-border bg-background text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isLoadingStates || isUpdating}
                          onClick={() => openApplicationDetails(job.id)}
                          type="button"
                        >
                          Details
                        </button>

                        {applicationState ? (
                          <button
                            className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isLoadingStates || isUpdating}
                            onClick={() => void removeApplicationTracking(job.id)}
                            type="button"
                          >
                            {isUpdating ? "Updating..." : "Remove tracking"}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {editingJobId === job.id ? (
                      <div className="border-border mt-5 grid gap-3 border-t pt-5 sm:grid-cols-2">
                        <label className="text-foreground grid gap-2 text-sm font-medium">
                          Resume version
                          <select
                            className="border-border bg-background h-10 rounded-lg border px-3 text-sm font-normal"
                            onChange={(event) => setDraftResumeId(event.target.value)}
                            value={draftResumeId}
                          >
                            <option value="">No resume linked</option>
                            {resumes.map((resume) => (
                              <option key={resume.id} value={resume.id}>
                                {resume.label ?? resume.filename}
                                {resume.is_default ? " (Default)" : ""}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-foreground grid gap-2 text-sm font-medium sm:row-span-2">
                          Notes
                          <textarea
                            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 min-h-24 rounded-lg border px-3 py-2 text-sm font-normal outline-none focus:ring-2"
                            onChange={(event) => setDraftNotes(event.target.value)}
                            placeholder="Add context, contacts, or next steps"
                            value={draftNotes}
                          />
                        </label>

                        <div className="flex flex-wrap items-end gap-2">
                          <button
                            className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isUpdating}
                            onClick={() => saveApplicationDetails(job.id)}
                            type="button"
                          >
                            Save details
                          </button>
                          <button
                            className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition"
                            onClick={() => setEditingJobId(null)}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <nav
              aria-label="Job pagination"
              className="border-border bg-card mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 shadow-sm"
            >
              <p className="text-muted-foreground text-sm">
                Showing {firstJobNumber}–{lastJobNumber} of {totalJobs} jobs
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="border-border text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={initialPage === 1}
                  onClick={() => goToPage(initialPage - 1)}
                  type="button"
                >
                  Previous
                </button>

                {visiblePages[0] && visiblePages[0] > 1 ? (
                  <>
                    <button
                      className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition"
                      onClick={() => goToPage(1)}
                      type="button"
                    >
                      1
                    </button>
                    {visiblePages[0] > 2 ? (
                      <span className="text-muted-foreground px-1 text-sm">…</span>
                    ) : null}
                  </>
                ) : null}

                {visiblePages.map((page) => (
                  <button
                    aria-current={page === initialPage ? "page" : undefined}
                    className={`min-w-10 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      page === initialPage
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    }`}
                    key={page}
                    onClick={() => goToPage(page)}
                    type="button"
                  >
                    {page}
                  </button>
                ))}

                {visiblePages.at(-1) && visiblePages.at(-1)! < totalPages ? (
                  <>
                    {visiblePages.at(-1)! < totalPages - 1 ? (
                      <span className="text-muted-foreground px-1 text-sm">…</span>
                    ) : null}
                    <button
                      className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition"
                      onClick={() => goToPage(totalPages)}
                      type="button"
                    >
                      {totalPages}
                    </button>
                  </>
                ) : null}

                <button
                  className="border-border text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={initialPage === totalPages}
                  onClick={() => goToPage(initialPage + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}
