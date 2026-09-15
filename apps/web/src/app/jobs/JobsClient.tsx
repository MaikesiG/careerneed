"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

  if (normalizedSource === "ashby") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (normalizedSource === "greenhouse") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalizedSource === "lever") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (normalizedSource === "manual") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function scoreBadgeClass(score: number | null): string {
  if (score === null) {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  if (score >= 70) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (score >= 40) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function trackingBadgeClass(status: ApplicationStatus): string {
  if (status === "applied") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "saved") {
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  }

  if (status === "offer") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (status === "interviewing") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
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

function getErrorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "detail" in body &&
    typeof body.detail === "string"
  ) {
    return body.detail;
  }

  return fallback;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    return getErrorMessage(await response.json(), fallback);
  } catch {
    return fallback;
  }
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

        const response = await fetch(`${API_URL}/applications/me/job-states?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await readError(response, "Unable to load application tracking states."));
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
  }, [jobIds]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadResumes() {
      try {
        const response = await fetch(`${API_URL}/resumes`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await readError(response, "Unable to load resumes."));
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
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const lastToken = newGroupKeywords.split(",").pop()?.trim() ?? "";

    const timeoutId = window.setTimeout(() => {
      async function loadSuggestions() {
        try {
          const response = await fetch(
            `${API_URL}/jobs/keyword-suggestions?q=${encodeURIComponent(lastToken)}`,
            { signal: controller.signal }
          );

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
  }, [newGroupKeywords]);

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
    details?: { notes?: string; resumeId?: string | null }
  ) {
    clearFeedback();
    setUpdatingJobId(jobId);

    try {
      const response = await fetch(`${API_URL}/applications/by-job/${jobId}`, {
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

      if (!response.ok) {
        throw new Error(await readError(response, "Unable to update application tracking."));
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
      notes: draftNotes.trim() || undefined,
      resumeId: draftResumeId || null,
    });
  }

  async function removeApplicationTracking(jobId: string) {
    clearFeedback();
    setUpdatingJobId(jobId);

    try {
      const response = await fetch(`${API_URL}/applications/by-job/${jobId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Unable to remove application tracking."));
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
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-indigo-600 uppercase">
              CareerNeed
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Job dashboard</h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              Search and filter jobs across all synced Ashby, Greenhouse, and Lever company sources.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              className="h-10 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              href="/applications"
            >
              My applications
            </Link>
            <button
              className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            <p>{error}</p>
            <button
              aria-label="Dismiss error"
              className="shrink-0 font-semibold text-red-700 hover:text-red-900"
              onClick={() => setError(null)}
              type="button"
            >
              ×
            </button>
          </div>
        ) : null}

        {notice ? (
          <div
            className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            role="status"
          >
            <p>{notice}</p>
            <button
              aria-label="Dismiss notification"
              className="shrink-0 font-semibold text-emerald-700 hover:text-emerald-900"
              onClick={() => setNotice(null)}
              type="button"
            >
              ×
            </button>
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-lg font-semibold">Find relevant roles</h2>
                <p className="mt-1 text-sm text-slate-600">
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
                  className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
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
                className="h-10 min-w-0 rounded-lg border border-slate-300 px-3 text-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
                className="h-10 min-w-0 rounded-lg border border-slate-300 px-3 text-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                id="location-search"
                onChange={(event) => setLocationInput(event.target.value)}
                placeholder="Country, state, province, or city"
                type="search"
                value={locationInput}
              />

              <button
                className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
                type="submit"
              >
                Search
              </button>
            </form>

            <div className="grid gap-5 lg:grid-cols-2">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">Match score</legend>

                <div className="flex flex-wrap gap-2">
                  {MATCH_SCORE_OPTIONS.map((option) => (
                    <label
                      className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50"
                      key={option.label}
                    >
                      <input
                        checked={initialFilters.minMatchScore === option.value}
                        className="h-4 w-4 accent-indigo-600"
                        name="min-match-score"
                        onChange={() => updateMinMatchScore(option.value)}
                        type="radio"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Sort results
                <div className="flex h-10 gap-2">
                  <select
                    className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
                    className="h-10 shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    onClick={toggleSortDirection}
                    type="button"
                  >
                    {initialFilters.sortDirection === "desc" ? "↓ Desc" : "↑ Asc"}
                  </button>
                </div>
              </label>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">Providers</legend>
                <div className="flex flex-wrap gap-2">
                  {PROVIDER_OPTIONS.map((option) => (
                    <label
                      className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50"
                      key={option.value}
                    >
                      <input
                        checked={initialFilters.sources.includes(option.value)}
                        className="h-4 w-4 accent-indigo-600"
                        onChange={() => toggleProvider(option.value)}
                        type="checkbox"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">Workplace type</legend>
                <div className="flex flex-wrap gap-2">
                  {WORKPLACE_OPTIONS.map((option) => (
                    <label
                      className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50"
                      key={option.value}
                    >
                      <input
                        checked={initialFilters.workplaceTypes.includes(option.value)}
                        className="h-4 w-4 accent-indigo-600"
                        onChange={() => toggleWorkplaceType(option.value)}
                        type="checkbox"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="lg:col-span-2">
                <legend className="mb-2 text-sm font-medium text-slate-700">
                  My tracking status
                </legend>
                <div className="flex flex-wrap gap-2">
                  {APPLICATION_STATUS_OPTIONS.map((option) => (
                    <label
                      className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50"
                      key={option.value}
                    >
                      <input
                        checked={initialFilters.applicationStatuses.includes(option.value)}
                        className="h-4 w-4 accent-indigo-600"
                        onChange={() => toggleApplicationStatus(option.value)}
                        type="checkbox"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="lg:col-span-2">
                <legend className="mb-2 text-sm font-medium text-slate-700">Added or posted</legend>
                <div className="flex flex-wrap gap-2">
                  {DATE_RANGE_OPTIONS.map((option) => (
                    <label
                      className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50"
                      key={option.value}
                    >
                      <input
                        checked={initialFilters.dateRange === option.value}
                        className="h-4 w-4 accent-indigo-600"
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
              <p className="mb-2 text-sm font-medium text-slate-700">Search directions</p>

              <div className="flex flex-wrap gap-2">
                {keywordGroups.map((group) => (
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      group.enabled
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border-slate-300 bg-white text-slate-500"
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
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => removeKeywordGroup(group.id)}
                      type="button"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {keywordGroups.length === 0 ? (
                  <p className="text-sm text-slate-500">No search directions yet. Add one below.</p>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  onChange={(event) => setNewGroupLabel(event.target.value)}
                  placeholder="Direction name, e.g. MLOps"
                  type="text"
                  value={newGroupLabel}
                />

                <input
                  className="h-10 min-w-0 flex-[2] rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
                  className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
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
              <p className="mt-1 text-sm text-slate-600">
                Page {initialPage} of {totalPages}
              </p>
            </div>

            <p className="text-sm text-slate-500">
              Results are filtered, sorted, and paginated by the API.
            </p>
          </div>

          {totalJobs === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
              <h3 className="text-lg font-semibold">No jobs match these filters</h3>
              <p className="mt-2 text-sm text-slate-600">
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
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
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

                        <p className="mt-2 text-sm font-medium text-slate-700">
                          {job.company_name}
                        </p>

                        <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                          <div>
                            <dt className="font-medium text-slate-700">Location</dt>
                            <dd className="mt-1">{job.location ?? "Not specified"}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-700">Work type</dt>
                            <dd className="mt-1">{formatWorkplaceType(job.workplace_type)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-700">
                              {job.posted_at ? "Posted" : "Added or posted"}
                            </dt>
                            <dd className="mt-1">
                              {formatDate(job.posted_at ?? job.first_seen_at)}
                            </dd>
                          </div>
                        </dl>

                        {applicationState?.applied_at ? (
                          <p className="mt-3 text-sm text-slate-500">
                            Applied {formatDate(applicationState.applied_at)}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap content-start gap-2 lg:max-w-80 lg:justify-end">
                        <a
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
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
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isLoadingStates || isUpdating}
                          onClick={() => openApplicationDetails(job.id)}
                          type="button"
                        >
                          Details
                        </button>

                        {applicationState ? (
                          <button
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                      <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2">
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Resume version
                          <select
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal"
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

                        <label className="grid gap-2 text-sm font-medium text-slate-700 sm:row-span-2">
                          Notes
                          <textarea
                            className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
                            onChange={(event) => setDraftNotes(event.target.value)}
                            placeholder="Add context, contacts, or next steps"
                            value={draftNotes}
                          />
                        </label>

                        <div className="flex flex-wrap items-end gap-2">
                          <button
                            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isUpdating}
                            onClick={() => saveApplicationDetails(job.id)}
                            type="button"
                          >
                            Save details
                          </button>
                          <button
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
              className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-sm text-slate-600">
                Showing {firstJobNumber}–{lastJobNumber} of {totalJobs} jobs
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={initialPage === 1}
                  onClick={() => goToPage(initialPage - 1)}
                  type="button"
                >
                  Previous
                </button>

                {visiblePages[0] && visiblePages[0] > 1 ? (
                  <>
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      onClick={() => goToPage(1)}
                      type="button"
                    >
                      1
                    </button>
                    {visiblePages[0] > 2 ? (
                      <span className="px-1 text-sm text-slate-500">…</span>
                    ) : null}
                  </>
                ) : null}

                {visiblePages.map((page) => (
                  <button
                    aria-current={page === initialPage ? "page" : undefined}
                    className={`min-w-10 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      page === initialPage
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
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
                      <span className="px-1 text-sm text-slate-500">…</span>
                    ) : null}
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      onClick={() => goToPage(totalPages)}
                      type="button"
                    >
                      {totalPages}
                    </button>
                  </>
                ) : null}

                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
