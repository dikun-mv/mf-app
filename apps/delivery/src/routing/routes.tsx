import type { RouteObject } from 'react-router';
import { NotFoundScreen } from '../screens/NotFoundScreen';
import { ProjectPickerScreen } from '../screens/ProjectPickerScreen';
import { ProjectScreen } from '../screens/ProjectScreen';
import { RouteError } from '../screens/RouteError';

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
