"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, Contact, ContactRelationshipType, isContact, isContactArray } from "@/lib/api";

const RELATIONSHIP_OPTIONS: { value: ContactRelationshipType; label: string }[] = [
  { value: "recruiter", label: "Recruiter" },
  { value: "interviewer", label: "Interviewer" },
  { value: "hiring_manager", label: "Hiring manager" },
  { value: "referral", label: "Referral" },
  { value: "networking", label: "Networking" },
  { value: "other", label: "Other" },
];

const controlClass =
  "border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 transition";

function relationshipLabel(type: ContactRelationshipType): string {
  const found = RELATIONSHIP_OPTIONS.find((opt) => opt.value === type);
  return found?.label ?? type;
}

function isValidEmail(value: string | null): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
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

export default function ContactsClient() {
  const router = useRouter();
  const pathname = usePathname();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formName, setFormName] = useState("");
  const [formRelationship, setFormRelationship] = useState<ContactRelationshipType>("recruiter");
  const [formTitle, setFormTitle] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formLinkedIn, setFormLinkedIn] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);

  const contactsInFlightRef = useRef(false);
  const contactsMountedRef = useRef(false);
  const contactsAbortRef = useRef<AbortController | null>(null);
  const saveInFlight = useRef(false);
  const deleteInFlight = useRef(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const loadContacts = useCallback(async () => {
    if (contactsInFlightRef.current) return;
    contactsInFlightRef.current = true;
    const controller = new AbortController();
    contactsAbortRef.current = controller;
    if (contactsMountedRef.current) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const response = await apiFetch("/contacts", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (controller.signal.aborted || !contactsMountedRef.current) return;
      if (response.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (!response.ok) {
        throw new Error("request failed");
      }
      const payload: unknown = await response.json();
      if (!isContactArray(payload)) {
        throw new Error("invalid response");
      }
      if (!controller.signal.aborted && contactsMountedRef.current) {
        setContacts(payload);
      }
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
      if (!controller.signal.aborted && contactsMountedRef.current) {
        setError("Unable to load contacts. Please try again.");
      }
    } finally {
      if (contactsAbortRef.current === controller) {
        contactsInFlightRef.current = false;
        if (!controller.signal.aborted && contactsMountedRef.current) {
          setIsLoading(false);
        }
      }
    }
  }, [pathname, router]);

  useEffect(() => {
    contactsMountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadContacts();
    return () => {
      contactsMountedRef.current = false;
      contactsAbortRef.current?.abort();
      contactsInFlightRef.current = false;
    };
  }, [loadContacts]);

  useEffect(() => {
    if (!dialogMode) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const nameInput = dialogRef.current?.querySelector<HTMLInputElement>('input[name="name"]');
    if (nameInput) {
      nameInput.focus();
    } else {
      const firstControl = dialogRef.current?.querySelector<HTMLElement>(
        "input, select, textarea, button"
      );
      firstControl?.focus();
    }
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [dialogMode]);

  function openCreateDialog() {
    setEditingContact(null);
    setFormName("");
    setFormRelationship("recruiter");
    setFormTitle("");
    setFormEmail("");
    setFormLinkedIn("");
    setFormError(null);
    setError(null);
    setNotice(null);
    setDialogMode("create");
  }

  function openEditDialog(contact: Contact) {
    setEditingContact(contact);
    setFormName(contact.name);
    setFormRelationship(contact.relationship_type);
    setFormTitle(contact.title ?? "");
    setFormEmail(contact.email ?? "");
    setFormLinkedIn(contact.linkedin_url ?? "");
    setFormError(null);
    setError(null);
    setNotice(null);
    setDialogMode("edit");
  }

  function closeDialog() {
    if (saveInFlight.current) return;
    setDialogMode(null);
    setEditingContact(null);
    setFormError(null);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    );
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInFlight.current) return;

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError("Contact name is required.");
      return;
    }

    const trimmedEmail = formEmail.trim();
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    const trimmedLinkedIn = formLinkedIn.trim();
    if (trimmedLinkedIn && !isValidLinkedInUrl(trimmedLinkedIn)) {
      setFormError(
        "LinkedIn URL must be a valid HTTPS LinkedIn URL (e.g. https://www.linkedin.com/in/...)."
      );
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    setFormError(null);
    setError(null);
    setNotice(null);

    const payload = {
      name: trimmedName,
      relationship_type: formRelationship,
      title: formTitle.trim() || null,
      email: trimmedEmail || null,
      linkedin_url: trimmedLinkedIn || null,
    };

    const isEditing = dialogMode === "edit" && editingContact !== null;
    const url = isEditing ? `/contacts/${encodeURIComponent(editingContact.id)}` : "/contacts";
    const method = isEditing ? "PATCH" : "POST";

    try {
      const response = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      if (!response.ok) {
        throw new Error("request failed");
      }

      const rawData: unknown = await response.json();
      if (!isContact(rawData)) {
        throw new Error("invalid data");
      }

      if (isEditing) {
        setContacts((prev) => prev.map((c) => (c.id === rawData.id ? rawData : c)));
        setNotice("Contact updated.");
      } else {
        setContacts((prev) => [rawData, ...prev]);
        setNotice("Contact created.");
      }
      setDialogMode(null);
      setEditingContact(null);
    } catch {
      setFormError(
        isEditing
          ? "Unable to update contact. Please try again."
          : "Unable to create contact. Please try again."
      );
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  }

  async function handleDelete(contact: Contact) {
    if (deleteInFlight.current || deletingContactId !== null || isSaving) return;

    const confirmed = window.confirm(
      `Delete ${contact.name}?\n\nDeleting this reusable contact will remove its interview participant links, but will not delete any application records.`
    );
    if (!confirmed) return;

    deleteInFlight.current = true;
    setDeletingContactId(contact.id);
    setError(null);
    setNotice(null);

    try {
      const response = await apiFetch(`/contacts/${encodeURIComponent(contact.id)}`, {
        method: "DELETE",
      });

      if (response.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      if (!response.ok) {
        throw new Error("delete failed");
      }

      setContacts((prev) => prev.filter((item) => item.id !== contact.id));
      setNotice("Contact deleted.");
    } catch {
      setError("Unable to delete contact. Please try again.");
    } finally {
      deleteInFlight.current = false;
      setDeletingContactId(null);
    }
  }

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="border-border flex flex-col justify-between gap-3 border-b pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                Contacts
              </h1>
              {contacts.length > 0 ? (
                <span className="border-border bg-muted/60 text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                  {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              Manage reusable professional contacts to link as interviewers, recruiters, and
              observers.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateDialog}
            className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Add contact
          </button>
        </header>

        {notice ? (
          <div
            className="border-success-border bg-success-background text-success mt-4 rounded-xl border px-4 py-3 text-sm"
            role="status"
          >
            {notice}
          </div>
        ) : null}

        {error && contacts.length > 0 ? (
          <div
            className="border-error-border bg-error-background text-destructive mt-4 rounded-xl border px-4 py-3 text-sm"
            role="alert"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void loadContacts()}
                className="text-destructive self-start text-xs font-semibold hover:underline sm:self-auto sm:text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <section className="border-border bg-card mt-6 rounded-xl border border-dashed p-6 text-center">
            <p className="text-muted-foreground text-sm">Loading contacts…</p>
          </section>
        ) : error && contacts.length === 0 ? (
          <section className="border-error-border bg-error-background text-destructive mt-6 rounded-xl border p-5">
            <p className="text-sm font-medium">{error}</p>
            <button
              type="button"
              onClick={() => void loadContacts()}
              className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background mt-4 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Retry
            </button>
          </section>
        ) : contacts.length === 0 ? (
          <div className="border-border bg-card mt-6 rounded-2xl border border-dashed p-10 text-center">
            <span className="text-3xl" aria-hidden="true">
              👥
            </span>
            <h2 className="text-foreground mt-3 text-base font-semibold">No contacts yet</h2>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs sm:text-sm">
              Create reusable professional contacts to attach them as interview participants across
              your applications.
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={openCreateDialog}
                className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background inline-flex h-10 items-center justify-center rounded-lg px-4 text-xs font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Add contact
              </button>
            </div>
          </div>
        ) : (
          <ul className="mt-6 space-y-3" aria-label="Contacts list">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="border-border bg-card flex flex-col justify-between gap-3 rounded-xl border p-4 transition sm:flex-row sm:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground text-sm font-semibold sm:text-base">
                      {contact.name}
                    </span>
                    <span className="border-border bg-muted/60 text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
                      {relationshipLabel(contact.relationship_type)}
                    </span>
                  </div>

                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm">
                    {contact.title ? <span>{contact.title}</span> : null}
                    {contact.company_name ? (
                      <>
                        {contact.title ? (
                          <span aria-hidden="true" className="text-muted-foreground/50">
                            ·
                          </span>
                        ) : null}
                        <span>{contact.company_name}</span>
                      </>
                    ) : null}
                    {contact.email ? (
                      <>
                        {contact.title || contact.company_name ? (
                          <span aria-hidden="true" className="text-muted-foreground/50">
                            ·
                          </span>
                        ) : null}
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-primary hover:underline"
                        >
                          {contact.email}
                        </a>
                      </>
                    ) : null}
                    {isValidLinkedInUrl(contact.linkedin_url) ? (
                      <>
                        {contact.title || contact.company_name || contact.email ? (
                          <span aria-hidden="true" className="text-muted-foreground/50">
                            ·
                          </span>
                        ) : null}
                        <a
                          href={contact.linkedin_url!}
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

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditDialog(contact)}
                    disabled={isSaving || deletingContactId !== null}
                    className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-primary inline-flex h-10 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(contact)}
                    disabled={isSaving || deletingContactId !== null}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 focus-visible:ring-destructive inline-flex h-10 items-center justify-center rounded-lg border px-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                  >
                    {deletingContactId === contact.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Create / Edit Dialog */}
        {dialogMode ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-dialog-title"
          >
            <div
              ref={dialogRef}
              onKeyDown={handleDialogKeyDown}
              className="border-border bg-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5 shadow-xl sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="contact-dialog-title" className="text-foreground text-lg font-bold">
                    {dialogMode === "edit" ? "Edit contact" : "Add contact"}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {dialogMode === "edit"
                      ? "Update contact details for your applications and interviews."
                      : "Add a reusable professional contact for your applications and interviews."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={isSaving}
                  aria-label="Close dialog"
                  className="text-muted-foreground hover:text-foreground inline-flex h-10 w-10 items-center justify-center text-sm disabled:opacity-50"
                >
                  ✕
                </button>
              </div>

              {formError ? (
                <div
                  className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-lg border p-3 text-xs"
                  role="alert"
                >
                  {formError}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="contact-name-input"
                    className="text-foreground text-xs font-semibold"
                  >
                    Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="contact-name-input"
                    name="name"
                    type="text"
                    required
                    maxLength={255}
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      setFormError(null);
                    }}
                    disabled={isSaving}
                    placeholder="e.g. Sarah Connor"
                    className={controlClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-relationship-input"
                    className="text-foreground text-xs font-semibold"
                  >
                    Relationship type <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="contact-relationship-input"
                    name="relationship_type"
                    value={formRelationship}
                    onChange={(e) => {
                      setFormRelationship(e.target.value as ContactRelationshipType);
                      setFormError(null);
                    }}
                    disabled={isSaving}
                    className={controlClass}
                  >
                    {RELATIONSHIP_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="contact-title-input"
                    className="text-foreground text-xs font-semibold"
                  >
                    Title <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input
                    id="contact-title-input"
                    name="title"
                    type="text"
                    maxLength={255}
                    value={formTitle}
                    onChange={(e) => {
                      setFormTitle(e.target.value);
                      setFormError(null);
                    }}
                    disabled={isSaving}
                    placeholder="e.g. Engineering Lead"
                    className={controlClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-email-input"
                    className="text-foreground text-xs font-semibold"
                  >
                    Email <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input
                    id="contact-email-input"
                    name="email"
                    type="email"
                    maxLength={255}
                    value={formEmail}
                    onChange={(e) => {
                      setFormEmail(e.target.value);
                      setFormError(null);
                    }}
                    disabled={isSaving}
                    placeholder="e.g. sarah@example.com"
                    className={controlClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-linkedin-input"
                    className="text-foreground text-xs font-semibold"
                  >
                    LinkedIn URL{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input
                    id="contact-linkedin-input"
                    name="linkedin_url"
                    type="url"
                    maxLength={1000}
                    value={formLinkedIn}
                    onChange={(e) => {
                      setFormLinkedIn(e.target.value);
                      setFormError(null);
                    }}
                    disabled={isSaving}
                    placeholder="https://www.linkedin.com/in/sarahconnor"
                    className={controlClass}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={isSaving}
                    className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-primary inline-flex h-10 items-center justify-center rounded-lg border px-4 text-xs font-semibold transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background inline-flex h-10 items-center justify-center rounded-lg px-4 text-xs font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
                  >
                    {isSaving
                      ? dialogMode === "edit"
                        ? "Saving changes…"
                        : "Creating contact…"
                      : dialogMode === "edit"
                        ? "Save changes"
                        : "Add contact"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
