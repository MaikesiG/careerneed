"use client";

import { FormEvent, useMemo, useState } from "react";

type Provider = "ashby" | "greenhouse" | "lever" | "custom" | "manual";
type Priority = "high" | "medium" | "low";

type Company = {
  id: string;
  name: string;
  source_type: string;
  priority: string;
  active: boolean;
};

type SyncResult = {
  company?: string;
  fetched?: number;
  created?: number;
  skipped?: number;
  error?: string;
};

type SyncAllResult = {
  companies_synced: number;
  results: SyncResult[];
};

type SourcesClientProps = {
  initialCompanies: Company[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const PROVIDER_OPTIONS: Array<{
  value: Provider;
  label: string;
  tokenLabel: string;
  tokenHint: string;
  needsToken: boolean;
}> = [
  {
    value: "ashby",
    label: "Ashby",
    tokenLabel: "Job board token",
    tokenHint: "From https://jobs.ashbyhq.com/{token}",
    needsToken: true,
  },
  {
    value: "greenhouse",
    label: "Greenhouse",
    tokenLabel: "Board token",
    tokenHint: "From https://job-boards.greenhouse.io/{token}",
    needsToken: true,
  },
  {
    value: "lever",
    label: "Lever",
    tokenLabel: "Company slug",
    tokenHint: "From https://jobs.lever.co/{slug}",
    needsToken: true,
  },
  {
    value: "custom",
    label: "Custom",
    tokenLabel: "Optional token",
    tokenHint: "Optional identifier for a custom source",
    needsToken: false,
  },
  {
    value: "manual",
    label: "Manual",
    tokenLabel: "Optional token",
    tokenHint: "Optional identifier for manually tracked companies",
    needsToken: false,
  },
];

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

function providerLabel(provider: string): string {
  return PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
}

function providerBadgeClass(provider: string): string {
  if (provider === "greenhouse") {
    return "border-success-border bg-success-background text-success";
  }

  if (provider === "manual") {
    return "border-warning-border bg-warning-background text-warning";
  }

  if (provider === "ashby" || provider === "lever") {
    return "border-primary/30 bg-primary/10 text-primary";
  }

  return "border-border bg-muted text-muted-foreground";
}

function priorityBadgeClass(priority: string): string {
  if (priority === "high") {
    return "border-error-border bg-error-background text-destructive";
  }

  if (priority === "low") {
    return "border-border bg-muted text-muted-foreground";
  }

  return "border-warning-border bg-warning-background text-warning";
}

export default function SourcesClient({ initialCompanies }: SourcesClientProps) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [provider, setProvider] = useState<Provider>("ashby");
  const [companyName, setCompanyName] = useState("");
  const [boardToken, setBoardToken] = useState("");
  const [careersUrl, setCareersUrl] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  const [isAdding, setIsAdding] = useState(false);
  const [syncingCompanyId, setSyncingCompanyId] = useState<string | null>(null);
  const [syncingProvider, setSyncingProvider] = useState<Provider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);

  const providerConfig = useMemo(
    () => PROVIDER_OPTIONS.find((option) => option.value === provider) ?? PROVIDER_OPTIONS[0],
    [provider]
  );

  const connectorProviders = useMemo(() => ["ashby", "greenhouse", "lever"] as Provider[], []);

  function clearFeedback() {
    setError(null);
    setNotice(null);
  }

  async function refreshCompanies() {
    setIsRefreshing(true);

    try {
      const response = await fetch(`${API_URL}/companies`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Unable to refresh company sources."));
      }

      setCompanies((await response.json()) as Company[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to refresh company sources."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleAddCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setSyncResults([]);

    const normalizedName = companyName.trim();
    const normalizedToken = boardToken.trim();

    if (!normalizedName) {
      setError("Company name is required.");
      return;
    }

    if (providerConfig.needsToken && !normalizedToken) {
      setError(`${providerConfig.tokenLabel} is required for ${providerConfig.label}.`);
      return;
    }

    setIsAdding(true);

    try {
      const response = await fetch(`${API_URL}/companies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: normalizedName,
          source_type: provider,
          board_token: normalizedToken || null,
          careers_url: careersUrl.trim() || null,
          priority,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Unable to add company source."));
      }

      const company = (await response.json()) as Company;
      setCompanies((previous) =>
        [...previous, company].sort((left, right) => left.name.localeCompare(right.name))
      );

      setCompanyName("");
      setBoardToken("");
      setCareersUrl("");
      setPriority("medium");
      setNotice(`${company.name} was added as a ${providerLabel(company.source_type)} source.`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to add company source."
      );
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSyncCompany(company: Company) {
    if (
      company.source_type !== "ashby" &&
      company.source_type !== "greenhouse" &&
      company.source_type !== "lever"
    ) {
      setError(`${company.name} does not use a supported job-board connector.`);
      return;
    }

    clearFeedback();
    setSyncResults([]);
    setSyncingCompanyId(company.id);

    const params = new URLSearchParams({
      company_name: company.name,
    });

    if (company.source_type === "lever") {
      params.set("company_slug", "");
    } else {
      params.set("board_token", "");
    }

    setError(
      "This first version needs board tokens in the company list response before per-company sync can run. Use Sync all for now; the next backend update will expose board_token safely."
    );
    setSyncingCompanyId(null);
  }

  async function handleSyncAll(nextProvider: Provider) {
    clearFeedback();
    setSyncResults([]);
    setSyncingProvider(nextProvider);

    try {
      const response = await fetch(`${API_URL}/connectors/${nextProvider}/sync-all`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await readError(response, `Unable to sync ${providerLabel(nextProvider)} sources.`)
        );
      }

      const result = (await response.json()) as SyncAllResult;
      setSyncResults(result.results);
      setNotice(
        `${providerLabel(nextProvider)} sync finished for ${result.companies_synced} source${
          result.companies_synced === 1 ? "" : "s"
        }.`
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to sync ${providerLabel(nextProvider)} sources.`
      );
    } finally {
      setSyncingProvider(null);
    }
  }

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
            CareerNeed
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Company sources</h1>
          <p className="text-muted-foreground mt-3 max-w-3xl">
            Track company job boards from Ashby, Greenhouse, and Lever. Add a verified board token,
            sync the source, and search its jobs from the Jobs dashboard.
          </p>
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
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Add a company source</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Use the token or slug from the company’s public careers URL. Do not enter API keys.
            </p>
          </div>

          <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleAddCompany}>
            <label className="text-foreground grid gap-2 text-sm font-medium">
              Provider
              <select
                className="border-border bg-background focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                disabled={isAdding}
                onChange={(event) => setProvider(event.target.value as Provider)}
                value={provider}
              >
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-foreground grid gap-2 text-sm font-medium">
              Company name
              <input
                className="border-border focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                disabled={isAdding}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="e.g. Vanta"
                type="text"
                value={companyName}
              />
            </label>

            <label className="text-foreground grid gap-2 text-sm font-medium">
              {providerConfig.tokenLabel}
              <input
                className="border-border focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                disabled={isAdding}
                onChange={(event) => setBoardToken(event.target.value)}
                placeholder={
                  provider === "ashby"
                    ? "e.g. vanta"
                    : provider === "greenhouse"
                      ? "e.g. company-token"
                      : provider === "lever"
                        ? "e.g. company-slug"
                        : "Optional"
                }
                required={providerConfig.needsToken}
                type="text"
                value={boardToken}
              />
              <span className="text-muted-foreground text-xs font-normal">
                {providerConfig.tokenHint}
              </span>
            </label>

            <label className="text-foreground grid gap-2 text-sm font-medium">
              Careers URL
              <input
                className="border-border focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                disabled={isAdding}
                onChange={(event) => setCareersUrl(event.target.value)}
                placeholder="https://jobs.ashbyhq.com/vanta"
                type="url"
                value={careersUrl}
              />
            </label>

            <label className="text-foreground grid gap-2 text-sm font-medium">
              Priority
              <select
                className="border-border bg-background focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                disabled={isAdding}
                onChange={(event) => setPriority(event.target.value as Priority)}
                value={priority}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                className="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isAdding}
                type="submit"
              >
                {isAdding ? "Adding..." : "Add source"}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Tracked sources</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {companies.length} company source{companies.length === 1 ? "" : "s"} tracked.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {connectorProviders.map((nextProvider) => (
                <button
                  className="border-border bg-background text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={syncingProvider !== null}
                  key={nextProvider}
                  onClick={() => void handleSyncAll(nextProvider)}
                  type="button"
                >
                  {syncingProvider === nextProvider
                    ? `Syncing ${providerLabel(nextProvider)}...`
                    : `Sync all ${providerLabel(nextProvider)}`}
                </button>
              ))}

              <button
                className="border-border bg-background text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isRefreshing}
                onClick={() => void refreshCompanies()}
                type="button"
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="border-border bg-card mt-4 overflow-hidden rounded-2xl border shadow-sm">
            {companies.length === 0 ? (
              <div className="p-8 text-center">
                <h3 className="text-lg font-semibold">No company sources yet</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  Add an Ashby, Greenhouse, or Lever company board above.
                </p>
              </div>
            ) : (
              <div className="divide-border divide-y">
                {companies.map((company) => (
                  <article
                    className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                    key={company.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold">{company.name}</h3>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${providerBadgeClass(
                            company.source_type
                          )}`}
                        >
                          {providerLabel(company.source_type)}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityBadgeClass(
                            company.priority
                          )}`}
                        >
                          {company.priority} priority
                        </span>
                        {!company.active ? (
                          <span className="border-border bg-muted text-muted-foreground rounded-full border px-2.5 py-1 text-xs font-semibold">
                            Inactive
                          </span>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground mt-2 text-sm">
                        {company.active
                          ? "Included in provider sync-all runs."
                          : "Excluded from provider sync-all runs."}
                      </p>
                    </div>

                    <button
                      className="border-border bg-card text-foreground hover:bg-muted w-full rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      disabled={syncingCompanyId !== null}
                      onClick={() => void handleSyncCompany(company)}
                      type="button"
                    >
                      {syncingCompanyId === company.id ? "Syncing..." : "Sync this source"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {syncResults.length > 0 ? (
          <section className="border-border bg-card mt-8 rounded-2xl border p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Latest sync results</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-border text-muted-foreground border-b">
                  <tr>
                    <th className="px-3 py-2 font-medium">Company</th>
                    <th className="px-3 py-2 font-medium">Fetched</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium">Skipped</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {syncResults.map((result, index) => (
                    <tr
                      className="border-border border-b last:border-0"
                      key={`${result.company}-${index}`}
                    >
                      <td className="px-3 py-3 font-medium">{result.company ?? "Unknown"}</td>
                      <td className="px-3 py-3">{result.fetched ?? "—"}</td>
                      <td className="px-3 py-3">{result.created ?? "—"}</td>
                      <td className="px-3 py-3">{result.skipped ?? "—"}</td>
                      <td
                        className={
                          result.error ? "text-destructive px-3 py-3" : "text-success px-3 py-3"
                        }
                      >
                        {result.error ?? "Completed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
