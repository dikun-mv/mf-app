import { InlineMessage } from '@baseline/ui';
import { Link } from 'react-router';

/** An inline "not found" (never a crash) for an unknown route or an invalid id. */
export function NotFoundScreen({ message }: { message: string }) {
  return (
    <InlineMessage tone="warning">
      <strong>Not found.</strong> {message} <Link to="/">Back to the project picker</Link>
    </InlineMessage>
  );
}
