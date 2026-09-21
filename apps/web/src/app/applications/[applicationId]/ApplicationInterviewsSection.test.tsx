import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ApplicationInterviewsSection from "./ApplicationInterviewsSection";
import type { ApiError, Interview, InterviewFollowUp, InterviewParticipant } from "@/lib/api";
import type { ThankYouFollowUpPayload } from "@/lib/followUpTime";

const mockInterview: Interview = {
  id: "int-101",
  application_id: "app-202",
  round: 1,
  title: "Systems Architecture Round",
  interview_type: "system_design",
  scheduled_at: "2026-10-20T18:00:00Z",
  duration_minutes: 60,
  timezone: "UTC",
  status: "scheduled",
  result: "pending",
  interviewer_name: "Marcus Vance",
  interviewer_title: "Principal Engineer",
  interviewer_email: "marcus@example.com",
  meeting_url: "https://meet.google.com/xyz-uvwx-rst",
  location: null,
  notes: "Focus on caching tier and shard distribution.",
  preparation_notes: "Review Redis Sentinel and Raft consensus.",
  created_at: "2026-09-01T12:00:00Z",
  updated_at: "2026-09-01T12:00:00Z",
};

const mockParticipant: InterviewParticipant = {
  id: "participant-1",
  interview_id: mockInterview.id,
  contact_id: "contact-1",
  role: "interviewer",
  created_at: "2026-09-01T12:00:00Z",
  contact: {
    id: "contact-1",
    name: "Jordan Rivera",
    title: "Staff Engineer",
    email: "jordan@example.test",
    linkedin_url: null,
    relationship_type: "interviewer",
  },
  updated_at: "2026-10-01T12:00:00Z",
};

const mockFollowUp: InterviewFollowUp = {
  id: "follow-up-1",
  user_id: "user-1",
  application_id: mockInterview.application_id,
  interview_id: mockInterview.id,
  type: "thank_you",
  title: "Send thank-you note",
  due_at_utc: "2026-10-21T10:30:00Z",
  timezone: "UTC",
  completed_at: null,
  notes: null,
  created_at: "2026-09-01T12:00:00Z",
  updated_at: "2026-09-01T12:00:00Z",
};

