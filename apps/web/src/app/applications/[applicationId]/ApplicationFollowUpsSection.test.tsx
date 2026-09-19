import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Interview, InterviewFollowUp } from "@/lib/api";
import ApplicationFollowUpsSection, { interviewContextLabel } from "./ApplicationFollowUpsSection";

const applicationId = "app-1";
const noop = () => {};

function renderFollowUpsSection({
  revision = 0,
  onChanged = noop,
}: { revision?: number; onChanged?: () => void } = {}) {
  return render(
    <ApplicationFollowUpsSection
      applicationId={applicationId}
      followUpsRevision={revision}
      onFollowUpsChanged={onChanged}
    />
  );
}

function followUp(overrides: Partial<InterviewFollowUp> = {}): InterviewFollowUp {
  return {
    id: "follow-up-1",
    user_id: "user-1",
    application_id: applicationId,
    interview_id: null,
    type: "status_check",
    title: "Check application status",
    due_at_utc: "2026-10-20T14:00:00.000Z",
    timezone: "UTC",
    completed_at: null,
    notes: null,
    created_at: "2026-10-01T12:00:00.000Z",
    updated_at: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}

function interview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: "interview-1",
    application_id: applicationId,
    round: 2,
    title: "System design",
    interview_type: "system_design",
    scheduled_at: "2026-10-18T14:00:00.000Z",
    duration_minutes: 60,
    timezone: "UTC",
    status: "completed",
    result: "pending",
    interviewer_name: null,
    interviewer_title: null,
    interviewer_email: null,
    meeting_url: null,
    location: null,
    notes: null,
    preparation_notes: null,
    created_at: "2026-10-01T12:00:00.000Z",
    updated_at: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installInitialFetch(
  followUps: InterviewFollowUp[],
  interviews: Interview[] = [interview()]
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = input.toString();
    if (url.endsWith(`/applications/${applicationId}/follow-ups`)) {
      return jsonResponse(followUps);
    }
    if (url.endsWith(`/applications/${applicationId}/interviews`)) {
      return jsonResponse(interviews);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
}

describe("ApplicationFollowUpsSection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads general and interview-linked records and separates completed items", async () => {
    const fetchSpy = installInitialFetch([
      followUp(),
      followUp({
        id: "follow-up-2",
        interview_id: "interview-1",
        title: "Send thank-you",
        type: "thank_you",
        completed_at: "2026-10-19T14:00:00.000Z",
      }),
    ]);

    const view = renderFollowUpsSection();

    expect(screen.getByText("Loading follow-ups…")).toBeInTheDocument();
    expect(await screen.findByText("Check application status")).toBeInTheDocument();
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.queryByText("Send thank-you")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Completed (1)" }));
    expect(screen.getByText("Send thank-you")).toBeInTheDocument();
    expect(screen.getByText("Round 2 · System design")).toBeInTheDocument();

    view.rerender(
      <ApplicationFollowUpsSection
        applicationId={applicationId}
        followUpsRevision={1}
        onFollowUpsChanged={noop}
      />
    );
    await waitFor(() => {
      const followUpGets = fetchSpy.mock.calls.filter(([input]) =>
        input.toString().endsWith(`/applications/${applicationId}/follow-ups`)
      );
      expect(followUpGets).toHaveLength(2);
    });
  });

  it("uses complete, title-only, round-only, and missing interview label fallbacks", () => {
    const linked = followUp({ interview_id: "interview-1" });
    expect(interviewContextLabel(linked, interview())).toBe("Round 2 · System design");
    expect(interviewContextLabel(linked, interview({ round: 0, title: "Panel" }))).toBe("Panel");
    expect(interviewContextLabel(linked, interview({ round: 3, title: "  " }))).toBe("Round 3");
    expect(interviewContextLabel(linked, undefined)).toBe("Interview follow-up");
    expect(interviewContextLabel(followUp(), undefined)).toBe("General");
  });

  it("quick-add posts an application-level record with null interview, timezone, and UTC due time", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const onChanged = vi.fn();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = input.toString();
      requests.push({ url, init });
      if (init?.method === "POST") {
        return jsonResponse(
          followUp({ id: "created", title: "Email recruiter", due_at_utc: "2026-10-21T10:30:00.000Z" }),
          201
        );
      }
      if (url.endsWith("/interviews")) return jsonResponse([]);
      return jsonResponse([]);
    });

    renderFollowUpsSection({ onChanged });
    await screen.findByText("No follow-ups yet");
    fireEvent.click(screen.getByRole("button", { name: "Add follow-up" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Email recruiter" } });
    fireEvent.change(screen.getByLabelText("Due date and time"), {
      target: { value: "2026-10-21T10:30" },
    });
    fireEvent.change(screen.getByLabelText("IANA timezone"), { target: { value: "UTC" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add follow-up" }));

    await screen.findByText("Email recruiter");
    const post = requests.find((request) => request.init?.method === "POST");
    expect(post).toBeDefined();
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      interview_id: null,
      title: "Email recruiter",
      type: "status_check",
      due_at_utc: "2026-10-21T10:30:00.000Z",
      timezone: "UTC",
      notes: null,
    });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("complete and reopen send exact completion payloads and update only the affected item", async () => {
    const first = followUp();
    const second = followUp({ id: "follow-up-2", title: "Keep me unchanged" });
    const patchBodies: unknown[] = [];
    installInitialFetch([first, second]).mockImplementation(async (input, init) => {
      const url = input.toString();
      if (url.endsWith("/interviews")) return jsonResponse([interview()]);
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        patchBodies.push(body);
        return jsonResponse({
          ...first,
          completed_at: body.completed_at,
          updated_at: "2026-10-02T12:00:00.000Z",
        });
      }
      return jsonResponse([first, second]);
    });

    renderFollowUpsSection();
    const title = await screen.findByText(first.title);
    const firstRow = title.closest("article")!;
    fireEvent.click(within(firstRow).getByRole("button", { name: "Mark complete" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Completed (1)" })).toBeInTheDocument());
    expect(screen.getByText(second.title)).toBeInTheDocument();
    expect(patchBodies).toHaveLength(1);
    expect(patchBodies[0]).toEqual({ completed_at: expect.stringMatching(/Z$/) });

    fireEvent.click(screen.getByRole("button", { name: "Completed (1)" }));
    const completedRow = screen.getByText(first.title).closest("article")!;
    fireEvent.click(within(completedRow).getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(patchBodies).toHaveLength(2));
    expect(patchBodies[1]).toEqual({ completed_at: null });
    expect(screen.getByText(second.title)).toBeInTheDocument();
  });

  it("edit/reschedule omits interview_id and keeps the interview context label", async () => {
    const linked = followUp({ interview_id: "interview-1", title: "Original title" });
    let patchBody: Record<string, unknown> | null = null;
    installInitialFetch([linked]).mockImplementation(async (input, init) => {
      const url = input.toString();
      if (url.endsWith("/interviews")) return jsonResponse([interview()]);
      if (init?.method === "PATCH") {
        patchBody = JSON.parse(String(init.body));
        return jsonResponse({ ...linked, ...patchBody, title: "Updated title" });
      }
      return jsonResponse([linked]);
    });

    renderFollowUpsSection();
    const row = (await screen.findByText("Original title")).closest("article")!;
    expect(within(row).getByText("Round 2 · System design")).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated title" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save changes" }));

    const updatedRow = (await screen.findByText("Updated title")).closest("article")!;
    expect(patchBody).not.toHaveProperty("interview_id");
    expect(within(updatedRow).getByText("Round 2 · System design")).toBeInTheDocument();
  });

  it("delete uses ConfirmDialog; cancel makes no request and confirm makes exactly one DELETE", async () => {
    const item = followUp();
    let deleteCount = 0;
    installInitialFetch([item]).mockImplementation(async (input, init) => {
      const url = input.toString();
      if (url.endsWith("/interviews")) return jsonResponse([]);
      if (init?.method === "DELETE") {
        deleteCount += 1;
        return new Response(null, { status: 204 });
      }
      return jsonResponse([item]);
    });

    renderFollowUpsSection();
    const row = (await screen.findByText(item.title)).closest("article")!;
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete follow-up?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deleteCount).toBe(0);

    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteCount).toBe(1));
    await waitFor(() => expect(screen.queryByText(item.title)).not.toBeInTheDocument());
  });
});
