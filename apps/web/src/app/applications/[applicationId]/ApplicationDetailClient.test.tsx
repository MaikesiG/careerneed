import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationDetailClient from "./ApplicationDetailClient";

const replace = vi.fn();
const router = { replace };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("./ApplicationStatusEditor", () => ({
  default: () => <div>Application status editor</div>,
}));

vi.mock("./ApplicationInterviewsSection", () => ({
  default: () => <div>Interview workspace</div>,
}));

vi.mock("./ApplicationFollowUpsSection", () => ({
  default: () => <div>Canonical application follow-ups</div>,
}));

vi.mock("./ApplicationNotesEditor", () => ({
  default: () => <div>Application notes editor</div>,
}));

vi.mock("./ApplicationContactsEditor", () => ({
  default: () => <div>Application contacts editor</div>,
}));

const application = {
  id: "app-202",
  job_id: "job-101",
  resume_id: null,
  status: "interviewing",
  applied_at: "2026-09-01T12:00:00Z",
  notes: null,
  created_at: "2026-09-01T12:00:00Z",
  updated_at: "2026-09-01T12:00:00Z",
  job: {
    id: "job-101",
    company_name: "Synthetic Systems",
    source: "manual",
    title: "Platform Engineer",
    location: "Remote",
    workplace_type: "remote",
    application_url: "https://example.test/jobs/platform-engineer",
  },
};

describe("ApplicationDetailClient follow-up UI", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.restoreAllMocks();
  });

  it("renders canonical follow-ups without the deprecated application follow-up form", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: input.toString(), init });
        return new Response(JSON.stringify(application), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    );

    render(<ApplicationDetailClient applicationId={application.id} />);

    expect(await screen.findByText("Canonical application follow-ups")).toBeInTheDocument();
    expect(screen.queryByText("Follow-up date")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tomorrow" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next week" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save follow-up" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear follow-up" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    expect(requests[0].url).toContain(`/applications/${application.id}`);
    expect(
      requests.some(({ init }) => {
        if (typeof init?.body !== "string") return false;
        return init.body.includes("follow_up_on");
      })
    ).toBe(false);
  });
});
