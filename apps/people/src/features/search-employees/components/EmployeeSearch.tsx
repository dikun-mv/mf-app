import { TextField } from '@baseline/ui';
import styles from './EmployeeSearch.module.css';

/** The register's search box (screens 2.1): filters by name or role as you type. */
export function EmployeeSearch({ term, onChange }: { term: string; onChange: (term: string) => void }) {
  return (
    <TextField
      type="search"
      label="Search name or role"
      className={styles.search}
      value={term}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      autoComplete="off"
    />
  );
}
