"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  apiFetch,
  ApplicationContact,
  ContactRelationshipType,
  InterviewParticipant,
  isApplicationContactArray,
  isContact,
  isInterviewParticipant,
  isInterviewParticipantArray,
  ParticipantRole,
} from "@/lib/api";

type Props = {
  applicationId: string;
  interviewId: string;
};

const ROLE_OPTIONS: { value: ParticipantRole; label: string }[] = [
  { value: "interviewer", label: "Interviewer" },
  { value: "coordinator", label: "Coordinator" },
  { value: "observer", label: "Observer" },
];

const RELATIONSHIP_OPTIONS: { value: ContactRelationshipType; label: string }[] = [
  { value: "interviewer", label: "Interviewer" },
  { value: "recruiter", label: "Recruiter" },
  { value: "hiring_manager", label: "Hiring manager" },
  { value: "referral", label: "Referral" },
  { value: "networking", label: "Networking" },
  { value: "other", label: "Other" },
];

type ParticipantContactOption = {
  contactId: string;
  name: string;
  title: string | null;
  relationshipType: ContactRelationshipType;
};

function toContactOptions(items: ApplicationContact[]): ParticipantContactOption[] {
  const seen = new Set<string>();
  const options: ParticipantContactOption[] = [];
  for (const item of items) {
    if (!item.contact_id || !item.contact) continue;
    if (seen.has(item.contact_id)) continue;
    seen.add(item.contact_id);
    options.push({
      contactId: item.contact_id,
      name: item.contact.name,
      title: item.contact.title,
      relationshipType: item.contact.relationship_type,
    });
  }
  return options.sort((a, b) => a.name.localeCompare(b.name));
}

const controlClass =
  "border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2";

function roleLabel(role: ParticipantRole): string {
  const found = ROLE_OPTIONS.find((opt) => opt.value === role);
  return found?.label ?? role;
}

function relationshipLabel(type: ContactRelationshipType): string {
  const found = RELATIONSHIP_OPTIONS.find((opt) => opt.value === type);
  return found?.label ?? type;
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

function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (
    trimmed.includes(" ") ||
    trimmed.indexOf("@") === -1 ||
    trimmed.indexOf("@") !== trimmed.lastIndexOf("@")
  ) {
    return false;
  }
  const [localPart, domain] = trimmed.split("@");
  if (
    !localPart ||
    !domain ||
    !domain.includes(".") ||
    domain.startsWith(".") ||
    domain.endsWith(".")
  ) {
    return false;
  }
  return true;
}

