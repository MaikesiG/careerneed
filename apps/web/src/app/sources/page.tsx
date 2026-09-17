import { redirect } from "next/navigation";
import SourcesClient from "./SourcesClient";
import { serverApiFetch } from "@/lib/serverApi";

type Company = {
  id: string;
  name: string;
  source_type: string;
  board_token?: string | null;
  careers_url?: string | null;
  priority: string;
  active: boolean;
};

async function getInitialCompanies(): Promise<Company[]> {
  let response: Response;

  try {
    response = await serverApiFetch("/companies", {
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
