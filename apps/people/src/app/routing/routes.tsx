import type { RouteObject } from 'react-router';
import { EmployeeScreen } from '../../pages/employee';
import { RegisterScreen } from '../../pages/register';
import { NotFoundScreen, RouteError } from '../../shared/ui';

// Elements are hoisted: they never change, so React can skip re-creating them.
const register = <RegisterScreen />;
const employee = <EmployeeScreen />;
const notFound = <NotFoundScreen message="This page does not exist." />;
const error = <RouteError />;

/** People's routes, relative to the app's `basePath` (D22). `:employeeId` is parsed in the screen. */
export const routes: RouteObject[] = [
  { index: true, element: register, errorElement: error },
  { path: ':employeeId', element: employee, errorElement: error },
  { path: '*', element: notFound, errorElement: error },
];
