"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Resume = {
  id: string;
  filename: string;
  skills: string | null;
  label: string | null;
  is_default: boolean;
  archived_at: string | null;
  source: string | null;
  uploaded_at: string;
};

type ResumeUpdate = {
  label?: string | null;
  is_default?: boolean;
  archived_at?: string | null;
};

import { apiFetch, getApiErrorMessage } from "@/lib/api";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ResumesClient() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [makeDefaultOnUpload, setMakeDefaultOnUpload] = useState(false);

  const visibleResumes = useMemo(() => {
    if (showArchived) {
      return resumes;
    }

    return resumes.filter((resume) => resume.archived_at === null);
  }, [resumes, showArchived]);

  function clearFeedback() {
    setError(null);
    setNotice(null);
  }

  async function loadResumes(includeArchived: boolean) {
    setIsRefreshing(true);

    try {
      const response = await apiFetch(`/resumes?include_archived=${includeArchived}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Unable to load resumes."));
      }

      setResumes((await response.json()) as Resume[]);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load resumes.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function refreshCurrentList() {
    await loadResumes(showArchived);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialResumes() {
      try {
        const response = await apiFetch("/resumes?include_archived=false", {
          cache: "no-store",
        });

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response, "Unable to load resumes."));
        }

        setResumes((await response.json()) as Resume[]);
        setError(null);
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load resumes.");
        }
      }
    }

    void loadInitialResumes();

    return () => {
      cancelled = true;
    };
  }, []);

  async function updateResume(resumeId: string, update: ResumeUpdate, successMessage: string) {
    setActiveActionId(resumeId);
    clearFeedback();

    try {
      const response = await apiFetch(`/resumes/${resumeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(update),
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Unable to update resume."));
      }

      setNotice(successMessage);
      await refreshCurrentList();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update resume.");
    } finally {
      setActiveActionId(null);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("Choose a PDF file before uploading.");
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }

    setIsUploading(true);
    clearFeedback();

    const formData = new FormData();
    formData.append("file", file);

    if (uploadLabel.trim()) {
      formData.append("label", uploadLabel.trim());
    }

    formData.append("is_default", String(makeDefaultOnUpload));

    try {
      const response = await apiFetch("/resumes/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Unable to upload resume."));
      }

      setFile(null);
      setUploadLabel("");
      setMakeDefaultOnUpload(false);
      setNotice("Resume uploaded successfully.");

      const fileInput = document.getElementById("resume-file") as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      await refreshCurrentList();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to upload resume.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  async function handleRename(resume: Resume) {
    const nextLabel = window.prompt(
      "Enter a label for this resume. Leave it blank to remove the label.",
      resume.label ?? ""
    );

    if (nextLabel === null) {
      return;
    }

    await updateResume(resume.id, { label: nextLabel.trim() || null }, "Resume label updated.");
  }

  async function handleDelete(resume: Resume) {
    const confirmed = window.confirm(
      `Permanently delete "${resume.label ?? resume.filename}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setActiveActionId(resume.id);
    clearFeedback();

    try {
      const response = await apiFetch(`/resumes/${resume.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Unable to delete resume."));
      }

      setNotice("Resume deleted.");
      await refreshCurrentList();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete resume.");
    } finally {
      setActiveActionId(null);
    }
  }

  async function handleArchivedToggle(nextShowArchived: boolean) {
    clearFeedback();
    setShowArchived(nextShowArchived);
    await loadResumes(nextShowArchived);
  }

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
            CareerNeed
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Resume management</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            Upload tailored resumes, choose one active default resume, and archive versions you no
            longer want included in your job-search workflow.
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
            <h2 className="text-lg font-semibold">Upload a resume</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              PDF only. The API extracts its text and skills after upload.
            </p>
          </div>

          <form
            className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
            onSubmit={handleUpload}
          >
            <div className="text-foreground grid gap-2 text-sm font-medium">
              <span>PDF file</span>

              <label
                className={`border-border bg-background text-muted-foreground flex h-10 w-full items-center rounded-lg border px-1.5 text-sm font-normal ${
                  isUploading
                    ? "cursor-not-allowed opacity-60"
                    : "hover:border-primary cursor-pointer"
                }`}
                htmlFor="resume-file"
              >
                <span className="bg-primary/10 text-primary flex h-8 shrink-0 items-center rounded-md px-3 text-sm font-semibold">
                  Choose file
                </span>

                <span className="ml-3 truncate">{file ? file.name : "No file chosen"}</span>
              </label>

              <input
                id="resume-file"
                accept="application/pdf,.pdf"
                className="sr-only"
                disabled={isUploading}
                onChange={handleFileChange}
                type="file"
              />
            </div>

            <label className="text-foreground grid gap-2 text-sm font-medium">
              Label
              <input
                className="border-border focus:border-primary focus:ring-primary/20 h-10 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-2"
                disabled={isUploading}
                onChange={(event) => setUploadLabel(event.target.value)}
                placeholder="e.g. Backend / SRE / AI"
                type="text"
                value={uploadLabel}
              />
            </label>

            <div className="flex flex-wrap items-center gap-4">
              <label className="text-foreground flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  checked={makeDefaultOnUpload}
                  className="border-border text-primary h-4 w-4 rounded focus:ring-indigo-500"
                  disabled={isUploading}
                  onChange={(event) => setMakeDefaultOnUpload(event.target.checked)}
                  type="checkbox"
                />
                Make default
              </label>

              <button
                className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isUploading}
                type="submit"
              >
                {isUploading ? "Uploading..." : "Upload resume"}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Your resumes</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Your default resume will be used as the initial profile for future job workflows.
              </p>
            </div>

            <label className="text-foreground flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                checked={showArchived}
                className="border-border text-primary h-4 w-4 rounded focus:ring-indigo-500"
                disabled={isRefreshing}
                onChange={(event) => void handleArchivedToggle(event.target.checked)}
                type="checkbox"
              />
              Show archived
            </label>
          </div>

          {isRefreshing ? (
            <div className="border-border bg-card text-muted-foreground rounded-2xl border p-8 text-sm shadow-sm">
              Refreshing resumes...
            </div>
          ) : null}

          {!isRefreshing && visibleResumes.length === 0 ? (
            <div className="border-border bg-background rounded-2xl border border-dashed p-8 text-center shadow-sm">
              <h3 className="text-lg font-semibold">No resumes to show</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Upload a PDF resume above, or enable “Show archived” to view archived versions.
              </p>
            </div>
          ) : null}

          {!isRefreshing && visibleResumes.length > 0 ? (
            <div className="grid gap-4">
              {visibleResumes.map((resume) => {
                const isArchived = resume.archived_at !== null;
                const isBusy = activeActionId === resume.id;

                return (
                  <article
                    className="border-border bg-card rounded-2xl border p-5 shadow-sm"
                    key={resume.id}
                  >
                    <div className="flex flex-col justify-between gap-5 lg:flex-row">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-semibold">
                            {resume.label ?? resume.filename}
                          </h3>

                          {resume.is_default ? (
                            <span className="border-primary/30 bg-primary/10 text-primary rounded-full border px-2.5 py-1 text-xs font-semibold">
                              Default
                            </span>
                          ) : null}

                          {isArchived ? (
                            <span className="border-border bg-muted text-muted-foreground rounded-full border px-2.5 py-1 text-xs font-semibold">
                              Archived
                            </span>
                          ) : null}
                        </div>

                        {resume.label ? (
                          <p className="text-muted-foreground mt-1 truncate text-sm">
                            {resume.filename}
                          </p>
                        ) : null}

                        <dl className="text-muted-foreground mt-4 grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-foreground font-medium">Uploaded</dt>
                            <dd className="mt-1">{formatDate(resume.uploaded_at)}</dd>
                          </div>
                          <div>
                            <dt className="text-foreground font-medium">Source</dt>
                            <dd className="mt-1">{resume.source ?? "Unknown"}</dd>
                          </div>
                          {isArchived && resume.archived_at ? (
                            <div>
                              <dt className="text-foreground font-medium">Archived</dt>
                              <dd className="mt-1">{formatDate(resume.archived_at)}</dd>
                            </div>
                          ) : null}
                        </dl>

                        <div className="mt-4">
                          <p className="text-foreground text-sm font-medium">Extracted skills</p>
                          <p className="text-muted-foreground mt-1 text-sm leading-6">
                            {resume.skills ?? "No skills were extracted from this resume."}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap content-start gap-2 lg:max-w-52 lg:justify-end">
                        <button
                          className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isBusy}
                          onClick={() => void handleRename(resume)}
                          type="button"
                        >
                          Rename
                        </button>

                        {!isArchived && !resume.is_default ? (
                          <button
                            className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isBusy}
                            onClick={() =>
                              void updateResume(
                                resume.id,
                                { is_default: true },
                                "Default resume updated."
                              )
                            }
                            type="button"
                          >
                            Set default
                          </button>
                        ) : null}

                        {isArchived ? (
                          <button
                            className="border-success-border bg-success-background text-success rounded-lg border px-3 py-2 text-sm font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isBusy}
                            onClick={() =>
                              void updateResume(
                                resume.id,
                                { archived_at: null },
                                "Resume restored."
                              )
                            }
                            type="button"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            className="border-warning-border bg-warning-background text-warning rounded-lg border px-3 py-2 text-sm font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isBusy}
                            onClick={() =>
                              void updateResume(
                                resume.id,
                                { archived_at: new Date().toISOString() },
                                "Resume archived."
                              )
                            }
                            type="button"
                          >
                            Archive
                          </button>
                        )}

                        <button
                          className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isBusy}
                          onClick={() => void handleDelete(resume)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
