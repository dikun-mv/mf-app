import { ProjectId } from '@baseline/delivery-contract';
import { Button } from '@baseline/ui';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { NotFoundScreen } from '../../../shared/ui';
import styles from './ProjectScreen.module.css';

/** Placeholder for one project. The id from the URL is parsed into a branded `ProjectId`. */
export function ProjectScreen() {
  const parsed = ProjectId.safeParse(useParams().projectId);
  const [edits, setEdits] = useState(0);
  if (!parsed.success) return <NotFoundScreen message="That is not a valid project id." />;
  return (
    <section className={styles.screen}>
      <h2>Project {parsed.data} (placeholder)</h2>
      <Button
        onClick={() => {
          setEdits((n) => n + 1);
        }}
      >
        Edits made: {edits}
      </Button>
      <p>
        <Link to="/">Back to the project picker</Link>
      </p>
    </section>
  );
}
