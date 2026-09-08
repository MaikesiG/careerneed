"use client";

import { useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  company_name: string;
  source: string;
  source_type: string;
  title: string;
  location: string | null;
  workplace_type: string | null;
  application_url: string;
  status: string;
  match_score: number | null;
  posted_at: string | null;
  first_seen_at: string;
};

type Category = {
  label: string;
  keywords: string[];
};

const CATEGORIES: Category[] = [
  {
    label: "MLOps / AI Infrastructure",
    keywords: ["mlops", "ml infrastructure", "ai infrastructure", "ml platform", "ai platform"],
  },
  {
    label: "Hardware / Distributed Systems",
    keywords: ["kernel", "gpu", "tpu", "compiler", "distributed training", "cluster", "cuda"],
  },
  { label: "Site Reliability Engineer", keywords: ["site reliability", "sre"] },
  { label: "Platform Engineer", keywords: ["platform engineer", "infrastructure engineer"] },
  { label: "Software Engineer", keywords: ["software engineer", "backend engineer"] },
  {
    label: "AI Agent Engineer",
    keywords: ["ai agent", "agent engineer", "llm", "prompt engineering"],
  },
];

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  saved: "Saved",
  applied: "Applied",
  dismissed: "Dismissed",
};

export default function JobsDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    fetch(`${apiUrl}/jobs`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return response.json() as Promise<Job[]>;
      })
      .then((data) => {
        setJobs(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [apiUrl]);

  function toggleCategory(label: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  const filteredJobs = useMemo(() => {
    let result = jobs;

    if (selectedCategories.size > 0) {
      const activeKeywords = CATEGORIES.filter((c) => selectedCategories.has(c.label)).flatMap(
        (c) => c.keywords
      );
      result = result.filter((job) => {
        const text = `${job.title} ${job.company_name}`.toLowerCase();
        return activeKeywords.some((kw) => text.includes(kw));
      });
    }

    if (search.trim().length > 0) {
      const query = search.trim().toLowerCase();
      result = result.filter((job) =>
        `${job.title} ${job.company_name} ${job.location ?? ""}`.toLowerCase().includes(query)
      );
    }

    return [...result].sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));
  }, [jobs, search, selectedCategories]);

  async function updateStatus(jobId: string, status: string) {
    setActionError(null);
    try {
      const response = await fetch(`${apiUrl}/jobs/${jobId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(`Failed to update status: ${response.status}`);
      const updated = (await response.json()) as Job;
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: updated.status } : j)));
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function deleteJob(jobId: string) {
    setActionError(null);
    setPendingDeleteId(jobId);
    try {
      const response = await fetch(`${apiUrl}/jobs/${jobId}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        throw new Error(`Failed to delete job: ${response.status}`);
      }
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : "Failed to delete job");
    } finally {
      setPendingDeleteId(null);
    }
  }

  function scoreColor(score: number | null) {
    if (score === null) return "text-slate-400 border-slate-700";
    if (score >= 70) return "text-emerald-400 border-emerald-700";
    if (score >= 40) return "text-amber-300 border-amber-700";
    return "text-slate-400 border-slate-700";
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <section className="mx-auto max-w-5xl">
        <p className="mb-2 text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
          Careerneed · Jobs
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Job Dashboard</h1>
        <p className="mt-3 text-slate-400">
          {loading ? "Loading jobs…" : `${filteredJobs.length} of ${jobs.length} jobs shown`}
        </p>

        <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <input
            type="text"
            placeholder="Search by title, company, or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map((category) => {
              const active = selectedCategories.has(category.label);
              return (
                <button
                  key={category.label}
                  onClick={() => toggleCategory(category.label)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
                    active
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                      : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-lg border border-rose-800 bg-rose-950/40 p-4 text-rose-400">
            API unavailable: {error}
          </p>
        )}

        {actionError && (
          <p className="mt-6 rounded-lg border border-rose-800 bg-rose-950/40 p-4 text-rose-400">
            {actionError}
          </p>
        )}

        <div className="mt-6 space-y-3">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition hover:border-slate-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{job.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {job.company_name} · {job.location ?? "Location not specified"}
                  </p>
                </div>
                <div
                  className={`shrink-0 rounded-full border px-3 py-1 text-sm font-semibold ${scoreColor(
                    job.match_score
                  )}`}
                >
                  {job.match_score ?? "—"}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <a
                  href={job.application_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-cyan-700 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-300 hover:bg-cyan-500/20"
                >
                  View posting →
                </a>
                {["saved", "applied", "dismissed"].map((status) => (
                  <button
                    key={status}
                    onClick={() => updateStatus(job.id, status)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      job.status === status
                        ? "border-emerald-600 bg-emerald-500/10 text-emerald-300"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
                <button
                  onClick={() => deleteJob(job.id)}
                  disabled={pendingDeleteId === job.id}
                  className="ml-auto rounded-lg border border-rose-800 bg-rose-950/30 px-3 py-1.5 text-sm text-rose-400 transition hover:bg-rose-900/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingDeleteId === job.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ))}

          {!loading && filteredJobs.length === 0 && (
            <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-slate-400">
              No jobs match your current filters.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
