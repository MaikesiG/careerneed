import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InterviewFollowUp } from "@/lib/api";
import InterviewFollowUpsSection from "./InterviewFollowUpsSection";

const applicationId = "app-1";
const interviewId = "interview-1";

function followUp(overrides: Partial<InterviewFollowUp> = {}): InterviewFollowUp {
  return {
    id: "follow-up-1",
    user_id: "user-1",
    application_id: applicationId,
    interview_id: interviewId,
    type: "thank_you",
    title: "Send thank-you",
    due_at_utc: "2026-10-21T10:30:00.000Z",
    timezone: "UTC",
    completed_at: null,
    notes: null,
    created_at: "2026-10-20T12:00:00.000Z",
    updated_at: "2026-10-20T12:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function openLoadedSection() {
  fireEvent.click(screen.getByRole("button", { name: /^follow-ups/i }));
  await screen.findByText("No follow-ups yet");
}

describe("InterviewFollowUpsSection route-local refresh", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("notifies once after a successful mutation, ignores its own revision, and refetches once for an external revision", async () => {
    const onChanged = vi.fn();
    let scopedGetCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (!init?.method) {
        scopedGetCount += 1;
        return jsonResponse([]);
      }
      if (init.method === "POST") return jsonResponse(followUp(), 201);
      throw new Error(`Unexpected request: ${input.toString()}`);
    });

    const view = render(
      <InterviewFollowUpsSection
        applicationId={applicationId}
        interviewId={interviewId}
        followUpsRevision={0}
        onFollowUpsChanged={onChanged}
      />
    );
    await openLoadedSection();
    expect(scopedGetCount).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Add follow-up" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Send thank-you" } });
    fireEvent.change(screen.getByLabelText("Due date and time"), {
      target: { value: "2026-10-21T10:30" },
    });
    fireEvent.change(screen.getByLabelText("IANA timezone"), { target: { value: "UTC" } });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Add follow-up" })
    );

    await screen.findByText("Send thank-you");
    expect(onChanged).toHaveBeenCalledTimes(1);

    view.rerender(
      <InterviewFollowUpsSection
        applicationId={applicationId}
        interviewId={interviewId}
        followUpsRevision={1}
        onFollowUpsChanged={onChanged}
      />
    );
    expect(scopedGetCount).toBe(1);

    view.rerender(
      <InterviewFollowUpsSection
        applicationId={applicationId}
        interviewId={interviewId}
        followUpsRevision={2}
        onFollowUpsChanged={onChanged}
      />
    );
    await waitFor(() => expect(scopedGetCount).toBe(2));
  });

  it("does not notify after a failed mutation", async () => {
    const onChanged = vi.fn();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (!init?.method) return jsonResponse([]);
      if (init.method === "POST") return jsonResponse({ detail: "private backend detail" }, 500);
      throw new Error("Unexpected request");
    });

    render(
      <InterviewFollowUpsSection
        applicationId={applicationId}
        interviewId={interviewId}
        followUpsRevision={0}
        onFollowUpsChanged={onChanged}
      />
    );
    await openLoadedSection();
    fireEvent.click(screen.getByRole("button", { name: "Add follow-up" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Send thank-you" } });
    fireEvent.change(screen.getByLabelText("Due date and time"), {
      target: { value: "2026-10-21T10:30" },
    });
    fireEvent.change(screen.getByLabelText("IANA timezone"), { target: { value: "UTC" } });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Add follow-up" })
    );

    expect(await screen.findByText("Unable to save this follow-up. Please try again.")).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.queryByText("private backend detail")).not.toBeInTheDocument();
  });
});
