import { Navigate, type RouteObject } from 'react-router';
import { NotFound } from '../../pages/not-found';
import { RemoteRoute } from '../../widgets/remote-panel';
import { Layout } from '../Layout';

// Elements are hoisted: they never change, so React can skip re-creating them.
const layout = <Layout />;
const toPeople = <Navigate to="/people" replace />;
const people = <RemoteRoute name="people" />;
const delivery = <RemoteRoute name="delivery" />;
const notFound = <NotFound />;

/**
 * The shell's routes match only the first path segment (D22). Everything after `/people/` or
 * `/delivery/` belongs to that remote's own router, so the shell never needs to know it.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: layout,
    children: [
      { index: true, element: toPeople },
      { path: 'people/*', element: people },
      { path: 'delivery/*', element: delivery },
      { path: '*', element: notFound },
    ],
  },
];
