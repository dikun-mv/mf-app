import { InlineMessage } from '@baseline/ui';
import { isRouteErrorResponse, useRouteError } from 'react-router';

/** Shown by the router for an error thrown while rendering a route, or a URL outside the base path. */
export function RouteError() {
  const error = useRouteError();
  const text = isRouteErrorResponse(error)
    ? `${String(error.status)} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';
  return <InlineMessage tone="error">Delivery could not show this page: {text}</InlineMessage>;
}
