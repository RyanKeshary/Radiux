import { Workspace } from '@/components/workspace/Workspace';

interface ProjectPageProps {
  // Next.js 15+ delivers dynamic route params as a Promise.
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  return <Workspace projectId={id} />;
}