export default function InterviewParticipantsSection({ applicationId, interviewId }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [participants, setParticipants] = useState<InterviewParticipant[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [contactOptions, setContactOptions] = useState<ParticipantContactOption[]>([]);
  const [hasLoadedContacts, setHasLoadedContacts] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  // Add participant form state
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedRole, setSelectedRole] = useState<ParticipantRole>("interviewer");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Create contact form state (inside the same dialog)
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactRelationship, setNewContactRelationship] =
    useState<ContactRelationshipType>("interviewer");
  const [newContactTitle, setNewContactTitle] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactLinkedIn, setNewContactLinkedIn] = useState("");
  const [createContactError, setCreateContactError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Guard refs
  const loadInFlight = useRef(false);
  const loadContactsInFlight = useRef(false);
  const addInFlight = useRef(false);
  const createInFlight = useRef(false);
  const deleteInFlight = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const participantsEndpoint = `/applications/${applicationId}/interviews/${interviewId}/participants`;

  const loadParticipants = useCallback(async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiFetch(participantsEndpoint);
      if (!response.ok) throw new Error("request failed");
      const data: unknown = await response.json();
      if (!isInterviewParticipantArray(data)) throw new Error("invalid data");
      setParticipants(data);
      setHasLoaded(true);
    } catch {
      setLoadError("Unable to load participants. Please try again.");
    } finally {
      loadInFlight.current = false;
      setIsLoading(false);
    }
  }, [participantsEndpoint]);

  useEffect(() => {
    if (!isExpanded || hasLoaded || loadError) return;
    // Lazy-load once for this mounted interview card.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadParticipants();
  }, [hasLoaded, isExpanded, loadError, loadParticipants]);

  const loadContacts = useCallback(async () => {
    if (loadContactsInFlight.current) return;
    loadContactsInFlight.current = true;
    if (isMountedRef.current) {
      setIsLoadingContacts(true);
      setContactsError(null);
    }
    try {
      const response = await apiFetch(
        `/applications/${encodeURIComponent(applicationId)}/contacts`
      );
      if (!isMountedRef.current) return;
      if (!response.ok) throw new Error("request failed");
      const data: unknown = await response.json();
      if (!isApplicationContactArray(data)) throw new Error("invalid data");
      if (!isMountedRef.current) return;
      setContactOptions(toContactOptions(data));
      setHasLoadedContacts(true);
    } catch {
      if (isMountedRef.current) {
        setContactsError("Unable to load contacts. Please try again.");
      }
    } finally {
      loadContactsInFlight.current = false;
      if (isMountedRef.current) {
        setIsLoadingContacts(false);
      }
    }
  }, [applicationId]);

  useEffect(() => {
    if (!isDialogOpen || hasLoadedContacts || contactsError) return;
    // Open contacts list only after the user opens the dialog.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadContacts();
  }, [contactsError, hasLoadedContacts, isDialogOpen, loadContacts]);

  useEffect(() => {
    if (!isDialogOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const firstControl = dialogRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button"
    );
    firstControl?.focus();
    return () => previousFocusRef.current?.focus();
  }, [isDialogOpen]);

  function openDialog() {
    setSelectedContactId("");
    setSelectedRole("interviewer");
    setAddError(null);
    setIsCreatingContact(false);
    setNewContactName("");
    setNewContactRelationship("interviewer");
    setNewContactTitle("");
    setNewContactEmail("");
    setNewContactLinkedIn("");
    setCreateContactError(null);
    setActionError(null);
    setContactsError(null);
    setHasLoadedContacts(false);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    if (addInFlight.current || createInFlight.current) return;
    setIsDialogOpen(false);
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

  async function handleCreateContact(event?: FormEvent) {
    if (event) event.preventDefault();
    if (createInFlight.current) return;

    const trimmedName = newContactName.trim();
    if (!trimmedName) {
      setCreateContactError("Name is required.");
      return;
    }

    const trimmedEmail = newContactEmail.trim();
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      setCreateContactError("Enter a valid email address.");
      return;
    }

    const trimmedLinkedIn = newContactLinkedIn.trim();
    if (trimmedLinkedIn && !isValidLinkedInUrl(trimmedLinkedIn)) {
      setCreateContactError("Enter a valid HTTPS LinkedIn URL.");
      return;
    }

    createInFlight.current = true;
    setIsCreating(true);
    setCreateContactError(null);
    try {
      const response = await apiFetch("/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          relationship_type: newContactRelationship,
          title: newContactTitle.trim() || null,
          email: trimmedEmail || null,
          linkedin_url: trimmedLinkedIn || null,
        }),
      });

      if (!response.ok) throw new Error("request failed");
      const data: unknown = await response.json();
      if (!isContact(data)) throw new Error("invalid data");

      if (!isMountedRef.current) return;

      const linkContactType =
        newContactRelationship === "recruiter" ||
        newContactRelationship === "interviewer" ||
        newContactRelationship === "hiring_manager" ||
        newContactRelationship === "referral"
          ? newContactRelationship
          : "other";

      const linkResponse = await apiFetch(
        `/applications/${encodeURIComponent(applicationId)}/contacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contact_id: data.id,
            name: data.name,
            contact_type: linkContactType,
            email: data.email,
            linkedin_url: data.linkedin_url,
          }),
        }
      );

      if (!linkResponse.ok) throw new Error("request failed");

      if (!isMountedRef.current) return;

      const listResponse = await apiFetch(
        `/applications/${encodeURIComponent(applicationId)}/contacts`
      );
      if (!listResponse.ok) throw new Error("request failed");
      const listData: unknown = await listResponse.json();
      if (!isApplicationContactArray(listData)) throw new Error("invalid data");

      if (!isMountedRef.current) return;

      setContactOptions(toContactOptions(listData));
      setHasLoadedContacts(true);
      setSelectedContactId(data.id);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("careerneed:application-contacts-refresh", {
            detail: { applicationId },
          })
        );
      }

      setIsCreatingContact(false);
      setNewContactName("");
      setNewContactTitle("");
      setNewContactEmail("");
      setNewContactLinkedIn("");
      setNewContactRelationship("interviewer");
      setCreateContactError(null);
      setAddError(null);
    } catch {
      if (isMountedRef.current) {
        setCreateContactError("Unable to create contact. Please try again.");
      }
    } finally {
      createInFlight.current = false;
      if (isMountedRef.current) {
        setIsCreating(false);
      }
    }
  }

  const existingContactIds = new Set(participants.map((p) => p.contact_id));

  async function handleAddParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addInFlight.current) return;

    if (!selectedContactId) {
      setAddError("Please select a contact.");
      return;
    }

    if (existingContactIds.has(selectedContactId)) {
      setAddError("This contact is already a participant.");
      return;
    }

    addInFlight.current = true;
    setIsAdding(true);
    setAddError(null);
    try {
      const response = await apiFetch(participantsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: selectedContactId,
          role: selectedRole,
        }),
      });

      if (response.status === 409) {
        setAddError("This contact is already a participant.");
        return;
      }

      if (!response.ok) throw new Error("request failed");
      const data: unknown = await response.json();
      if (!isInterviewParticipant(data)) throw new Error("invalid data");

      setParticipants((current) => [...current, data]);
      setHasLoaded(true);
      setIsDialogOpen(false);
      setSelectedContactId("");

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("careerneed:application-contacts-refresh", {
            detail: { applicationId },
          })
        );
      }
    } catch {
      setAddError("Unable to add participant. Please try again.");
    } finally {
      addInFlight.current = false;
      setIsAdding(false);
    }
  }

  async function handleRemoveParticipant(participant: InterviewParticipant) {
    if (deleteInFlight.current) return;
    if (
      !window.confirm(
        `Remove ${participant.contact.name} from this interview? This cannot be undone.`
      )
    ) {
      return;
    }

    deleteInFlight.current = true;
    setDeletingId(participant.id);
    setActionError(null);
    try {
      const response = await apiFetch(`${participantsEndpoint}/${participant.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("request failed");
      setParticipants((current) => current.filter((item) => item.id !== participant.id));
    } catch {
      setActionError("Unable to remove participant. Please try again.");
    } finally {
      deleteInFlight.current = false;
      setDeletingId(null);
    }
  }

  return (
    <div className="border-border mt-3 border-t pt-3">
      {/* Collapsed/Expanded Toggle Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
        aria-controls={`participants-${interviewId}`}
        className="text-foreground hover:text-primary flex h-10 w-full items-center justify-between text-left text-sm font-semibold transition"
      >
        <span className="flex items-center gap-2">
          Participants
          {hasLoaded ? (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
              {participants.length}
            </span>
          ) : null}
        </span>
        <span aria-hidden="true">{isExpanded ? "▴" : "▾"}</span>
      </button>

      {isExpanded ? (
        <div id={`participants-${interviewId}`} className="pt-2">
          {/* Action Row */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              Manage contacts who participate in this round.
            </p>
            <button
              type="button"
              onClick={openDialog}
              disabled={isLoading}
              className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            >
              + Add participant
            </button>
          </div>

          {/* Error messages */}
          {loadError ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void loadParticipants()}
                className="font-semibold underline"
              >
                Retry
              </button>
            </div>
          ) : null}

          {actionError ? (
            <p className="border-destructive/30 bg-destructive/10 text-destructive mb-3 rounded-lg border px-3 py-2 text-sm">
              {actionError}
            </p>
          ) : null}

          {/* Loading state */}
          {isLoading ? (
            <p className="text-muted-foreground py-4 text-sm">Loading participants…</p>
          ) : null}

          {/* Empty state */}
          {!isLoading && !loadError && participants.length === 0 ? (
            <div className="border-border bg-muted/20 rounded-lg border border-dashed px-4 py-5 text-center">
              <p className="text-foreground text-sm font-medium">No participants added yet</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Attach contacts who participated in this interview round.
              </p>
            </div>
          ) : null}

          {/* Participants list */}
          {!isLoading && participants.length > 0 ? (
            <div className="space-y-2">
              {participants.map((participant) => (
                <article
                  key={participant.id}
                  className="border-border bg-background flex flex-col justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="border-primary/30 bg-primary/10 text-primary rounded-full border px-2 py-0.5 text-xs font-semibold">
                        {roleLabel(participant.role)}
                      </span>
                      <h4 className="text-foreground text-sm font-semibold">
                        {participant.contact.name}
                      </h4>
                      {participant.contact.title ? (
                        <span className="text-muted-foreground text-xs sm:text-sm">
                          · {participant.contact.title}
                        </span>
                      ) : null}
                      <span className="border-border bg-muted/50 text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium">
                        {relationshipLabel(participant.contact.relationship_type)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                      {participant.contact.email ? (
                        <a
                          href={`mailto:${participant.contact.email}`}
                          className="text-primary hover:underline"
                        >
                          {participant.contact.email}
                        </a>
                      ) : null}
                      {isValidLinkedInUrl(participant.contact.linkedin_url) ? (
                        <a
                          href={participant.contact.linkedin_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-medium hover:underline"
                        >
                          LinkedIn ↗
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      disabled={deletingId === participant.id}
                      onClick={() => void handleRemoveParticipant(participant)}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 focus-visible:ring-destructive inline-flex h-10 items-center justify-center rounded-lg border px-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                    >
                      {deletingId === participant.id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Add Participant Dialog */}
      {isDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`add-participant-title-${interviewId}`}
        >
          <div
            ref={dialogRef}
            onKeyDown={handleDialogKeyDown}
            className="border-border bg-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id={`add-participant-title-${interviewId}`}
                  className="text-foreground text-lg font-bold"
                >
                  Add participant
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  Attach a contact and assign their role for this interview round.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                disabled={isAdding || isCreating}
                aria-label="Close add participant dialog"
                className="text-muted-foreground hover:text-foreground inline-flex h-10 w-10 items-center justify-center text-sm disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Main Add Participant Form */}
            <form onSubmit={handleAddParticipant} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor={`participant-role-${interviewId}`}
                  className="text-foreground text-sm font-medium"
                >
                  Role *
                </label>
                <select
                  id={`participant-role-${interviewId}`}
                  required
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value as ParticipantRole)}
                  className={controlClass}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={`participant-contact-${interviewId}`}
                    className="text-foreground text-sm font-medium"
                  >
                    Contact *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingContact((prev) => !prev);
                      setCreateContactError(null);
                    }}
                    className="text-primary inline-flex h-10 items-center text-xs font-semibold hover:underline"
                  >
                    {isCreatingContact ? "Cancel new contact" : "+ Create new contact"}
                  </button>
                </div>

                <select
                  id={`participant-contact-${interviewId}`}
                  required
                  value={selectedContactId}
                  onChange={(event) => {
                    setSelectedContactId(event.target.value);
                    setAddError(null);
                  }}
                  className={controlClass}
                >
                  <option value="">Select a contact…</option>
                  {contactOptions.map((option) => {
                    const isAlready = existingContactIds.has(option.contactId);
                    return (
                      <option key={option.contactId} value={option.contactId} disabled={isAlready}>
                        {option.name}
                        {option.title ? ` (${option.title})` : ""}
                        {option.relationshipType
                          ? ` · ${relationshipLabel(option.relationshipType)}`
                          : ""}
                        {isAlready ? " — Already added" : ""}
                      </option>
                    );
                  })}
                </select>

                {isLoadingContacts ? (
                  <p className="text-muted-foreground mt-1 text-xs">Loading contacts…</p>
                ) : null}

                {contactsError ? (
                  <div className="border-destructive/30 bg-destructive/10 text-destructive mt-1.5 flex items-center justify-between rounded-lg border p-2 text-xs">
                    <span>{contactsError}</span>
                    <button
                      type="button"
                      onClick={() => void loadContacts()}
                      className="font-semibold underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : null}

                {!isLoadingContacts &&
                !contactsError &&
                hasLoadedContacts &&
                contactOptions.length === 0 ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    No contacts found. Create one below to attach as a participant.
                  </p>
                ) : null}
              </div>

              {/* Collapsible Create Contact Subform */}
              {isCreatingContact ? (
                <div className="border-border bg-muted/20 rounded-xl border p-4">
                  <h4 className="text-foreground text-sm font-semibold">Create new contact</h4>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    This contact will be saved to your address book and pre-selected.
                  </p>

                  <div className="mt-3 space-y-3">
                    <div>
                      <label
                        htmlFor={`new-contact-name-${interviewId}`}
                        className="text-foreground text-xs font-medium"
                      >
                        Name *
                      </label>
                      <input
                        id={`new-contact-name-${interviewId}`}
                        required
                        maxLength={255}
                        placeholder="Full name"
                        value={newContactName}
                        onChange={(event) => setNewContactName(event.target.value)}
                        className={controlClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`new-contact-relationship-${interviewId}`}
                        className="text-foreground text-xs font-medium"
                      >
                        Relationship *
                      </label>
                      <select
                        id={`new-contact-relationship-${interviewId}`}
                        required
                        value={newContactRelationship}
                        onChange={(event) =>
                          setNewContactRelationship(event.target.value as ContactRelationshipType)
                        }
                        className={controlClass}
                      >
                        {RELATIONSHIP_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor={`new-contact-title-${interviewId}`}
                        className="text-foreground text-xs font-medium"
                      >
                        Title <span className="text-muted-foreground">(optional)</span>
                      </label>
                      <input
                        id={`new-contact-title-${interviewId}`}
                        maxLength={255}
                        placeholder="e.g. Engineering Manager"
                        value={newContactTitle}
                        onChange={(event) => setNewContactTitle(event.target.value)}
                        className={controlClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`new-contact-email-${interviewId}`}
                        className="text-foreground text-xs font-medium"
                      >
                        Email <span className="text-muted-foreground">(optional)</span>
                      </label>
                      <input
                        id={`new-contact-email-${interviewId}`}
                        type="email"
                        maxLength={255}
                        placeholder="name@example.com"
                        value={newContactEmail}
                        onChange={(event) => setNewContactEmail(event.target.value)}
                        className={controlClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`new-contact-linkedin-${interviewId}`}
                        className="text-foreground text-xs font-medium"
                      >
                        LinkedIn URL <span className="text-muted-foreground">(optional)</span>
                      </label>
                      <input
                        id={`new-contact-linkedin-${interviewId}`}
                        type="url"
                        maxLength={1000}
                        placeholder="https://www.linkedin.com/in/..."
                        value={newContactLinkedIn}
                        onChange={(event) => setNewContactLinkedIn(event.target.value)}
                        className={controlClass}
                      />
                    </div>

                    {createContactError ? (
                      <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-xs">
                        {createContactError}
                      </p>
                    ) : null}

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingContact(false);
                          setCreateContactError(null);
                        }}
                        disabled={isCreating}
                        className="border-border bg-card text-foreground hover:bg-muted inline-flex h-10 items-center justify-center rounded-lg border px-3 text-xs font-medium transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCreateContact()}
                        disabled={isCreating}
                        className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-primary inline-flex h-10 items-center justify-center rounded-lg border px-4 text-xs font-semibold transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                      >
                        {isCreating ? "Saving contact…" : "Save contact"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {addError ? (
                <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm">
                  {addError}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={isAdding || isCreating}
                  className="border-border bg-card text-foreground hover:bg-muted inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isAdding || !selectedContactId || existingContactIds.has(selectedContactId)
                  }
                  className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
                >
                  {isAdding ? "Adding…" : "Add participant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
