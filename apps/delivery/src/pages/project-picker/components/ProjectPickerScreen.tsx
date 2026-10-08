import { PageHeader } from '@baseline/ui';
import { PageBoundary } from '../../../shared/components';
import { ProjectList } from '../../../widgets/project-list';

/** The index route (screens 3.1): the projects, each linking to its page. The heading stays while they load. */
export function ProjectPickerScreen() {
  return (
    <>
      <PageHeader title="Projects" />
      <PageBoundary subject="Projects">
        <ProjectList />
      </PageBoundary>
    </>
  );
}
