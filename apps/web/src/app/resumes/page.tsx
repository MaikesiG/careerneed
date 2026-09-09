import ResumesClient from "./ResumesClient";

type Resume = {
  id: string;
  filename: string;
  skills: string | null;
  label: string | null;
  is_default: boolean;
  archived_at: string | null;
  source: string | null;
  uploaded_at: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getInitialResumes(): Promise<Resume[]> {
  try {
    const response = await fetch(`${API_URL}/resumes`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as Resume[];
  } catch {
    return [];
  }
}

export default async function ResumesPage() {
  const initialResumes = await getInitialResumes();

  return <ResumesClient initialResumes={initialResumes} />;
}
