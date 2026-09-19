import { describe, it, expect } from "vitest";
import {
  buildJobsSearchParams,
  encodeKeywordGroup,
  type KeywordGroup,
  type JobFilters,
} from "./jobsSearchParams";

describe("jobsSearchParams - Group 6: URL Search Parameter Helper", () => {
  const defaultBaseFilters: JobFilters = {
    q: "",
    locationQuery: "",
    sources: [],
    workplaceTypes: [],
    applicationStatuses: [],
    minMatchScore: null,
    dateRange: "all",
    keywordGroups: [],
    sort: "match_score",
    sortDirection: "desc",
  };

  it("retains unrelated query parameters present in the existing URL", () => {
    const existingParams = "utm_source=linkedin&campaign=fall2026&ref_id=candidate_987&theme=dark";

    const result = buildJobsSearchParams(
      existingParams,
      { q: "Frontend Lead" },
      defaultBaseFilters
    );

    expect(result.get("utm_source")).toBe("linkedin");
    expect(result.get("campaign")).toBe("fall2026");
    expect(result.get("ref_id")).toBe("candidate_987");
    expect(result.get("theme")).toBe("dark");
    expect(result.get("q")).toBe("Frontend Lead");
  });

  it("resets or removes the page parameter correctly", () => {
    // 1. When existing parameters have page=4, updating search resets page by removing it
    const withPageFour = new URLSearchParams("page=4&q=engineer");
    const resetResult = buildJobsSearchParams(
      withPageFour,
      { q: "senior engineer" }, // page not specified -> defaults to 1 -> deleted
      defaultBaseFilters
    );
    expect(resetResult.has("page")).toBe(false);

    // 2. Explicitly setting page to 1 removes the parameter
    const explicitPageOne = buildJobsSearchParams(
      withPageFour,
      { page: 1 },
      defaultBaseFilters
    );
    expect(explicitPageOne.has("page")).toBe(false);

    // 3. Setting page to 0 or negative removes the parameter
    const explicitPageZero = buildJobsSearchParams(
      withPageFour,
      { page: 0 },
      defaultBaseFilters
    );
    expect(explicitPageZero.has("page")).toBe(false);

    // 4. Setting page > 1 retains the specific page number
    const pageThreeResult = buildJobsSearchParams(
      "",
      { page: 3 },
      defaultBaseFilters
    );
    expect(pageThreeResult.get("page")).toBe("3");
  });

  it("trims and removes empty or default values", () => {
    // 1. Trims query string and location query
    const trimmedResult = buildJobsSearchParams(
      "",
      {
        q: "   Senior Fullstack Developer   ",
        locationQuery: "   New York, NY   ",
      },
      defaultBaseFilters
    );
    expect(trimmedResult.get("q")).toBe("Senior Fullstack Developer");
    expect(trimmedResult.get("location_query")).toBe("New York, NY");

    // 2. Removes whitespace-only query and location
    const emptyResult = buildJobsSearchParams(
      "q=existing&location_query=existing_loc",
      {
        q: "   ",
        locationQuery: "",
      },
      defaultBaseFilters
    );
    expect(emptyResult.has("q")).toBe(false);
    expect(emptyResult.has("location_query")).toBe(false);

    // 3. Removes default dateRange ("all")
    const defaultDateRangeResult = buildJobsSearchParams(
      "date_range=week",
      { dateRange: "all" },
      defaultBaseFilters
    );
    expect(defaultDateRangeResult.has("date_range")).toBe(false);

    // 4. Retains non-default dateRange
    const nonDefaultDateRange = buildJobsSearchParams(
      "",
      { dateRange: "week" },
      defaultBaseFilters
    );
    expect(nonDefaultDateRange.get("date_range")).toBe("week");

    // 5. Removes null minMatchScore
    const nullScoreResult = buildJobsSearchParams(
      "min_match_score=75",
      { minMatchScore: null },
      defaultBaseFilters
    );
    expect(nullScoreResult.has("min_match_score")).toBe(false);

    // 6. Retains numeric minMatchScore
    const setScoreResult = buildJobsSearchParams(
      "",
      { minMatchScore: 80 },
      defaultBaseFilters
    );
    expect(setScoreResult.get("min_match_score")).toBe("80");
  });

  it("preserves multi-value encoding for sources, workplace types, statuses, and keyword groups", () => {
    const keywordGroups: KeywordGroup[] = [
      {
        id: "kg-1",
        label: "Core Backend",
        keywords: ["Go", "Kubernetes", "gRPC"],
        enabled: true,
      },
      {
        id: "kg-2",
        label: "AI & ML",
        keywords: ["PyTorch", "Transformers"],
        enabled: false,
      },
    ];

    const result = buildJobsSearchParams(
      "",
      {
        sources: ["ashby", "greenhouse", "lever"],
        workplaceTypes: ["remote", "hybrid"],
        applicationStatuses: ["saved", "interviewing", "offer"],
        keywordGroups,
      },
      defaultBaseFilters
    );

    // Multi-value sources
    expect(result.getAll("source")).toEqual(["ashby", "greenhouse", "lever"]);

    // Multi-value workplace types
    expect(result.getAll("workplace_type")).toEqual(["remote", "hybrid"]);

    // Multi-value application statuses
    expect(result.getAll("application_status")).toEqual([
      "saved",
      "interviewing",
      "offer",
    ]);

    // Multi-value keyword groups with encoding: enabled::id::label::keywords
    const encodedGroups = result.getAll("kw");
    expect(encodedGroups).toHaveLength(2);
    expect(encodedGroups[0]).toBe("1::kg-1::Core%20Backend::Go,Kubernetes,gRPC");
    expect(encodedGroups[1]).toBe("0::kg-2::AI%20%26%20ML::PyTorch,Transformers");
  });

  it("correctly encodes single keyword groups using encodeKeywordGroup", () => {
    const group: KeywordGroup = {
      id: "abc-123",
      label: "Platform / DevOps",
      keywords: ["terraform", "ci/cd", "aws"],
      enabled: true,
    };

    const encoded = encodeKeywordGroup(group);
    expect(encoded).toBe("1::abc-123::Platform%20%2F%20DevOps::terraform,ci%2Fcd,aws");
  });
});
