import { Workspace } from '@/components/workspace/Workspace';

interface ProjectPageProps {
  params: {
    id: string;
  };
}

export default function ProjectPage({ params }: ProjectPageProps) {
  return <Workspace projectId={params.id} />;
}
