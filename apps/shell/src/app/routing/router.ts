import { createBrowserRouter } from 'react-router';
import { routes } from './routes';

/** The shell's single router, created once for the life of the page. Remotes create their own (D22). */
export const router = createBrowserRouter(routes);
