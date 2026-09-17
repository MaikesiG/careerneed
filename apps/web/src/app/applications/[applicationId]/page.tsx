import ApplicationDetailClient from "./ApplicationDetailClient";

type ApplicationPageProps = {
  params: Promise<{
    applicationId: string;
  }>;
};

export default async function ApplicationPage({ params }: ApplicationPageProps) {
  const { applicationId } = await params;

  return <ApplicationDetailClient applicationId={applicationId} />;
}
