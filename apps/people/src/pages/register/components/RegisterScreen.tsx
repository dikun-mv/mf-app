import { PageHeader } from '@baseline/ui';
import { PageBoundary } from '../../../shared/ui';
import { EmployeeRegister } from '../../../widgets/employee-register';

/** The register page at the app's base path (screens 2.1): its title, then the register under the page's loading and failed states. */
export function RegisterScreen() {
  return (
    <div>
      <PageHeader title="Employees" />
      <PageBoundary subject="employees">
        <EmployeeRegister />
      </PageBoundary>
    </div>
  );
}
