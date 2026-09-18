"use client";

import {
  apiFetch,
  ApplicationContact,
  ContactRelationshipType,
  isApplicationContact,
  isApplicationContactArray,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type ContactType = "recruiter" | "hiring_manager" | "interviewer" | "referral" | "other";

type ContactDraft = {
  name: string;
  contact_type: ContactType;
  email: string;
  linkedin_url: string;
  notes: string;
};

type ApplicationContactsEditorProps = {
  applicationId: string;
};

const EMPTY_DRAFT: ContactDraft = {
  name: "",
  contact_type: "other",
  email: "",
  linkedin_url: "",
  notes: "",
};

const CONTACT_TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: "recruiter", label: "Recruiter" },
  { value: "hiring_manager", label: "Hiring manager" },
  { value: "interviewer", label: "Interviewer" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

const CANONICAL_RELATIONSHIP_LABELS: Record<ContactRelationshipType, string> = {
  recruiter: "Recruiter",
  interviewer: "Interviewer",
  hiring_manager: "Hiring manager",
  referral: "Referral",
  networking: "Networking",
  other: "Other",
};

function contactTypeLabel(contactType: string): string {
  const option = CONTACT_TYPE_OPTIONS.find((candidate) => candidate.value === contactType);
  return option?.label ?? contactType;
}

function canonicalRelationshipLabel(type: ContactRelationshipType): string {
  return CANONICAL_RELATIONSHIP_LABELS[type] ?? type;
}

function isValidLinkedInUrl(value: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    const hostname = (parsed.hostname || "").toLowerCase();
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com"))
    );
  } catch {
    return false;
  }
}

function toDraft(contact: ApplicationContact): ContactDraft {
  const supportedType = CONTACT_TYPE_OPTIONS.some((option) => option.value === contact.contact_type)
    ? (contact.contact_type as ContactType)
    : "other";

  return {
    name: contact.name,
    contact_type: supportedType,
    email: contact.email ?? "",
    linkedin_url: contact.linkedin_url ?? "",
    notes: contact.notes ?? "",
  };
}

function draftPayload(draft: ContactDraft) {
  return {
    name: draft.name.trim(),
    contact_type: draft.contact_type,
    email: draft.email.trim() || null,
    linkedin_url: draft.linkedin_url.trim() || null,
    notes: draft.notes.trim() || null,
  };
}