describe("ApplicationInterviewsSection - Progressive Disclosure", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.includes("/interviews/int-101/questions")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/interviews/int-101/participants")) {
        return new Response(JSON.stringify([mockParticipant]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/follow-ups")) {
        return new Response(JSON.stringify([mockFollowUp]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/outcome-analysis")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/contacts")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Initial interviews list
      return new Response(JSON.stringify([mockInterview]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderInterviewsSection() {
    render(
      <ApplicationInterviewsSection
        applicationId="app-202"
        companyName="Stripe"
        jobTitle="Senior Systems Engineer"
      />
    );

    // Wait for the interview card to load
    await waitFor(() => {
      expect(screen.getByText("Systems Architecture Round")).toBeInTheDocument();
    });

    const questionsTrigger = screen.getByRole("button", {
      name: "Show Questions and reflections",
    });
    const participantsTrigger = screen.getByRole("button", {
      name: "Show Participants",
      expanded: false,
    });
    const followUpsTrigger = screen.getByRole("button", {
      name: "Show Follow-ups",
      expanded: false,
    });

    return {
      questionsTrigger,
      participantsTrigger,
      followUpsTrigger,
    };
  }

  it("renders one child-owned disclosure for questions, participants, and follow-ups", async () => {
    const { questionsTrigger, participantsTrigger, followUpsTrigger } =
      await renderInterviewsSection();

    expect(questionsTrigger).toHaveAttribute("aria-expanded", "false");
    expect(participantsTrigger).toHaveAttribute("aria-expanded", "false");
    expect(followUpsTrigger).toHaveAttribute("aria-expanded", "false");

    expect(screen.getAllByRole("button", { name: /Questions and reflections/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Participants/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Follow-ups/ })).toHaveLength(1);
    expect(
      screen.getByText("Capture prompts, answers, reflections, and practice links.")
    ).toBeVisible();
    expect(screen.getByText("Manage contacts who participate in this round.")).toBeVisible();
    expect(screen.getByText("Manage reminders related to this interview round.")).toBeVisible();

    const controlledIds = [questionsTrigger, participantsTrigger, followUpsTrigger].map((trigger) =>
      trigger.getAttribute("aria-controls")
    );
    expect(new Set(controlledIds).size).toBe(3);
  });

  it("does not render preparation or post-interview analysis workspace UI", async () => {
    await renderInterviewsSection();

    expect(screen.queryByRole("heading", { name: "Preparation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate preparation brief|Retry/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Post-interview analysis" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open analysis" })).toBeNull();
  });

  it("keeps question, participant, and canonical follow-up content reachable", async () => {
    const { questionsTrigger, participantsTrigger, followUpsTrigger } =
      await renderInterviewsSection();

    fireEvent.click(questionsTrigger);
    expect(await screen.findByText("No questions captured yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add question" })).toBeInTheDocument();

    fireEvent.click(participantsTrigger);
    expect(await screen.findByText(mockParticipant.contact.name)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Participants · 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add participant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit role" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();

    fireEvent.click(followUpsTrigger);
    expect(await screen.findByText(mockFollowUp.title)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Follow-ups · 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add follow-up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark complete" })).toBeInTheDocument();

    const requestedUrls = vi.mocked(globalThis.fetch).mock.calls.map(([input]) => input.toString());
    expect(requestedUrls.filter((url) => url.includes("/questions"))).toHaveLength(1);
    expect(requestedUrls.filter((url) => url.includes("/participants"))).toHaveLength(1);
    expect(requestedUrls.filter((url) => url.includes("/follow-ups"))).toHaveLength(1);
    expect(requestedUrls.some((url) => url.includes("/outcome-analysis"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/preparation-brief"))).toBe(false);
  });

  it("keeps each child disclosure independently keyboard-operable", async () => {
    const { questionsTrigger, participantsTrigger, followUpsTrigger } =
      await renderInterviewsSection();

    for (const trigger of [questionsTrigger, participantsTrigger, followUpsTrigger]) {
      trigger.focus();
      expect(trigger).toHaveFocus();
      fireEvent.keyDown(trigger, { key: "Enter" });
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(trigger).toHaveAttribute("aria-controls");
    }
  });
});

describe("ApplicationInterviewsSection - Interview Completion Workflow", () => {
  type RecordedRequest = {
    url: string;
    method: string;
    body?: unknown;
  };

  type FollowUpMockResponse = Partial<InterviewFollowUp> | ApiError;

  let recordedRequests: RecordedRequest[] = [];
  let followUpResponseStatus = 201;
  let followUpResponseBody: FollowUpMockResponse = { id: "fu-1", title: "Send thank-you note" };

  function isThankYouFollowUpPayload(value: unknown): value is ThankYouFollowUpPayload {
    return (
      typeof value === "object" &&
      value !== null &&
      "interview_id" in value &&
      "type" in value &&
      "title" in value &&
      "due_at_utc" in value &&
      "timezone" in value
    );
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    recordedRequests = [];
    followUpResponseStatus = 201;
    followUpResponseBody = { id: "fu-1", title: "Send thank-you note" };

    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        const method = init?.method || "GET";
        let body: unknown = undefined;
        if (init?.body && typeof init.body === "string") {
          try {
            body = JSON.parse(init.body);
          } catch {
            body = init.body;
          }
        }
        recordedRequests.push({ url, method, body });

        if (url.includes("/interviews/int-101/questions")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (url.includes("/interviews/int-101/participants")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (url.includes("/follow-ups")) {
          if (method === "POST") {
            return new Response(JSON.stringify(followUpResponseBody), {
              status: followUpResponseStatus,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (url.includes("/interviews/int-101") && method === "PATCH") {
          return new Response(
            JSON.stringify({ ...mockInterview, status: "completed", result: "passed" }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (url.includes("/outcome-analysis")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (url.includes("/contacts")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Initial interviews list
        return new Response(JSON.stringify([mockInterview]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opted-in completion sends one POST to the canonical follow-up endpoint with the current interview ID and does not PATCH application follow_up_on", async () => {
    render(
      <ApplicationInterviewsSection
        applicationId="app-202"
        companyName="Stripe"
        jobTitle="Senior Systems Engineer"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Systems Architecture Round")).toBeInTheDocument();
    });

    // Click Mark Completed
    const markCompletedBtn = screen.getByRole("button", { name: /mark completed/i });
    fireEvent.click(markCompletedBtn);

    // Modal opens
    expect(screen.getByText("Mark Interview Completed")).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox", { name: /schedule follow-up/i });
    expect(checkbox).toBeChecked();

    // Click Save & Complete
    const saveBtn = screen.getByRole("button", { name: /save & complete/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      // Modal should be closed
      expect(screen.queryByText("Mark Interview Completed")).not.toBeInTheDocument();
    });

    // 1. Interview was updated
    const interviewPatches = recordedRequests.filter(
      (r) => r.url.includes("/interviews/int-101") && r.method === "PATCH"
    );
    expect(interviewPatches).toHaveLength(1);
    expect(interviewPatches[0].body).toMatchObject({
      status: "completed",
      result: "passed",
    });

    // 2. Exactly one canonical follow-up POST was sent
    const followUpPosts = recordedRequests.filter(
      (r) => r.url.includes("/applications/app-202/follow-ups") && r.method === "POST"
    );
    expect(followUpPosts).toHaveLength(1);
    expect(followUpPosts[0].body).toMatchObject({
      interview_id: "int-101",
      type: "thank_you",
      title: "Send thank-you note: Systems Architecture Round",
      notes: "Thank-you note reminder after Systems Architecture Round",
    });
    const followUpBody = followUpPosts[0].body;
    expect(isThankYouFollowUpPayload(followUpBody)).toBe(true);
    if (!isThankYouFollowUpPayload(followUpBody)) {
      throw new Error("Expected follow-up request body to match ThankYouFollowUpPayload");
    }
    expect(followUpBody.due_at_utc).toBeDefined();
    expect(followUpBody.timezone).toBeDefined();

    // 3. No legacy PATCH to /applications/app-202 was issued
    const appPatches = recordedRequests.filter(
      (r) => r.url.endsWith("/applications/app-202") && r.method === "PATCH"
    );
    expect(appPatches).toHaveLength(0);
  });

  it("opt-out sends no follow-up POST and does not PATCH application", async () => {
    render(
      <ApplicationInterviewsSection
        applicationId="app-202"
        companyName="Stripe"
        jobTitle="Senior Systems Engineer"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Systems Architecture Round")).toBeInTheDocument();
    });

    const markCompletedBtn = screen.getByRole("button", { name: /mark completed/i });
    fireEvent.click(markCompletedBtn);

    expect(screen.getByText("Mark Interview Completed")).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox", { name: /schedule follow-up/i });
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    const saveBtn = screen.getByRole("button", { name: /save & complete/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.queryByText("Mark Interview Completed")).not.toBeInTheDocument();
    });

    // Interview was updated
    const interviewPatches = recordedRequests.filter(
      (r) => r.url.includes("/interviews/int-101") && r.method === "PATCH"
    );
    expect(interviewPatches).toHaveLength(1);

    // No follow-up POST
    const followUpPosts = recordedRequests.filter(
      (r) => r.url.includes("/follow-ups") && r.method === "POST"
    );
    expect(followUpPosts).toHaveLength(0);

    // No legacy application PATCH
    const appPatches = recordedRequests.filter(
      (r) => r.url.endsWith("/applications/app-202") && r.method === "PATCH"
    );
    expect(appPatches).toHaveLength(0);
  });

  it("failure of follow-up creation renders a safe message and does not expose technical error text", async () => {
    followUpResponseStatus = 500;
    followUpResponseBody = {
      detail: "Internal Server Error: DB connection refused at pg_pool:5432",
    };

    render(
      <ApplicationInterviewsSection
        applicationId="app-202"
        companyName="Stripe"
        jobTitle="Senior Systems Engineer"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Systems Architecture Round")).toBeInTheDocument();
    });

    const markCompletedBtn = screen.getByRole("button", { name: /mark completed/i });
    fireEvent.click(markCompletedBtn);

    const saveBtn = screen.getByRole("button", { name: /save & complete/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      // Safe nontechnical message should be displayed
      expect(
        screen.getByText(
          /Interview marked completed, but unable to schedule the thank-you follow-up/i
        )
      ).toBeInTheDocument();
    });

    // Technical DB error must NOT be exposed
    expect(screen.queryByText(/pg_pool:5432/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Internal Server Error/i)).not.toBeInTheDocument();

    // Modal is dismissed
    expect(screen.queryByText("Mark Interview Completed")).not.toBeInTheDocument();
  });

  it("duplicate submission does not create two follow-ups", async () => {
    render(
      <ApplicationInterviewsSection
        applicationId="app-202"
        companyName="Stripe"
        jobTitle="Senior Systems Engineer"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Systems Architecture Round")).toBeInTheDocument();
    });

    const markCompletedBtn = screen.getByRole("button", { name: /mark completed/i });
    fireEvent.click(markCompletedBtn);

    const saveBtn = screen.getByRole("button", { name: /save & complete/i });
    // Click twice rapidly
    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.queryByText("Mark Interview Completed")).not.toBeInTheDocument();
    });

    const followUpPosts = recordedRequests.filter(
      (r) => r.url.includes("/applications/app-202/follow-ups") && r.method === "POST"
    );
    expect(followUpPosts).toHaveLength(1);
  });
});
