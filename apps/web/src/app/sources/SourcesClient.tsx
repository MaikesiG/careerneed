"use client";

import { apiFetch, getApiErrorMessage } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import curatedTargets from "@/data/curated-targets.json";

type Provider = "ashby" | "greenhouse" | "lever" | "custom" | "manual";
type Priority = "high" | "medium" | "low";

type Company = {
  id: string;
  name: string;
  source_type: string;
  board_token?: string | null;
  careers_url?: string | null;
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

type CuratedTargetsPreview = {
  total_curated: number;
  to_create: number;
  already_present: number;
};

type CuratedTargetsAddAllResult = {
  created: number;
  already_present: number;
  total_curated: number;
};

type CompanySourceSyncResult = {
  status: "synced" | "failed";
  jobs_created?: number | null;
  jobs_updated?: number | null;
  message?: string | null;
};

type PresetCompany = {
  name: string;
  source_type: Provider;
  board_token: string;
  careers_url: string;
  category: "AI" | "Tech";
};

function presetCategory(value: string): PresetCompany["category"] {
  if (value === "AI" || value === "Tech") return value;
  throw new Error(`Unsupported curated target category: ${value}`);
}

const VERIFIED_PRESETS: PresetCompany[] = [
  // Frontier AI
  {
    name: "Anthropic",
    source_type: "greenhouse",
    board_token: "anthropic",
    careers_url: "https://job-boards.greenhouse.io/anthropic",
    category: "AI",
  },
  {
    name: "OpenAI",
    source_type: "ashby",
    board_token: "openai",
    careers_url: "https://jobs.ashbyhq.com/openai",
    category: "AI",
  },
  {
    name: "Scale AI",
    source_type: "greenhouse",
    board_token: "scaleai",
    careers_url: "https://job-boards.greenhouse.io/scaleai",
    category: "AI",
  },
  {
    name: "Cursor",
    source_type: "ashby",
    board_token: "anysphere",
    careers_url: "https://jobs.ashbyhq.com/anysphere",
    category: "AI",
  },
  {
    name: "Cohere",
    source_type: "greenhouse",
    board_token: "cohere",
    careers_url: "https://job-boards.greenhouse.io/cohere",
    category: "AI",
  },

  // High-growth & Core Tech
  {
    name: "Stripe",
    source_type: "greenhouse",
    board_token: "stripe",
    careers_url: "https://job-boards.greenhouse.io/stripe",
    category: "Tech",
  },
  {
    name: "Figma",
    source_type: "greenhouse",
    board_token: "figma",
    careers_url: "https://job-boards.greenhouse.io/figma",
    category: "Tech",
  },
  {
    name: "Databricks",
    source_type: "greenhouse",
    board_token: "databricks",
    careers_url: "https://job-boards.greenhouse.io/databricks",
    category: "Tech",
  },
  {
    name: "Notion",
    source_type: "ashby",
    board_token: "notion",
    careers_url: "https://jobs.ashbyhq.com/notion",
    category: "Tech",
  },
  {
    name: "Vanta",
    source_type: "ashby",
    board_token: "vanta",
    careers_url: "https://jobs.ashbyhq.com/vanta",
    category: "Tech",
  },
  {
    name: "Ramp",
    source_type: "ashby",
    board_token: "ramp",
    careers_url: "https://jobs.ashbyhq.com/ramp",
    category: "Tech",
  },
  {
    name: "Linear",
    source_type: "ashby",
    board_token: "linear",
    careers_url: "https://jobs.ashbyhq.com/linear",
    category: "Tech",
  },
  {
    name: "Retool",
    source_type: "ashby",
    board_token: "retool",
    careers_url: "https://jobs.ashbyhq.com/retool",
    category: "Tech",
  },
  {
    name: "Discord",
    source_type: "greenhouse",
    board_token: "discord",
    careers_url: "https://job-boards.greenhouse.io/discord",
    category: "Tech",
  },
  {
    name: "Airbnb",
    source_type: "greenhouse",
    board_token: "airbnb",
    careers_url: "https://job-boards.greenhouse.io/airbnb",
    category: "Tech",
  },
  {
    name: "Netflix",
    source_type: "lever",
    board_token: "netflix",
    careers_url: "https://jobs.lever.co/netflix",
    category: "Tech",
  },
  {
    name: "Spotify",
    source_type: "lever",
    board_token: "spotify",
    careers_url: "https://jobs.lever.co/spotify",
    category: "Tech",
  },
  {
    name: "Palantir",
    source_type: "lever",
    board_token: "palantir",
    careers_url: "https://jobs.lever.co/palantir",
    category: "Tech",
  },
  {
    name: "Deel",
    source_type: "ashby",
    board_token: "deel",
    careers_url: "https://jobs.ashbyhq.com/deel",
    category: "Tech",
  },
  {
    name: "Roblox",
    source_type: "greenhouse",
    board_token: "roblox",
    careers_url: "https://job-boards.greenhouse.io/roblox",
    category: "Tech",
  },
];

const POPULAR_PRESETS: PresetCompany[] = curatedTargets.map((target) => {
  const verifiedPreset = VERIFIED_PRESETS.find((preset) => preset.name === target.name);
  return (
    verifiedPreset ?? {
      name: target.name,
      source_type: "manual",
      board_token: "",
      careers_url: "",
      category: presetCategory(target.category),
    }
  );
});

type SourcesClientProps = {
  initialCompanies: Company[];
};

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

function providerLabel(provider: string): string {
  return PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
}

function providerBadgeClass(provider: string): string {
  if (provider === "greenhouse") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (provider === "manual") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  if (provider === "ashby" || provider === "lever") {
    return "border-primary/30 bg-primary/10 text-primary";
  }
  return "border-border bg-muted text-muted-foreground";
}

function priorityBadgeClass(priority: string): string {
  if (priority === "high") {
    return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400";
  }
  if (priority === "low") {
    return "border-border bg-muted text-muted-foreground";
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
}

function capitalizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function SourcesClient({ initialCompanies }: SourcesClientProps) {
  const router = useRouter();

  // Navigation tab: company boards vs manual job links
  const [activeTab, setActiveTab] = useState<"companies" | "manual_jobs">("companies");

  // Companies state
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [provider, setProvider] = useState<Provider>("ashby");
  const [companyName, setCompanyName] = useState("");
  const [boardToken, setBoardToken] = useState("");
  const [careersUrl, setCareersUrl] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  const [isAdding, setIsAdding] = useState(false);
  const [addingPresetName, setAddingPresetName] = useState<string | null>(null);
  const [syncingCompanyId, setSyncingCompanyId] = useState<string | null>(null);
  const [syncingProvider, setSyncingProvider] = useState<Provider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [curatedPreview, setCuratedPreview] = useState<CuratedTargetsPreview | null>(null);
  const [isPreviewingCurated, setIsPreviewingCurated] = useState(false);
  const [isAddingAllCurated, setIsAddingAllCurated] = useState(false);
  const [isAddAllDialogOpen, setIsAddAllDialogOpen] = useState(false);
  const addAllInFlightRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);

  // Preset filter category
  const [presetCategory, setPresetCategory] = useState<"All" | "AI" | "Tech">("All");

  // Manual Job Link State
  const [jobLinkUrl, setJobLinkUrl] = useState("");
  const [jobCompany, setJobCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [jobWorkplaceType, setJobWorkplaceType] = useState("remote");
  const [jobDescription, setJobDescription] = useState("");
  const [jobNotes, setJobNotes] = useState("");
  const [isAddingJob, setIsAddingJob] = useState(false);
  const [addedJobNotice, setAddedJobNotice] = useState<string | null>(null);

  const providerConfig = useMemo(
    () => PROVIDER_OPTIONS.find((option) => option.value === provider) ?? PROVIDER_OPTIONS[0],
    [provider]
  );

  const connectorProviders = useMemo(() => ["ashby", "greenhouse", "lever"] as Provider[], []);

  function clearFeedback() {
    setError(null);
    setNotice(null);
    setAddedJobNotice(null);
  }

  function handleUnauthenticated() {
    router.replace("/login?next=/sources");
  }

  // Auto-detect provider and token from careersUrl
  function handleCareersUrlChange(url: string) {
    setCareersUrl(url);
    const trimmed = url.trim();

    // Check Ashby
    const ashbyMatch = trimmed.match(/jobs\.ashbyhq\.com\/([^/?#]+)/i);
    if (ashbyMatch && ashbyMatch[1]) {
      setProvider("ashby");
      setBoardToken(ashbyMatch[1]);
      if (!companyName) {
        setCompanyName(capitalizeSlug(ashbyMatch[1]));
      }
      return;
    }

    // Check Greenhouse
    const ghMatch = trimmed.match(/(?:job-boards|boards)\.greenhouse\.io\/([^/?#]+)/i);
    if (ghMatch && ghMatch[1]) {
      setProvider("greenhouse");
      setBoardToken(ghMatch[1]);
      if (!companyName) {
        setCompanyName(capitalizeSlug(ghMatch[1]));
      }
      return;
    }

    // Check Lever
    const leverMatch = trimmed.match(/jobs\.lever\.co\/([^/?#]+)/i);
    if (leverMatch && leverMatch[1]) {
      setProvider("lever");
      setBoardToken(leverMatch[1]);
      if (!companyName) {
        setCompanyName(capitalizeSlug(leverMatch[1]));
      }
    }
  }

  // Auto-detect company name from job link
  function handleJobLinkChange(url: string) {
    setJobLinkUrl(url);
    const trimmed = url.trim();

    if (!jobCompany) {
      const ashbyMatch = trimmed.match(/jobs\.ashbyhq\.com\/([^/?#]+)/i);
      if (ashbyMatch && ashbyMatch[1]) {
        setJobCompany(capitalizeSlug(ashbyMatch[1]));
        return;
      }
      const ghMatch = trimmed.match(/(?:job-boards|boards)\.greenhouse\.io\/([^/?#]+)/i);
      if (ghMatch && ghMatch[1]) {
        setJobCompany(capitalizeSlug(ghMatch[1]));
        return;
      }
      const leverMatch = trimmed.match(/jobs\.lever\.co\/([^/?#]+)/i);
      if (leverMatch && leverMatch[1]) {
        setJobCompany(capitalizeSlug(leverMatch[1]));
      }
    }
  }

  async function refreshCompanies() {
    setIsRefreshing(true);
    try {
      const response = await apiFetch("/companies", {
        cache: "no-store",
      });

      if (response.status === 401) {
        handleUnauthenticated();
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Unable to refresh company sources."));
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
      const response = await apiFetch(`/companies`, {
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

      if (response.status === 401) {
        handleUnauthenticated();
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Unable to add company source."));
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

  // 1-Click Quick Add Preset
  async function handleQuickAddPreset(preset: PresetCompany) {
    clearFeedback();
    setAddingPresetName(preset.name);

    try {
      const response = await apiFetch(`/companies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: preset.name,
          source_type: preset.source_type,
          board_token: preset.board_token || null,
          careers_url: preset.careers_url || null,
          priority: "high",
        }),
      });

      if (response.status === 401) {
        handleUnauthenticated();
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, `Unable to add ${preset.name}.`));
      }

      const company = (await response.json()) as Company;
      setCompanies((previous) =>
        [...previous, company].sort((left, right) => left.name.localeCompare(right.name))
      );
      setNotice(`Added ${preset.name} (${providerLabel(preset.source_type)}) to tracked sources.`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : `Unable to add ${preset.name}.`
      );
    } finally {
      setAddingPresetName(null);
    }
  }

  async function handlePreviewCuratedTargets() {
    if (isPreviewingCurated || isAddingAllCurated) return;
    clearFeedback();
    setIsPreviewingCurated(true);

    try {
      const response = await apiFetch("/companies/curated-targets/preview", {
        cache: "no-store",
      });

      if (response.status === 401) {
        handleUnauthenticated();
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Unable to preview curated targets."));
      }

      const preview = (await response.json()) as CuratedTargetsPreview;
      setCuratedPreview(preview);
      if (preview.to_create === 0) {
        setNotice("All curated targets are already in your list.");
        return;
      }
      setIsAddAllDialogOpen(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to preview curated targets."
      );
    } finally {
      setIsPreviewingCurated(false);
    }
  }

  async function handleAddAllCuratedTargets() {
    if (!curatedPreview || addAllInFlightRef.current) return;
    addAllInFlightRef.current = true;
    setIsAddingAllCurated(true);
    clearFeedback();

    try {
      const response = await apiFetch("/companies/curated-targets/add-all", {
        method: "POST",
      });

      if (response.status === 401) {
        handleUnauthenticated();
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Unable to add curated targets."));
      }

      const result = (await response.json()) as CuratedTargetsAddAllResult;
      setIsAddAllDialogOpen(false);
      setCuratedPreview({
        total_curated: result.total_curated,
        to_create: 0,
        already_present: result.total_curated,
      });
      await refreshCompanies();
      setNotice(
        `Added ${result.created} curated targets. ${result.already_present} were already present.`
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to add curated targets."
      );
    } finally {
      addAllInFlightRef.current = false;
      setIsAddingAllCurated(false);
    }
  }

  // Per-company Sync
  async function handleSyncCompany(company: Company) {
    clearFeedback();
    setSyncResults([]);
    setSyncingCompanyId(company.id);

    try {
      const response = await apiFetch(`/companies/${company.id}/sync`, {
        method: "POST",
      });

      if (response.status === 401) {
        handleUnauthenticated();
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, `Unable to sync ${company.name}.`));
      }

      const result = (await response.json()) as CompanySourceSyncResult;
      if (result.status === "failed") {
        setError(result.message ?? "The source could not be synchronized. Please try again later.");
        return;
      }
      setNotice(
        `Synced ${company.name}: ${result.jobs_created ?? 0} new jobs added, ${result.jobs_updated ?? 0} up to date.`
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : `Unable to sync ${company.name}.`
      );
    } finally {
      setSyncingCompanyId(null);
    }
  }

  async function handleSyncAll(nextProvider: Provider) {
    clearFeedback();
    setSyncResults([]);
    setSyncingProvider(nextProvider);

    try {
      const response = await apiFetch(`/connectors/${nextProvider}/sync-all`, {
        method: "POST",
      });

      if (response.status === 401) {
        handleUnauthenticated();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `Unable to sync ${providerLabel(nextProvider)} sources.`
          )
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

  // Handle manual job link submission
  async function handleAddManualJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const normalizedUrl = jobLinkUrl.trim();
    const normalizedCompany = jobCompany.trim();
    const normalizedTitle = jobTitle.trim();

    if (!normalizedUrl || !normalizedCompany || !normalizedTitle) {
      setError("Application URL, Company name, and Job title are required.");
      return;
    }

    setIsAddingJob(true);

    try {
      const response = await apiFetch("/jobs/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: normalizedCompany,
          title: normalizedTitle,
          location: jobLocation.trim() || null,
          workplace_type: jobWorkplaceType || null,
          description: jobDescription.trim() || null,
          application_url: normalizedUrl,
          source_url: normalizedUrl,
          notes: jobNotes.trim() || "Added from Sources link entry",
        }),
      });

      if (response.status === 401) {
        handleUnauthenticated();
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Unable to add job link."));
      }

      setAddedJobNotice(
        `"${normalizedTitle}" at ${normalizedCompany} has been added to your Job pool and saved in your Applications!`
      );
      setJobLinkUrl("");
      setJobCompany("");
      setJobTitle("");
      setJobLocation("");
      setJobDescription("");
      setJobNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add job link.");
    } finally {
      setIsAddingJob(false);
    }
  }

  const isPresetTracked = (preset: PresetCompany) => {
    return companies.some(
      (c) =>
        c.name.toLowerCase() === preset.name.toLowerCase() ||
        (c.board_token && c.board_token.toLowerCase() === preset.board_token.toLowerCase())
    );
  };

  const filteredPresets = POPULAR_PRESETS.filter((p) => {
    if (presetCategory === "All") return true;
    return p.category === presetCategory;
  });

  return (
    <PageContainer size="default">
      <PageHeader
        title="Sources"
        description="Configure automated job boards (Ashby, Greenhouse, Lever) or paste individual job links found on LinkedIn, company sites, and referrals."
      >
        <div
          role="tablist"
          aria-label="Source views"
          className="border-border flex flex-wrap border-b"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "companies"}
            onClick={() => setActiveTab("companies")}
            className={`focus-visible:ring-primary border-b-2 px-3 py-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:outline-none sm:px-4 sm:text-sm ${
              activeTab === "companies"
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            🏢 Tracked Companies & ATS Boards ({companies.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "manual_jobs"}
            onClick={() => setActiveTab("manual_jobs")}
            className={`focus-visible:ring-primary border-b-2 px-3 py-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:outline-none sm:px-4 sm:text-sm ${
              activeTab === "manual_jobs"
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            🔗 Add Individual Job Link
          </button>
        </div>
      </PageHeader>

      {error ? (
        <div
          className="border-destructive/30 bg-destructive/10 text-destructive mb-6 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm"
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
          className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400"
          role="status"
        >
          <p>{notice}</p>
          <button
            aria-label="Dismiss notification"
            className="shrink-0 font-semibold hover:opacity-80"
            onClick={() => setNotice(null)}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}

      {activeTab === "companies" ? (
        <>
          {/* Section 1: Quick Add Popular Companies */}
          <section className="border-border bg-card mb-8 rounded-2xl border p-5 shadow-xs sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <h2 className="text-lg font-bold">Curated Target Companies</h2>
                </div>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  Build a personal target list. Connector badges identify only presets with an
                  already configured source; manual targets do not imply current openings.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="border-border bg-muted/40 inline-flex h-8 items-center rounded-lg border p-1 text-xs">
                  {(["All", "AI", "Tech"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      title={
                        cat === "AI"
                          ? "AI & Infrastructure"
                          : cat === "Tech"
                            ? "Platform & Enterprise"
                            : "All target companies"
                      }
                      onClick={() => setPresetCategory(cat)}
                      className={`rounded-md px-2.5 py-1 font-semibold transition ${
                        presetCategory === cat
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void handlePreviewCuratedTargets()}
                  disabled={
                    isPreviewingCurated || isAddingAllCurated || curatedPreview?.to_create === 0
                  }
                  className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 inline-flex h-8 shrink-0 items-center justify-center rounded-lg border px-3 text-xs font-semibold whitespace-nowrap transition"
                >
                  {curatedPreview?.to_create === 0
                    ? "All added"
                    : isPreviewingCurated
                      ? "Checking…"
                      : "Add all"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filteredPresets.map((preset) => {
                const tracked = isPresetTracked(preset);
                const isBeingAdded = addingPresetName === preset.name;

                return (
                  <div
                    key={preset.name}
                    className={`border-border bg-muted/20 flex flex-col justify-between rounded-xl border p-3 transition ${
                      tracked ? "opacity-75" : "hover:border-primary/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-foreground text-sm font-bold">{preset.name}</span>
                        <span
                          className={`py-0.2 rounded-full border px-1.5 text-[10px] font-semibold uppercase ${providerBadgeClass(
                            preset.source_type
                          )}`}
                        >
                          {preset.source_type}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 truncate text-[11px]">
                        {preset.board_token ? `token: ${preset.board_token}` : "Curated target"}
                      </p>
                    </div>

                    <div className="mt-3">
                      {tracked ? (
                        <span className="block w-full rounded-md border border-emerald-500/30 bg-emerald-500/10 py-1 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          ✓ Tracked
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isBeingAdded}
                          onClick={() => handleQuickAddPreset(preset)}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md py-1 text-xs font-semibold shadow-xs transition disabled:opacity-50"
                        >
                          {isBeingAdded ? "Adding…" : "+ Quick Add"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 2: Custom Company Source Form */}
          <section className="border-border bg-card mb-8 rounded-2xl border p-5 shadow-xs sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Add a Custom Company Source</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Paste any company’s career URL (e.g. <code>https://jobs.ashbyhq.com/vanta</code> or{" "}
                <code>https://job-boards.greenhouse.io/anthropic</code>). It will automatically
                detect the provider and token.
              </p>
            </div>

            <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleAddCompany}>
              <label className="text-foreground grid gap-2 text-sm font-medium">
                Careers URL (Paste to auto-detect provider & token)
                <input
                  className="border-border focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                  disabled={isAdding}
                  onChange={(event) => handleCareersUrlChange(event.target.value)}
                  placeholder="https://jobs.ashbyhq.com/vanta or https://job-boards.greenhouse.io/anthropic"
                  type="url"
                  value={careersUrl}
                />
                <span className="text-muted-foreground text-xs font-normal">
                  Auto-fills provider, token, and company name when pasted.
                </span>
              </label>

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
                Company name *
                <input
                  className="border-border focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                  disabled={isAdding}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="e.g. Vanta"
                  type="text"
                  value={companyName}
                  required
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
                        ? "e.g. anthropic"
                        : provider === "lever"
                          ? "e.g. netflix"
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

              <div className="flex items-end lg:col-span-2">
                <button
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-lg px-4 text-xs font-semibold shadow-xs transition disabled:opacity-50 sm:h-10 sm:text-sm"
                  disabled={isAdding}
                  type="submit"
                >
                  {isAdding ? "Adding source…" : "Add company source"}
                </button>
              </div>
            </form>
          </section>

          {/* Section 3: Tracked Sources List */}
          <section className="border-border bg-card rounded-2xl border p-5 shadow-xs sm:p-6">
            <div className="border-border flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold sm:text-lg">Tracked company sources</h2>
                <p className="text-muted-foreground text-sm">
                  {companies.length} company source{companies.length === 1 ? "" : "s"} currently
                  tracked.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {connectorProviders.map((syncableProvider) => (
                  <button
                    key={syncableProvider}
                    className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-primary inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-9"
                    disabled={syncingProvider !== null || syncingCompanyId !== null}
                    onClick={() => handleSyncAll(syncableProvider)}
                    type="button"
                  >
                    {syncingProvider === syncableProvider
                      ? `Syncing ${providerLabel(syncableProvider)}…`
                      : `Sync all ${providerLabel(syncableProvider)}`}
                  </button>
                ))}

                <button
                  className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-primary inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-9"
                  disabled={isRefreshing}
                  onClick={refreshCompanies}
                  type="button"
                >
                  {isRefreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>

            {syncResults.length > 0 ? (
              <div className="border-border bg-muted/30 my-4 rounded-xl border p-4 text-xs">
                <p className="text-foreground font-semibold">Sync run breakdown:</p>
                <ul className="mt-2 space-y-1">
                  {syncResults.map((result, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      <strong className="text-foreground">{result.company ?? "Unknown"}:</strong>{" "}
                      {result.error
                        ? `Error: ${result.error}`
                        : `Fetched ${result.fetched ?? 0}, created ${result.created ?? 0}, skipped ${result.skipped ?? 0}`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {companies.length === 0 ? (
              <div className="border-border text-muted-foreground mt-6 rounded-xl border border-dashed p-8 text-center text-sm">
                No company sources added yet. Use the quick-add buttons above or enter a custom job
                board URL.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="border-border bg-card hover:border-primary/40 flex flex-col justify-between rounded-xl border p-4 shadow-xs transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-foreground text-base font-bold">{company.name}</h3>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${providerBadgeClass(
                            company.source_type
                          )}`}
                        >
                          {providerLabel(company.source_type)}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span
                          className={`rounded-full border px-2 py-0.5 font-semibold ${priorityBadgeClass(
                            company.priority
                          )}`}
                        >
                          {company.priority} priority
                        </span>
                        {company.board_token && (
                          <span
                            className="text-muted-foreground truncate"
                            title={company.board_token}
                          >
                            token: {company.board_token}
                          </span>
                        )}
                      </div>

                      {company.careers_url ? (
                        <a
                          href={company.careers_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary mt-2.5 block truncate text-xs hover:underline"
                        >
                          {company.careers_url} ↗
                        </a>
                      ) : null}
                    </div>

                    <div className="border-border mt-4 flex items-center justify-between border-t pt-3">
                      <span className="text-muted-foreground text-xs">
                        {company.source_type in { ashby: 1, greenhouse: 1, lever: 1 }
                          ? "Auto-syncable"
                          : "Manual tracking"}
                      </span>

                      {company.source_type in { ashby: 1, greenhouse: 1, lever: 1 } ? (
                        <button
                          type="button"
                          onClick={() => handleSyncCompany(company)}
                          disabled={syncingCompanyId === company.id || syncingProvider !== null}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-xs transition disabled:opacity-50"
                        >
                          {syncingCompanyId === company.id ? "Syncing…" : "Sync this source"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        /* Tab 2: Manual Job Link Entry */
        <section className="border-border bg-card rounded-2xl border p-5 shadow-xs sm:p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔗</span>
              <h2 className="text-base font-semibold sm:text-lg">
                Track an individual job by link
              </h2>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Found an interesting posting on LinkedIn, a company careers page, or through a friend?
              Add it directly to your job pool and personal application pipeline.
            </p>
          </div>

          {addedJobNotice ? (
            <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
              <p className="font-semibold">{addedJobNotice}</p>
              <div className="mt-3 flex gap-3">
                <Link href="/jobs" className="text-primary text-xs font-semibold underline">
                  View in Jobs Dashboard →
                </Link>
                <Link href="/applications" className="text-primary text-xs font-semibold underline">
                  View in Applications Board →
                </Link>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleAddManualJob} className="space-y-4">
            <div>
              <label className="text-foreground block text-sm font-medium">
                Job Link / Application URL *
              </label>
              <input
                type="url"
                value={jobLinkUrl}
                onChange={(e) => handleJobLinkChange(e.target.value)}
                placeholder="https://jobs.ashbyhq.com/company/job-id or https://linkedin.com/jobs/view/..."
                className="border-border focus:border-primary focus:ring-primary/20 mt-1 h-10 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                required
              />
              <span className="text-muted-foreground mt-1 block text-xs">
                We’ll automatically extract the company name if it’s hosted on Ashby, Greenhouse, or
                Lever.
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-foreground block text-sm font-medium">Company Name *</label>
                <input
                  type="text"
                  value={jobCompany}
                  onChange={(e) => setJobCompany(e.target.value)}
                  placeholder="e.g. Stripe"
                  className="border-border focus:border-primary focus:ring-primary/20 mt-1 h-10 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                  required
                />
              </div>

              <div>
                <label className="text-foreground block text-sm font-medium">Job Title *</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Staff Backend Engineer"
                  className="border-border focus:border-primary focus:ring-primary/20 mt-1 h-10 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-foreground block text-sm font-medium">Location</label>
                <input
                  type="text"
                  value={jobLocation}
                  onChange={(e) => setJobLocation(e.target.value)}
                  placeholder="e.g. Remote, US or San Francisco, CA"
                  className="border-border focus:border-primary focus:ring-primary/20 mt-1 h-10 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                />
              </div>

              <div>
                <label className="text-foreground block text-sm font-medium">Workplace Type</label>
                <select
                  value={jobWorkplaceType}
                  onChange={(e) => setJobWorkplaceType(e.target.value)}
                  className="border-border bg-background focus:border-primary focus:ring-primary/20 mt-1 h-10 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                >
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="on-site">On-site</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-foreground block text-sm font-medium">
                Notes / Referral Context
              </label>
              <input
                type="text"
                value={jobNotes}
                onChange={(e) => setJobNotes(e.target.value)}
                placeholder="e.g. Found on LinkedIn, referral by teammate"
                className="border-border focus:border-primary focus:ring-primary/20 mt-1 h-10 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
              />
            </div>

            <div>
              <label className="text-foreground block text-sm font-medium">
                Job Description (optional)
              </label>
              <textarea
                rows={4}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste snippet or JD to help match scoring..."
                className="border-border focus:border-primary focus:ring-primary/20 mt-1 w-full rounded-lg border p-3 text-sm transition outline-none focus:ring-2"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isAddingJob}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-lg px-5 text-xs font-semibold shadow-xs transition disabled:opacity-50 sm:h-10 sm:text-sm"
              >
                {isAddingJob ? "Adding Job…" : "Add to Job Pool & Applications →"}
              </button>
            </div>
          </form>
        </section>
      )}

      <ConfirmDialog
        isOpen={isAddAllDialogOpen}
        title="Add curated targets?"
        description={
          curatedPreview ? (
            <div className="space-y-2">
              <p>
                {curatedPreview.to_create} curated targets will be added.{" "}
                {curatedPreview.already_present} already present will be skipped.
              </p>
              <p>
                New entries are user-owned manual targets. This does not sync jobs or access
                external job platforms.
              </p>
            </div>
          ) : null
        }
        confirmLabel={`Add ${curatedPreview?.to_create ?? 0} targets`}
        pendingLabel="Adding targets…"
        isDestructive={false}
        isLoading={isAddingAllCurated}
        onConfirm={handleAddAllCuratedTargets}
        onCancel={() => setIsAddAllDialogOpen(false)}
      />
    </PageContainer>
  );
}