export default function ApplicationContactsEditor({
  applicationId,
}: ApplicationContactsEditorProps) {
  const router = useRouter();
  const [contacts, setContacts] = useState<ApplicationContact[]>([]);
  const [draft, setDraft] = useState<ContactDraft>(EMPTY_DRAFT);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [convertingContactId, setConvertingContactId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadInFlightRef = useRef(false);
  const mountedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);

  const loadContacts = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (mountedRef.current && !hasLoadedRef.current) {
      setIsLoading(true);
      setError(null);
    }

    const encodedApplicationId = encodeURIComponent(applicationId);
    try {
      const response = await apiFetch(`/applications/${encodedApplicationId}/contacts`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (controller.signal.aborted || !mountedRef.current) return;

      if (response.status === 401) {
        router.replace(`/login?next=/applications/${encodedApplicationId}`);
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to load contacts.");
      }

      const data: unknown = await response.json();

      if (!isApplicationContactArray(data)) {
        throw new Error("Unable to load contacts.");
      }

      if (!controller.signal.aborted && mountedRef.current) {
        setContacts(data);
        hasLoadedRef.current = true;
      }
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
      if (!controller.signal.aborted && mountedRef.current) {
        setError("Unable to load contacts. Please try again.");
      }
    } finally {
      if (abortControllerRef.current === controller) {
        loadInFlightRef.current = false;
        if (!controller.signal.aborted && mountedRef.current) {
          setIsLoading(false);
        }
      }
    }
  }, [applicationId, router]);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadContacts();

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      loadInFlightRef.current = false;
    };
  }, [loadContacts]);

  useEffect(() => {
    function handleRefresh(event: Event) {
      const customEvent = event as CustomEvent<{ applicationId?: string }>;
      if (customEvent.detail?.applicationId === applicationId) {
        void loadContacts();
      }
    }

    window.addEventListener("careerneed:application-contacts-refresh", handleRefresh);
    return () => {
      window.removeEventListener("careerneed:application-contacts-refresh", handleRefresh);
    };
  }, [applicationId, loadContacts]);

  function updateDraft<Field extends keyof ContactDraft>(field: Field, value: ContactDraft[Field]) {
    setDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
    setError(null);
    setNotice(null);
  }

  function openCreateForm() {
    setDraft(EMPTY_DRAFT);
    setEditingContactId(null);
    setIsFormOpen(true);
    setError(null);
    setNotice(null);
  }

  function openEditForm(contact: ApplicationContact) {
    setDraft(toDraft(contact));
    setEditingContactId(contact.id);
    setIsFormOpen(true);
    setError(null);
    setNotice(null);
  }

  function closeForm() {
    if (isSaving) {
      return;
    }

    setDraft(EMPTY_DRAFT);
    setEditingContactId(null);
    setIsFormOpen(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = draftPayload(draft);

    if (!payload.name) {
      setError("Contact name is required.");
      return;
    }

    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    const encodedApplicationId = encodeURIComponent(applicationId);
    const isEditing = editingContactId !== null;
    const endpoint = isEditing
      ? `/applications/${encodedApplicationId}/contacts/${editingContactId}`
      : `/applications/${encodedApplicationId}/contacts`;

    try {
      const response = await apiFetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        router.replace(`/login?next=/applications/${encodedApplicationId}`);
        return;
      }

      if (!response.ok) {
        throw new Error(isEditing ? "Unable to update contact." : "Unable to add contact.");
      }

      const rawSaved: unknown = await response.json();
      if (!isApplicationContact(rawSaved)) {
        throw new Error(isEditing ? "Unable to update contact." : "Unable to add contact.");
      }

      setContacts((previous) => {
        if (!isEditing) {
          return [rawSaved, ...previous];
        }

        return previous.map((contact) => (contact.id === rawSaved.id ? rawSaved : contact));
      });

      setDraft(EMPTY_DRAFT);
      setEditingContactId(null);
      setIsFormOpen(false);
      setNotice(isEditing ? "Contact updated." : "Contact added.");
    } catch {
      setError(
        isEditing
          ? "Unable to update contact. Please try again."
          : "Unable to add contact. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMakeReusable(contact: ApplicationContact) {
    if (convertingContactId !== null || isSaving || deletingContactId !== null) {
      return;
    }

    setConvertingContactId(contact.id);
    setError(null);
    setNotice(null);

    const encodedApplicationId = encodeURIComponent(applicationId);
    const encodedContactId = encodeURIComponent(contact.id);

    try {
      const response = await apiFetch(
        `/applications/${encodedApplicationId}/contacts/${encodedContactId}/make-reusable`,
        {
          method: "POST",
        }
      );

      if (response.status === 401) {
        router.replace(`/login?next=/applications/${encodedApplicationId}`);
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to make contact reusable.");
      }

      const rawSaved: unknown = await response.json();
      if (!isApplicationContact(rawSaved)) {
        throw new Error("Unable to make contact reusable.");
      }

      setContacts((previous) =>
        previous.map((item) => (item.id === rawSaved.id ? rawSaved : item))
      );
      setNotice("Contact is now reusable.");

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("careerneed:application-contacts-refresh", {
            detail: { applicationId },
          })
        );
      }
    } catch {
      setError("Unable to make contact reusable. Please try again.");
    } finally {
      setConvertingContactId(null);
    }
  }

  async function deleteContact(contact: ApplicationContact) {
    if (deletingContactId !== null || isSaving || convertingContactId !== null) {
      return;
    }

    const confirmed = window.confirm(`Delete ${contact.name} from this application?`);

    if (!confirmed) {
      return;
    }

    setDeletingContactId(contact.id);
    setError(null);
    setNotice(null);

    const encodedApplicationId = encodeURIComponent(applicationId);
    try {
      const response = await apiFetch(
        `/applications/${encodedApplicationId}/contacts/${contact.id}`,
        {
          method: "DELETE",
        }
      );

      if (response.status === 401) {
        router.replace(`/login?next=/applications/${encodedApplicationId}`);
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to delete contact.");
      }

      setContacts((previous) => previous.filter((candidate) => candidate.id !== contact.id));

      if (editingContactId === contact.id) {
        closeForm();
      }

      setNotice("Contact deleted.");
    } catch {
      setError("Unable to delete contact. Please try again.");
    } finally {
      setDeletingContactId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div
          className="border-error-border bg-error-background text-destructive rounded-xl border px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          className="border-success-border bg-success-background text-success rounded-xl border px-4 py-3 text-sm"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      {!isFormOpen ? (
        <button
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
          onClick={openCreateForm}
          type="button"
        >
          Add contact
        </button>
      ) : (
        <form
          className="border-border bg-background space-y-4 rounded-xl border p-4"
          onSubmit={handleSubmit}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-foreground font-semibold">
                {editingContactId ? "Edit contact" : "Add contact"}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Keep the people involved in this application organized.
              </p>
            </div>

            <button
              className="text-muted-foreground hover:text-foreground text-sm font-semibold transition disabled:opacity-50"
              disabled={isSaving}
              onClick={closeForm}
              type="button"
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-foreground grid gap-2 text-sm font-medium">
              Name <span className="text-destructive">*</span>
              <input
                autoFocus
                className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
                maxLength={255}
                onChange={(event) => updateDraft("name", event.target.value)}
                placeholder="Jordan Lee"
                required
                value={draft.name}
              />
            </label>

            <label className="text-foreground grid gap-2 text-sm font-medium">
              Role
              <select
                className="border-border bg-card text-foreground focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
                onChange={(event) => updateDraft("contact_type", event.target.value as ContactType)}
                value={draft.contact_type}
              >
                {CONTACT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-foreground grid gap-2 text-sm font-medium">
              Email
              <input
                className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
                maxLength={255}
                onChange={(event) => updateDraft("email", event.target.value)}
                placeholder="name@example.com"
                type="email"
                value={draft.email}
              />
            </label>

            <label className="text-foreground grid gap-2 text-sm font-medium">
              LinkedIn URL
              <input
                className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
                maxLength={1000}
                onChange={(event) => updateDraft("linkedin_url", event.target.value)}
                placeholder="https://www.linkedin.com/in/name"
                type="url"
                value={draft.linkedin_url}
              />
            </label>
          </div>

          <label className="text-foreground grid gap-2 text-sm font-medium">
            Notes
            <textarea
              className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 min-h-28 w-full resize-y rounded-lg border px-3 py-2.5 text-sm leading-6 transition outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              onChange={(event) => updateDraft("notes", event.target.value)}
              placeholder="How you met, follow-up context, or interview notes."
              value={draft.notes}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving}
              type="submit"
            >
              {isSaving
                ? editingContactId
                  ? "Saving…"
                  : "Adding…"
                : editingContactId
                  ? "Save contact"
                  : "Add contact"}
            </button>

            <button
              className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving}
              onClick={closeForm}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm" role="status">
          Loading contacts…
        </p>
      ) : contacts.length === 0 ? (
        <div className="border-border bg-background rounded-xl border border-dashed px-4 py-6 text-center">
          <p className="text-foreground font-medium">No contacts yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add a recruiter, hiring manager, referral, or interviewer for this application.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Application contacts">
          {contacts.map((contact) => (
            <li className="border-border bg-background rounded-xl border p-4" key={contact.id}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-foreground font-semibold">{contact.name}</h3>
                    <span className="border-primary/30 bg-primary/10 text-primary rounded-full border px-2.5 py-1 text-xs font-semibold">
                      {contactTypeLabel(contact.contact_type)}
                    </span>
                  </div>

                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {contact.email ? (
                      <a className="text-primary hover:underline" href={`mailto:${contact.email}`}>
                        {contact.email}
                      </a>
                    ) : null}

                    {contact.linkedin_url ? (
                      <a
                        className="text-primary hover:underline"
                        href={contact.linkedin_url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        LinkedIn ↗
                      </a>
                    ) : null}
                  </div>

                  {contact.notes ? (
                    <p className="text-muted-foreground mt-3 text-sm leading-6 whitespace-pre-wrap">
                      {contact.notes}
                    </p>
                  ) : null}

                  {contact.contact_id && contact.contact ? (
                    <div className="border-border/70 bg-muted/30 mt-3 rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-foreground text-xs font-semibold">
                          Linked reusable contact
                        </span>
                        <span className="border-border bg-muted/60 text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium">
                          {canonicalRelationshipLabel(contact.contact.relationship_type)}
                        </span>
                      </div>

                      <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                        <span className="text-foreground font-medium">{contact.contact.name}</span>
                        {contact.contact.title ? <span>· {contact.contact.title}</span> : null}
                        {contact.contact.email ? (
                          <>
                            <span aria-hidden="true" className="text-muted-foreground/50">
                              ·
                            </span>
                            <a
                              href={`mailto:${contact.contact.email}`}
                              className="text-primary hover:underline"
                            >
                              {contact.contact.email}
                            </a>
                          </>
                        ) : null}
                        {isValidLinkedInUrl(contact.contact.linkedin_url) ? (
                          <>
                            <span aria-hidden="true" className="text-muted-foreground/50">
                              ·
                            </span>
                            <a
                              href={contact.contact.linkedin_url!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary inline-flex items-center gap-0.5 font-medium hover:underline"
                            >
                              LinkedIn <span aria-hidden="true">↗</span>
                            </a>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {!contact.contact_id || !contact.contact ? (
                    <button
                      className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={
                        isSaving || deletingContactId !== null || convertingContactId !== null
                      }
                      onClick={() => {
                        void handleMakeReusable(contact);
                      }}
                      type="button"
                    >
                      {convertingContactId === contact.id ? "Making reusable…" : "Make reusable"}
                    </button>
                  ) : null}

                  <button
                    className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      isSaving || deletingContactId !== null || convertingContactId !== null
                    }
                    onClick={() => openEditForm(contact)}
                    type="button"
                  >
                    Edit
                  </button>

                  <button
                    className="border-error-border bg-error-background text-destructive rounded-lg border px-3 py-2 text-sm font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      isSaving || deletingContactId !== null || convertingContactId !== null
                    }
                    onClick={() => {
                      void deleteContact(contact);
                    }}
                    type="button"
                  >
                    {deletingContactId === contact.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
