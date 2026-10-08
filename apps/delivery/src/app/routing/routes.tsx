import type { RouteObject } from 'react-router';
import { ProjectScreen } from '../../pages/project';
import { ProjectPickerScreen } from '../../pages/project-picker';
import { NotFoundScreen, RouteError } from '../../shared/components';

// Elements are hoisted: they never change, so React can skip re-creating them.
const picker = <ProjectPickerScreen />;
const project = <ProjectScreen />;
const notFound = <NotFoundScreen message="This page does not exist." />;
const error = <RouteError />;

/** Delivery's routes, relative to the app's `basePath` (D22). `:projectId` is parsed in the screen. */
export const routes: RouteObject[] = [
  { index: true, element: picker, errorElement: error },
  { path: ':projectId', element: project, errorElement: error },
  { path: '*', element: notFound, errorElement: error },
];
