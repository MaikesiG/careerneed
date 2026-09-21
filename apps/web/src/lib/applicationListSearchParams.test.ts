import { describe, expect, it } from "vitest";
import { buildApplicationsHref, buildApplicationsRequestPath } from "./applicationListSearchParams";

describe("application list search parameters", () => {
  it("includes browser timezone in the API request while preserving status and follow-up", () => {
    const path = buildApplicationsRequestPath("interviewing", "today", "America/New_York");
    const params = new URL(path, "https://careerneed.test").searchParams;

    expect(params.get("limit")).toBe("100");
    expect(params.get("status")).toBe("interviewing");
    expect(params.get("follow_up")).toBe("today");
    expect(params.get("timezone")).toBe("America/New_York");
  });

  it("keeps timezone out of the visible applications URL", () => {
    const href = buildApplicationsHref("applied", "overdue");
    const params = new URL(href, "https://careerneed.test").searchParams;

    expect(params.get("status")).toBe("applied");
    expect(params.get("follow_up")).toBe("overdue");
    expect(params.has("timezone")).toBe(false);
  });

  it("retains existing all-filter URL and request behavior", () => {
    expect(buildApplicationsHref(null, "all")).toBe("/applications");

    const requestPath = buildApplicationsRequestPath(null, "all", "UTC");
    const params = new URL(requestPath, "https://careerneed.test").searchParams;
    expect(params.get("limit")).toBe("100");
    expect(params.get("timezone")).toBe("UTC");
    expect(params.has("follow_up")).toBe(false);
  });
});
