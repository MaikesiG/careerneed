"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  apiFetch,
  InterviewQuestion,
  InterviewQuestionCategory,
  InterviewQuestionDifficulty,
} from "@/lib/api";
import ConfirmDialog from "@/components/ConfirmDialog";

type InterviewQuestionsSectionProps = {
  applicationId: string;
  interviewId: string;
};

type QuestionForm = {
  question: string;
  category: InterviewQuestionCategory;
  difficulty: InterviewQuestionDifficulty;
  answer_notes: string;
  reflection: string;
  leetcode_url: string;
  asked_at: string;
};

const EMPTY_FORM: QuestionForm = {
  question: "",
  category: "technical",
  difficulty: "unknown",
  answer_notes: "",
  reflection: "",
  leetcode_url: "",
  asked_at: "",
};

const CATEGORY_OPTIONS: { value: InterviewQuestionCategory; label: string }[] = [
  { value: "behavioral", label: "Behavioral" },
  { value: "technical", label: "Technical" },
  { value: "coding", label: "Coding" },
  { value: "system_design", label: "System design" },
  { value: "case", label: "Case" },
  { value: "product", label: "Product" },
  { value: "culture", label: "Culture" },
  { value: "other", label: "Other" },
];

const DIFFICULTY_OPTIONS: { value: InterviewQuestionDifficulty; label: string }[] = [
  { value: "unknown", label: "Not specified" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

function toLocalDatetimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatAskedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function categoryLabel(category: InterviewQuestionCategory): string {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

function difficultyClass(difficulty: InterviewQuestionDifficulty): string {
  switch (difficulty) {
    case "easy":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "hard":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function validateLeetCodeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol !== "https:" ||
      !["leetcode.com", "www.leetcode.com"].includes(parsed.hostname.toLowerCase()) ||
      parsed.pathname === "/"
    ) {
      return "Enter a full HTTPS LeetCode problem URL.";
    }
  } catch {
    return "Enter a valid HTTPS LeetCode problem URL.";
  }
  return null;
}

function serializeAskedAt(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Enter a valid asked-at date and time.");
  }
  return date.toISOString();
}

export default function InterviewQuestionsSection({
  applicationId,
  interviewId,
}: InterviewQuestionsSectionProps) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<InterviewQuestion | null>(null);
  const [form, setForm] = useState<QuestionForm>(EMPTY_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<InterviewQuestion | null>(null);

  const endpoint = `/applications/${applicationId}/interviews/${interviewId}/questions`;

  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiFetch(endpoint);
      if (!response.ok) throw new Error("Unable to load interview questions.");
      setQuestions((await response.json()) as InterviewQuestion[]);
      setHasLoaded(true);
    } catch {
      setLoadError("Unable to load interview questions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (!isExpanded || hasLoaded) return;
    // Fetch only after this interview's questions are explicitly expanded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadQuestions();
  }, [hasLoaded, isExpanded, loadQuestions]);

  function openCreateForm() {
    setEditingQuestion(null);
    setForm(EMPTY_FORM);
    setValidationError(null);
    setActionError(null);
    setIsFormOpen(true);
  }

  function toggleExpanded() {
    if (!isExpanded && !hasLoaded) setIsLoading(true);
    setIsExpanded((current) => !current);
  }

  function openEditForm(question: InterviewQuestion) {
    setEditingQuestion(question);
    setForm({
      question: question.question,
      category: question.category,
      difficulty: question.difficulty,
      answer_notes: question.answer_notes ?? "",
      reflection: question.reflection ?? "",
      leetcode_url: question.leetcode_url ?? "",
      asked_at: toLocalDatetimeInput(question.asked_at),
    });
    setValidationError(null);
    setActionError(null);
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const questionText = form.question.trim();
    if (!questionText) {
      setValidationError("Question is required.");
      return;
    }
    const urlError = validateLeetCodeUrl(form.leetcode_url);
    if (urlError) {
      setValidationError(urlError);
      return;
    }
    let askedAt: string | null;
    try {
      askedAt = serializeAskedAt(form.asked_at);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Enter a valid date and time.");
      return;
    }

    setIsSaving(true);
    setValidationError(null);
    try {
      const response = await apiFetch(
        editingQuestion ? `${endpoint}/${editingQuestion.id}` : endpoint,
        {
          method: editingQuestion ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: questionText,
            category: form.category,
            difficulty: form.difficulty,
            answer_notes: form.answer_notes.trim() || null,
            reflection: form.reflection.trim() || null,
            leetcode_url: form.leetcode_url.trim() || null,
            asked_at: askedAt,
          }),
        }
      );
      if (!response.ok) throw new Error("Unable to save interview question.");
      setIsFormOpen(false);
      await loadQuestions();
    } catch {
      setValidationError("Unable to save this question. Check the fields and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDeleteQuestion() {
    if (!questionToDelete) return;
    const target = questionToDelete;
    setDeletingId(target.id);
    setActionError(null);
    try {
      const response = await apiFetch(`${endpoint}/${target.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete interview question.");
      setQuestions((current) => current.filter((item) => item.id !== target.id));
      setQuestionToDelete(null);
    } catch {
      setActionError("Unable to delete this question. Please try again.");
      setQuestionToDelete(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="border-border/70 mt-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-foreground text-sm font-semibold">Interview questions</h4>
            {hasLoaded ? (
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                {questions.length}
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Capture prompts, answers, reflections, and practice links.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <button
              type="button"
              onClick={openCreateForm}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold shadow-xs transition"
            >
              + Add question
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={isExpanded}
            className="border-border bg-card text-foreground hover:bg-muted inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium transition"
          >
            {isExpanded ? "Hide questions" : "Show questions"}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <>
          {loadError ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mt-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void loadQuestions()}
                className="font-semibold underline"
              >
                Retry
              </button>
            </div>
          ) : null}
          {actionError ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mt-3 rounded-lg border px-3 py-2 text-sm">
              {actionError}
            </div>
          ) : null}

          {isLoading ? (
            <p className="text-muted-foreground py-4 text-sm">Loading questions…</p>
          ) : questions.length === 0 && !loadError ? (
            <div className="border-border bg-muted/20 mt-3 rounded-lg border border-dashed px-4 py-5 text-center">
              <p className="text-foreground text-sm font-medium">No questions captured yet</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Add questions after a round or while preparing.
              </p>
            </div>
          ) : (
            <div className="border-border mt-3 divide-y rounded-lg border">
              {questions.map((question) => (
                <div key={question.id} className="px-3 py-3 sm:px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground text-sm font-medium whitespace-pre-wrap">
                        {question.question}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="border-primary/25 bg-primary/10 text-primary rounded-full border px-2 py-0.5 text-xs font-medium">
                          {categoryLabel(question.category)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${difficultyClass(question.difficulty)}`}
                        >
                          {question.difficulty === "unknown"
                            ? "Difficulty not set"
                            : question.difficulty.charAt(0).toUpperCase() +
                              question.difficulty.slice(1)}
                        </span>
                        {question.asked_at ? (
                          <span className="text-muted-foreground text-xs">
                            Asked {formatAskedAt(question.asked_at)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(question)}
                        className="text-muted-foreground hover:text-foreground text-xs font-medium transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuestionToDelete(question)}
                        disabled={deletingId === question.id}
                        className="text-muted-foreground hover:text-destructive text-xs font-medium transition disabled:opacity-50"
                      >
                        {deletingId === question.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>

                  {question.answer_notes ? (
                    <div className="mt-2 text-sm">
                      <span className="text-foreground font-medium">Answer notes: </span>
                      <span className="text-muted-foreground whitespace-pre-wrap">
                        {question.answer_notes}
                      </span>
                    </div>
                  ) : null}
                  {question.reflection ? (
                    <div className="mt-1 text-sm">
                      <span className="text-foreground font-medium">Reflection: </span>
                      <span className="text-muted-foreground whitespace-pre-wrap">
                        {question.reflection}
                      </span>
                    </div>
                  ) : null}
                  {question.leetcode_url ? (
                    <a
                      href={question.leetcode_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary mt-2 inline-flex text-xs font-semibold hover:underline"
                    >
                      Open LeetCode problem ↗
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="border-border bg-card max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-foreground text-lg font-bold">
                  {editingQuestion ? "Edit interview question" : "Add interview question"}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  Keep the prompt separate from your answer notes and reflection.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                disabled={isSaving}
                aria-label="Close question form"
                className="text-muted-foreground hover:text-foreground text-sm disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor={`question-${interviewId}`}
                  className="text-foreground text-sm font-medium"
                >
                  Question <span className="text-destructive">*</span>
                </label>
                <textarea
                  id={`question-${interviewId}`}
                  rows={3}
                  required
                  maxLength={10000}
                  value={form.question}
                  onChange={(event) => setForm({ ...form, question: event.target.value })}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                  placeholder="What question was asked?"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-foreground text-sm font-medium">Category</label>
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        category: event.target.value as InterviewQuestionCategory,
                      })
                    }
                    className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-foreground text-sm font-medium">Difficulty</label>
                  <select
                    value={form.difficulty}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        difficulty: event.target.value as InterviewQuestionDifficulty,
                      })
                    }
                    className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
                  >
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-foreground text-sm font-medium">
                  Asked at (your local time)
                </label>
                <input
                  type="datetime-local"
                  value={form.asked_at}
                  onChange={(event) => setForm({ ...form, asked_at: event.target.value })}
                  className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  Your local date and time will be converted to a UTC timestamp when saved.
                </p>
              </div>

              <div>
                <label className="text-foreground text-sm font-medium">Answer notes</label>
                <textarea
                  rows={3}
                  maxLength={10000}
                  value={form.answer_notes}
                  onChange={(event) => setForm({ ...form, answer_notes: event.target.value })}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                  placeholder="Outline your answer, examples, or approach."
                />
              </div>

              <div>
                <label className="text-foreground text-sm font-medium">Reflection</label>
                <textarea
                  rows={3}
                  maxLength={10000}
                  value={form.reflection}
                  onChange={(event) => setForm({ ...form, reflection: event.target.value })}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                  placeholder="What went well, and what would you improve?"
                />
              </div>

              <div>
                <label className="text-foreground text-sm font-medium">LeetCode URL</label>
                <input
                  type="url"
                  value={form.leetcode_url}
                  onChange={(event) => setForm({ ...form, leetcode_url: event.target.value })}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
                  placeholder="https://leetcode.com/problems/..."
                />
              </div>

              {validationError ? (
                <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm">
                  {validationError}
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSaving}
                  className="border-border bg-card text-foreground hover:bg-muted h-10 rounded-lg border px-4 text-sm font-medium transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : editingQuestion ? "Save changes" : "Add question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(questionToDelete)}
        title="Delete Question"
        description={
          questionToDelete
            ? `Are you sure you want to delete "${questionToDelete.question}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete Question"
        isLoading={Boolean(deletingId)}
        onConfirm={confirmDeleteQuestion}
        onCancel={() => setQuestionToDelete(null)}
      />
    </div>
  );
}
