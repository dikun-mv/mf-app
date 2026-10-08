import { Link } from 'react-router';

/** The link from an employee's page back to the register (screens 2.3). */
export function BackToRegister() {
  return (
    <Link to="/">
      <span aria-hidden="true">‹ </span>All employees
    </Link>
  );
}
