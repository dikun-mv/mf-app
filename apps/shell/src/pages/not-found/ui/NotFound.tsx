import { InlineMessage } from '@baseline/ui';
import { Link } from 'react-router';

export function NotFound() {
  return (
    <InlineMessage tone="warning">
      <strong>Not found.</strong> <Link to="/people">Go to People</Link>
    </InlineMessage>
  );
}
