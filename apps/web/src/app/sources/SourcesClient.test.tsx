import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SourcesClient from "./SourcesClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("SourcesClient curated targets", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("previews exact counts and cancel does not create targets", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ total_curated: 123, to_create: 120, already_present: 3 })
    );
    render(<SourcesClient initialCompanies={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Add all" }));

    expect(await screen.findByRole("dialog", { name: "Add curated targets?" })).toBeInTheDocument();
    expect(screen.getByText(/120 curated targets will be added/)).toBeInTheDocument();
    expect(screen.getByText(/3 already present will be skipped/)).toBeInTheDocument();
    expect(screen.getByText(/user-owned manual targets/)).toBeInTheDocument();
    expect(screen.getByText(/does not sync jobs or access external job platforms/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0].toString()).toContain("/companies/curated-targets/preview");
  });

  it("confirms exactly once, refreshes sources, and shows success feedback", async () => {
    let resolveCreate: ((response: Response) => void) | undefined;
    const createResponse = new Promise<Response>((resolve) => {
      resolveCreate = resolve;
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ total_curated: 123, to_create: 122, already_present: 1 })
      )
      .mockImplementationOnce(() => createResponse)
      .mockResolvedValueOnce(jsonResponse([]));
    render(<SourcesClient initialCompanies={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Add all" }));
    const confirm = await screen.findByRole("button", { name: "Add 122 targets" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(confirm).toBeDisabled());
    expect(
      fetchSpy.mock.calls.filter(([input]) =>
        input.toString().includes("/companies/curated-targets/add-all")
      )
    ).toHaveLength(1);

    resolveCreate?.(
      jsonResponse({ created: 122, already_present: 1, total_curated: 123 })
    );
    expect(
      await screen.findByText("Added 122 curated targets. 1 were already present.")
    ).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("treats an already-complete preview as a non-error and never creates", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ total_curated: 123, to_create: 0, already_present: 123 })
    );
    render(<SourcesClient initialCompanies={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Add all" }));

    expect(
      await screen.findByText("All curated targets are already in your list.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All added" })).toBeDisabled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("shows the existing safe error UI when preview fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({}, 500));
    render(<SourcesClient initialCompanies={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Add all" }));

    expect(await screen.findByText("Unable to preview curated targets.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
