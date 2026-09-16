"use client";

import { apiFetch } from "@/lib/api";
import { useRouter } from "next/dist/client/components/navigation";

import { FormEvent, useEffect, useState } from "react";

type ContactType = "recruiter" | "hiring_manager" | "interviewer" | "referral" | "other";

type ApplicationContact = {
  id: string;
  application_id: string;
  name: string;
  contact_type: string;
  email: string | null;
  linkedin_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

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

function contactTypeLabel(contactType: string): string {
  const option = CONTACT_TYPE_OPTIONS.find((candidate) => candidate.value === contactType);
  return option?.label ?? contactType;
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadContacts() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiFetch(`/applications/${applicationId}/contacts`, {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.push(`/login?next=/applications/${applicationId}`);
          return;
        }

        if (!response.ok) {
          throw new Error(await readError(response, "Unable to load contacts."));
        }

        const data = (await response.json()) as unknown;

        if (!Array.isArray(data)) {
          throw new Error("Unable to load contacts.");
        }

        if (isCurrent) {
          setContacts(data as ApplicationContact[]);
        }
      } catch (caughtError) {
        if (isCurrent) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load contacts.");
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadContacts();

    return () => {
      isCurrent = false;
    };
  }, [applicationId, router]);

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

    const isEditing = editingContactId !== null;
    const endpoint = isEditing
      ? `/applications/${applicationId}/contacts/${editingContactId}`
      : `/applications/${applicationId}/contacts`;

    try {
      const response = await apiFetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            isEditing ? "Unable to update contact." : "Unable to add contact."
          )
        );
      }

      const savedContact = (await response.json()) as ApplicationContact;

      setContacts((previous) => {
        if (!isEditing) {
          return [savedContact, ...previous];
        }

        return previous.map((contact) => (contact.id === savedContact.id ? savedContact : contact));
      });

      setDraft(EMPTY_DRAFT);
      setEditingContactId(null);
      setIsFormOpen(false);
      setNotice(isEditing ? "Contact updated." : "Contact added.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : isEditing
            ? "Unable to update contact."
            : "Unable to add contact."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteContact(contact: ApplicationContact) {
    if (deletingContactId !== null || isSaving) {
      return;
    }

    const confirmed = window.confirm(`Delete ${contact.name} from this application?`);

    if (!confirmed) {
      return;
    }

    setDeletingContactId(contact.id);
    setError(null);
    setNotice(null);

    try {
      const response = await apiFetch(`/applications/${applicationId}/contacts/${contact.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Unable to delete contact."));
      }

      setContacts((previous) => previous.filter((candidate) => candidate.id !== contact.id));

      if (editingContactId === contact.id) {
        closeForm();
      }

      setNotice("Contact deleted.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete contact.");
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
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSaving || deletingContactId !== null}
                    onClick={() => openEditForm(contact)}
                    type="button"
                  >
                    Edit
                  </button>

                  <button
                    className="border-error-border bg-error-background text-destructive rounded-lg border px-3 py-2 text-sm font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSaving || deletingContactId !== null}
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
