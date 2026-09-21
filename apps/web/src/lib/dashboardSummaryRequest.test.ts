import { describe, expect, it } from "vitest";

import { dashboardSummaryRequestPath } from "./dashboardSummaryRequest";

describe("dashboardSummaryRequestPath", () => {
  it("keeps the browser timezone in the API request query only", () => {
    expect(dashboardSummaryRequestPath("America/New_York")).toBe(
      "/dashboard/summary?timezone=America%2FNew_York"
    );
  });
});
