import SourcesClient from "./SourcesClient";

type Company = {
  id: string;
  name: string;
  source_type: string;
  priority: string;
  active: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getInitialCompanies(): Promise<Company[]> {
  try {
    const response = await fetch(`${API_URL}/companies`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as Company[];
  } catch {
    return [];
  }
}

export default async function SourcesPage() {
  const initialCompanies = await getInitialCompanies();

  return <SourcesClient initialCompanies={initialCompanies} />;
}
