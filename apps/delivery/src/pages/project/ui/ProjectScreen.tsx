import { ProjectId } from '@baseline/delivery-contract';
import { formatDate } from '@baseline/delivery-domain';
import { InlineMessage, PageHeader } from '@baseline/ui';
import { Link, useParams } from 'react-router';
import { useProject } from '../../../entities/project';
import { PageBoundary } from '../../../shared/ui';
import { StaffingGrid } from '../../../widgets/staffing-grid';
import styles from './ProjectScreen.module.css';

const BackToProjects = () => (
  <Link to="/">
    <span aria-hidden="true">&lsaquo;</span> Projects
  </Link>
);

function ProjectNotFound({ id }: { id: string }) {
  return (
    <div className={styles.notFound}>
      <div className={styles.back}>
        <BackToProjects />
      </div>
      <InlineMessage tone="warning">Project not found: there is no project "{id}".</InlineMessage>
    </div>
  );
}

/**
 * A project that exists: its header, then the staffing grid. The grid loads on its own, so the header is
 * there while it does.
 */
function ProjectPage({ id }: { id: ProjectId }) {
  const project = useProject(id);
  if (!project) return <ProjectNotFound id={id} />;
  return (
    <>
      <PageHeader
        back={<BackToProjects />}
        title={project.name}
        subtitle={`${formatDate(project.startDate)} – ${formatDate(project.endDate)}`}
      />
      <PageBoundary subject="Staffing grid">
        <StaffingGrid projectId={id} />
      </PageBoundary>
    </>
  );
}

/**
 * The project route, `<basePath>/:projectId` (screens 3.7, 4). The id comes from the URL and is parsed into
 * a branded `ProjectId`; one that can't be an id never reaches the data. An id nobody has gets the same
 * message after the projects load.
 */
export function ProjectScreen() {
  const id = useParams().projectId ?? '';
  const parsed = ProjectId.safeParse(id);
  if (!parsed.success) return <ProjectNotFound id={id} />;
  return (
    <PageBoundary
      subject="Project"
      above={
        <div className={styles.back}>
          <BackToProjects />
        </div>
      }
    >
      <ProjectPage id={parsed.data} />
    </PageBoundary>
  );
}
