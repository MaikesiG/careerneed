import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import SourcesClient from "./SourcesClient";

type Company = {
  id: string;
  name: string;
  source_type: string;
  priority: string;
  active: boolean;
};

async function getInitialCompanies(): Promise<Company[]> {
  let response: Response;

  try {
    response = await apiFetch("/companies", {
      cache: "no-store",
    });
  } catch {
    return [];
  }

  if (response.status === 401) {
    redirect(`/login?next=${encodeURIComponent("/sources")}`);
  }

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as Company[];
}

export default async function SourcesPage() {
  const initialCompanies = await getInitialCompanies();

  return <SourcesClient initialCompanies={initialCompanies} />;
}
