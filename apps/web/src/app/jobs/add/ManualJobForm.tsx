"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type FormValues = {
  company_name: string;
  title: string;
  location: string;
  workplace_type: string;
  description: string;
  application_url: string;
  source_url: string;
};

const initialValues: FormValues = {
  company_name: "",
  title: "",
  location: "",
  workplace_type: "",
  description: "",
  application_url: "",
  source_url: "",
};

const fieldClassName =
  "mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function ManualJobForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const companyName = values.company_name.trim();
    const title = values.title.trim();
    const applicationUrl = values.application_url.trim();

    if (!companyName || !title || !applicationUrl) {
      setError("Company name, job title, and application URL are required.");
      return;
    }

    const payload = {
      company_name: companyName,
      title,
      location: values.location.trim() || null,
      workplace_type: values.workplace_type || null,
      description: values.description.trim() || null,
      application_url: applicationUrl,
      source_url: values.source_url.trim() || null,
    };

    setIsSubmitting(true);

    try {
      const response = await apiFetch("/jobs/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        router.replace("/login?next=/jobs/manual");
        return;
      }

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const detail =
          typeof body === "object" &&
          body !== null &&
          "detail" in body &&
          typeof body.detail === "string"
            ? body.detail
            : `Could not add the job (HTTP ${response.status}).`;

        throw new Error(detail);
      }

      router.replace("/jobs?source=manual");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not add the job.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="text-foreground block text-sm font-medium">
          Company name <span className="text-cyan-400">*</span>
          <input
            className={fieldClassName}
            name="company_name"
            type="text"
            autoComplete="organization"
            value={values.company_name}
            onChange={(event) => updateValue("company_name", event.target.value)}
            placeholder="e.g. Stripe"
            required
          />
        </label>

        <label className="text-foreground block text-sm font-medium">
          Job title <span className="text-cyan-400">*</span>
          <input
            className={fieldClassName}
            name="title"
            type="text"
            value={values.title}
            onChange={(event) => updateValue("title", event.target.value)}
            placeholder="e.g. Software Engineer"
            required
          />
        </label>
      </div>

      <label className="text-foreground block text-sm font-medium">
        Application URL <span className="text-cyan-400">*</span>
        <input
          className={fieldClassName}
          name="application_url"
          type="url"
          value={values.application_url}
          onChange={(event) => updateValue("application_url", event.target.value)}
          placeholder="https://company.com/careers/job-id"
          required
        />
        <span className="text-muted-foreground mt-2 block text-xs font-normal">
          The link you would use to apply for this role.
        </span>
      </label>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="text-foreground block text-sm font-medium">
          Location
          <input
            className={fieldClassName}
            name="location"
            type="text"
            value={values.location}
            onChange={(event) => updateValue("location", event.target.value)}
            placeholder="e.g. New York, NY or Remote, US"
          />
        </label>

        <label className="text-foreground block text-sm font-medium">
          Workplace type
          <select
            className={fieldClassName}
            name="workplace_type"
            value={values.workplace_type}
            onChange={(event) => updateValue("workplace_type", event.target.value)}
          >
            <option value="">Unknown</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="on-site">On-site</option>
          </select>
        </label>
      </div>

      <label className="text-foreground block text-sm font-medium">
        Job description
        <textarea
          className={fieldClassName}
          name="description"
          rows={8}
          value={values.description}
          onChange={(event) => updateValue("description", event.target.value)}
          placeholder="Paste the job description to get a more useful match score."
        />
      </label>

      <label className="text-foreground block text-sm font-medium">
        Source URL
        <input
          className={fieldClassName}
          name="source_url"
          type="url"
          value={values.source_url}
          onChange={(event) => updateValue("source_url", event.target.value)}
          placeholder="https://linkedin.com/jobs/view/..."
        />
        <span className="text-muted-foreground mt-2 block text-xs font-normal">
          Optional: where you originally found the role.
        </span>
      </label>

      {error && (
        <div
          className="border-error-border bg-error-background text-destructive rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <button
          className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => router.replace("/jobs")}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Adding job…" : "Add to job pool"}
        </button>
      </div>
    </form>
  );
}
