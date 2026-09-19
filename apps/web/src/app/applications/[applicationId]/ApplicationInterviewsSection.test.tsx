import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ApplicationInterviewsSection from "./ApplicationInterviewsSection";
import type { ApiError, Interview, InterviewFollowUp } from "@/lib/api";
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
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/follow-ups")) {
        return new Response(JSON.stringify([]), {
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

    // Grab the disclosure triggers
    const prepTrigger = screen.getByRole("button", {
      name: /^preparation/i,
    });
    const questionsTrigger = screen.getByRole("button", {
      name: /^questions and reflections/i,
    });
    const participantsTrigger = screen.getByRole("button", {
      name: /^participants/i,
      expanded: false,
    });
    const followUpsTrigger = screen.getByRole("button", {
      name: /^follow-ups/i,
      expanded: false,
    });

    const prepPanel = document.getElementById(
      prepTrigger.getAttribute("aria-controls")!
    )!;
    const questionsPanel = document.getElementById(
      questionsTrigger.getAttribute("aria-controls")!
    )!;
    const participantsPanel = document.getElementById(
      participantsTrigger.getAttribute("aria-controls")!
    )!;
    const followUpsPanel = document.getElementById(
      followUpsTrigger.getAttribute("aria-controls")!
    )!;

    return {
      prepTrigger,
      questionsTrigger,
      participantsTrigger,
      followUpsTrigger,
      prepPanel,
      questionsPanel,
      participantsPanel,
      followUpsPanel,
    };
  }

  it("1. Preparation starts expanded; other conceptual sections start collapsed", async () => {
    const {
      prepTrigger,
      questionsTrigger,
      participantsTrigger,
      followUpsTrigger,
      prepPanel,
      questionsPanel,
      participantsPanel,
      followUpsPanel,
    } = await renderInterviewsSection();

    // Preparation is expanded by default
    expect(prepTrigger).toHaveAttribute("aria-expanded", "true");
    expect(prepPanel).toBeVisible();

    // Questions and reflections is collapsed by default
    expect(questionsTrigger).toHaveAttribute("aria-expanded", "false");
    expect(questionsPanel).not.toBeVisible();

    // Participants is collapsed by default
    expect(participantsTrigger).toHaveAttribute("aria-expanded", "false");
    expect(participantsPanel).not.toBeVisible();

    // Follow-ups is collapsed by default
    expect(followUpsTrigger).toHaveAttribute("aria-expanded", "false");
    expect(followUpsPanel).not.toBeVisible();
  });

  it("2. Multiple sections can independently remain open", async () => {
    const {
      prepTrigger,
      questionsTrigger,
      participantsTrigger,
      prepPanel,
      questionsPanel,
      participantsPanel,
    } = await renderInterviewsSection();

    // Preparation starts open
    expect(prepTrigger).toHaveAttribute("aria-expanded", "true");
    expect(prepPanel).toBeVisible();

    // Open Questions and reflections
    fireEvent.click(questionsTrigger);
    expect(questionsTrigger).toHaveAttribute("aria-expanded", "true");
    expect(questionsPanel).toBeVisible();

    // Preparation remains open (independent multi-open behavior)
    expect(prepTrigger).toHaveAttribute("aria-expanded", "true");
    expect(prepPanel).toBeVisible();

    // Open Participants as well
    fireEvent.click(participantsTrigger);
    expect(participantsTrigger).toHaveAttribute("aria-expanded", "true");
    expect(participantsPanel).toBeVisible();

    // All three sections are simultaneously open
    expect(prepTrigger).toHaveAttribute("aria-expanded", "true");
    expect(questionsTrigger).toHaveAttribute("aria-expanded", "true");
    expect(participantsTrigger).toHaveAttribute("aria-expanded", "true");
    expect(prepPanel).toBeVisible();
    expect(questionsPanel).toBeVisible();
    expect(participantsPanel).toBeVisible();
  });

  it("3. Each trigger correctly updates aria-expanded and panel visibility", async () => {
    const {
      prepTrigger,
      followUpsTrigger,
      prepPanel,
      followUpsPanel,
    } = await renderInterviewsSection();

    // Toggle Preparation: expanded -> collapsed
    fireEvent.click(prepTrigger);
    expect(prepTrigger).toHaveAttribute("aria-expanded", "false");
    expect(prepPanel).not.toBeVisible();

    // Toggle Preparation: collapsed -> expanded
    fireEvent.click(prepTrigger);
    expect(prepTrigger).toHaveAttribute("aria-expanded", "true");
    expect(prepPanel).toBeVisible();

    // Toggle Follow-ups: collapsed -> expanded
    fireEvent.click(followUpsTrigger);
    expect(followUpsTrigger).toHaveAttribute("aria-expanded", "true");
    expect(followUpsPanel).toBeVisible();

    // Toggle Follow-ups: expanded -> collapsed
    fireEvent.click(followUpsTrigger);
    expect(followUpsTrigger).toHaveAttribute("aria-expanded", "false");
    expect(followUpsPanel).not.toBeVisible();
  });

  it("4. Collapsing/reopening a section does not reset an active text input or discard entered draft text", async () => {
    const {
      questionsTrigger,
      questionsPanel,
    } = await renderInterviewsSection();

    // Open Questions and reflections section
    fireEvent.click(questionsTrigger);
    expect(questionsTrigger).toHaveAttribute("aria-expanded", "true");
    expect(questionsPanel).toBeVisible();

    // Inside questions section, open questions and the Add Question form
    const showQuestionsButton = await screen.findByRole("button", {
      name: "Show questions",
    });
    fireEvent.click(showQuestionsButton);

    const addQuestionButton = await screen.findByRole("button", {
      name: "+ Add question",
    });
    fireEvent.click(addQuestionButton);

    // Enter draft question text in the form
    const questionTextarea = await screen.findByPlaceholderText(
      "What question was asked?"
    );
    fireEvent.change(questionTextarea, {
      target: { value: "How would you design a distributed rate limiter?" },
    });
    expect(questionTextarea).toHaveValue(
      "How would you design a distributed rate limiter?"
    );

    // Collapse the Questions and reflections disclosure section
    fireEvent.click(questionsTrigger);
    expect(questionsTrigger).toHaveAttribute("aria-expanded", "false");
    expect(questionsPanel).not.toBeVisible();

    // Reopen the Questions and reflections disclosure section
    fireEvent.click(questionsTrigger);
    expect(questionsTrigger).toHaveAttribute("aria-expanded", "true");
    expect(questionsPanel).toBeVisible();

    // Verify the active draft text was retained and not discarded
    const restoredTextarea = screen.getByPlaceholderText(
      "What question was asked?"
    );
    expect(restoredTextarea).toBeVisible();
    expect(restoredTextarea).toHaveValue(
      "How would you design a distributed rate limiter?"
    );
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

  function isThankYouFollowUpPayload(
    value: unknown
  ): value is ThankYouFollowUpPayload {
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
