"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

type Category = {
  id: string;
  label: string;
};

type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";

type ApplicationState = {
  id: string;
  job_id: string;
  resume_id: string | null;
  status: ApplicationStatus;
  applied_at: string | null;
};

type ApplicationStateResponse = {
  states: Record<string, ApplicationState>;
};

type JobFilters = {
  q: string;
  source: string;
  workplaceType: string;
  categories: string[];
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

const CATEGORIES: Category[] = [
  { id: "mlops", label: "MLOps / AI Infrastructure" },
  { id: "hardware", label: "Hardware / Distributed Systems" },
  { id: "sre", label: "Site Reliability Engineer" },
  { id: "platform", label: "Platform Engineer" },
  { id: "software", label: "Software Engineer" },
  { id: "ai-agent", label: "AI Agent Engineer" },
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
  const [applicationStates, setApplicationStates] = useState<Record<string, ApplicationState>>({});
  const [isLoadingStates, setIsLoadingStates] = useState(true);
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  function clearFeedback() {
    setError(null);
    setNotice(null);
  }

  function navigateWithFilters(next: {
    page?: number;
    q?: string;
    source?: string;
    workplaceType?: string;
    categories?: string[];
  }) {
    const params = new URLSearchParams(searchParams.toString());

    const page = next.page ?? 1;
    const q = next.q ?? initialFilters.q;
    const source = next.source ?? initialFilters.source;
    const workplaceType = next.workplaceType ?? initialFilters.workplaceType;
    const categories = next.categories ?? initialFilters.categories;

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

    if (source) {
      params.set("source", source);
    } else {
      params.delete("source");
    }

    if (workplaceType) {
      params.set("workplace_type", workplaceType);
    } else {
      params.delete("workplace_type");
    }

    params.delete("category");
    categories.forEach((category) => {
      params.append("category", category);
    });

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    navigateWithFilters({
      page: 1,
      q: searchInput,
    });
  }

  function toggleCategory(categoryId: string) {
    const nextCategories = initialFilters.categories.includes(categoryId)
      ? initialFilters.categories.filter((id) => id !== categoryId)
      : [...initialFilters.categories, categoryId];

    navigateWithFilters({
      page: 1,
      categories: nextCategories,
    });
  }

  function clearFilters() {
    setSearchInput("");

    navigateWithFilters({
      page: 1,
      q: "",
      source: "",
      workplaceType: "",
      categories: [],
    });
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages || page === initialPage) {
      return;
    }

    navigateWithFilters({
      page,
    });
  }

  function refreshJobs() {
    clearFeedback();
    setIsRefreshing(true);
    router.refresh();

    window.setTimeout(() => {
      setIsRefreshing(false);
    }, 300);
  }

  async function updateApplicationStatus(jobId: string, status: ApplicationStatus) {
    clearFeedback();
    setUpdatingJobId(jobId);

    try {
      const response = await fetch(`${API_URL}/applications/by-job/${jobId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
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

          <button
            className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isRefreshing}
            onClick={refreshJobs}
            type="button"
          >
            {isRefreshing ? "Refreshing..." : "Refresh jobs"}
          </button>
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
                initialFilters.source ||
                initialFilters.workplaceType ||
                initialFilters.categories.length > 0) && (
                <button
                  className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                  onClick={clearFilters}
                  type="button"
                >
                  Clear all filters
                </button>
              )}
            </div>
            <form className="flex gap-2" onSubmit={handleSearch}>
              <input
                className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search title, company, or location"
                type="search"
                value={searchInput}
              />
              <button
                className="h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
                type="submit"
              >
                Search
              </button>
            </form>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Provider
                <div className="relative">
                  <select
                    className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    onChange={(event) =>
                      navigateWithFilters({
                        page: 1,
                        source: event.target.value,
                      })
                    }
                    value={initialFilters.source}
                  >
                    <option value="">All providers</option>
                    <option value="ashby">Ashby</option>
                    <option value="greenhouse">Greenhouse</option>
                    <option value="lever">Lever</option>
                    <option value="manual">Manual</option>
                  </select>

                  <svg
                    className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Workplace type
                <div className="relative">
                  <select
                    className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    onChange={(event) =>
                      navigateWithFilters({
                        page: 1,
                        workplaceType: event.target.value,
                      })
                    }
                    value={initialFilters.workplaceType}
                  >
                    <option value="">All workplace types</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                  </select>

                  <svg
                    className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06l-4.25-4.51a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Role category</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => {
                  const isActive = initialFilters.categories.includes(category.id);

                  return (
                    <button
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        isActive
                          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      type="button"
                    >
                      {category.label}
                    </button>
                  );
                })}
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

            <p className="text-sm text-slate-500">Results are filtered and paginated by the API.</p>
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
                            <dd className="mt-1">{job.workplace_type ?? "Not specified"}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-700">Posted</dt>
                            <dd className="mt-1">{formatDate(job.posted_at)}</dd>
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

                        <button
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            applicationState?.status === "saved"
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border-slate-300 text-slate-700 hover:bg-slate-50"
                          }`}
                          disabled={isLoadingStates || isUpdating}
                          onClick={() => void updateApplicationStatus(job.id, "saved")}
                          type="button"
                        >
                          {isUpdating ? "Updating..." : "Save"}
                        </button>

                        <button
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            applicationState?.status === "applied"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-300 text-slate-700 hover:bg-slate-50"
                          }`}
                          disabled={isLoadingStates || isUpdating}
                          onClick={() => void updateApplicationStatus(job.id, "applied")}
                          type="button"
                        >
                          {isUpdating ? "Updating..." : "Mark applied"}
                        </button>

                        <button
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            applicationState?.status === "withdrawn"
                              ? "border-slate-300 bg-slate-100 text-slate-700"
                              : "border-slate-300 text-slate-700 hover:bg-slate-50"
                          }`}
                          disabled={isLoadingStates || isUpdating}
                          onClick={() => void updateApplicationStatus(job.id, "withdrawn")}
                          type="button"
                        >
                          {isUpdating ? "Updating..." : "Not interested"}
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
