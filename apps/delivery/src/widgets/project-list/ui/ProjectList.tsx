import { formatDate } from '@baseline/delivery-domain';
import { Table, TableCell, TableHeaderCell } from '@baseline/ui';
import { Link } from 'react-router';
import { projectMonths, useProjects } from '../../../entities/project';

/**
 * The projects as a table of name, dates and months (screens 3.1). A name links to the project's page,
 * `<basePath>/:projectId`. Suspends until the projects are loaded; the page shows that state (D32).
 */
export function ProjectList() {
  const projects = useProjects();
  return (
    <Table aria-label="Projects">
      <thead>
        <tr>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Dates</TableHeaderCell>
          <TableHeaderCell numeric>Months</TableHeaderCell>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr key={project.id}>
            <TableHeaderCell scope="row">
              <Link to={`/${project.id}`}>{project.name}</Link>
            </TableHeaderCell>
            <TableCell>
              {formatDate(project.startDate)} &ndash; {formatDate(project.endDate)}
            </TableCell>
            <TableCell numeric>{projectMonths(project).length}</TableCell>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
