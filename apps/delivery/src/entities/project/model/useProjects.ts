import type { Project, ProjectId } from '@baseline/delivery-contract';
import { useSuspenseQuery } from '@tanstack/react-query';
import { collectionQuery, useRepository } from '../../../shared/api';

/**
 * Delivery's projects. They are the page's own data, so this suspends until they load and throws when they
 * can't (D32): the page's `Suspense` and error boundary show those states.
 */
export function useProjects(): readonly Project[] {
  return useSuspenseQuery(collectionQuery(useRepository(), 'projects')).data;
}

/** One project, or `undefined` when there is none with this id. Suspends like `useProjects`. */
export function useProject(id: ProjectId | undefined): Project | undefined {
  return useSuspenseQuery({
    ...collectionQuery(useRepository(), 'projects'),
    select: (projects) => projects.find((project) => project.id === id),
  }).data;
}
