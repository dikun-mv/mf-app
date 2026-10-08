import type { ProjectId } from '@baseline/delivery-contract';
import type { PlanState } from '@baseline/delivery-domain';
import { Button } from '@baseline/ui';
import { useState } from 'react';
import type { ActionReport } from '../../../shared/lib';
import { AddItemDialog } from './AddItemDialog';

interface AddTopLevelItemProps {
  readonly state: PlanState;
  readonly projectId: ProjectId;
  readonly report: ActionReport;
}

/** "+ Add top-level item" (screens 3.2, 3.4): the button, and the dialog it opens. */
export function AddTopLevelItem({ state, projectId, report }: AddTopLevelItemProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        + Add top-level item
      </Button>
      {open && (
        <AddItemDialog
          state={state}
          projectId={projectId}
          parent={null}
          report={report}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
