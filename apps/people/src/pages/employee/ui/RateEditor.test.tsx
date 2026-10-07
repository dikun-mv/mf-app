import { Currency } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, rateRecordKeys } from '../../../shared/api';
import {
  ADAEZE_CURRENT_RATE,
  ADAEZE_FIRST_RATE,
  RATE_RECORDS,
  createFakeRepository,
  renderWithApp,
  testContext,
  type RenderWithAppOptions,
} from '../../../shared/testing';
import { EmployeeScreen } from './EmployeeScreen';

const routes = [{ path: ':employeeId', element: <EmployeeScreen /> }];
const USD = testContext({ currency: Currency.parse({ code: 'USD', perEur: 1.08 }) });

async function openEmployee(options: RenderWithAppOptions = {}) {
  const app = renderWithApp(routes, { route: '/emp-001', ...options });
  await screen.findByRole('heading', { level: 1, name: 'Adaeze Okafor' });
  return { ...app, user: userEvent.setup() };
}

const addForm = () => within(screen.getByRole('form', { name: 'Add a rate' }));
const correctRow = () => within(screen.getByRole('button', { name: 'Save' }).closest('tr') ?? document.body);

/** The history's days and costs, newest first. */
const listedRates = () =>
  within(screen.getByRole('table', { name: 'Rate history' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .slice(0, 2)
        .map((cell) => cell.textContent)
        .join(' '),
    );

async function fillAdd(user: ReturnType<typeof userEvent.setup>, day: string, cost: string) {
  const form = addForm();
  await user.type(form.getByLabelText('Valid from'), day);
  await user.type(form.getByLabelText(/Hourly cost/), cost);
}

describe('adding a rate', () => {
  it('saves it in EUR, lists it, says so in the status line and clears the form', async () => {
    const { user, repository } = await openEmployee();
    await fillAdd(user, '2026-11-01', '98.00');
    await user.click(addForm().getByRole('button', { name: 'Add rate' }));

    expect(await screen.findByText('Rate from 1 Nov 2026 added.')).toBeInTheDocument();
    expect(repository.writes).toHaveLength(1);
    expect(repository.writes[0]?.create).toMatchObject([
      { employeeId: 'emp-001', validFrom: '2026-11-01', hourlyCost: 98 },
    ]);
    expect(listedRates()).toEqual([
      '1 Jan 2099 €120.00/h',
      '1 Nov 2026 €98.00/h',
      '12 Mar 2026 €95.00/hcurrent',
      '1 Jan 2025 €80.00/h',
    ]);
    expect(addForm().getByLabelText('Valid from')).toHaveValue('');
    expect(addForm().getByLabelText(/Hourly cost/)).toHaveValue('');
  });

  it('keeps what was typed while the write was on its way, as the next draft, instead of clearing it', async () => {
    const repository = createFakeRepository();
    const { user } = await openEmployee({ repository });
    const release = repository.holdWrites();
    await fillAdd(user, '2026-11-01', '98');
    await user.click(addForm().getByRole('button', { name: 'Add rate' }));
    expect(addForm().getByRole('button', { name: 'Add rate' })).toBeDisabled();

    const cost = addForm().getByLabelText(/Hourly cost/);
    await user.clear(cost);
    await user.type(cost, '105');
    release();

    expect(await screen.findByText('Rate from 1 Nov 2026 added.')).toBeInTheDocument();
    expect(addForm().getByLabelText(/Hourly cost/)).toHaveValue('105');
    expect(repository.writes[0]?.create.at(0)?.hourlyCost).toBe(98);
  });

  it('takes the cost in the display currency, names it in the label, and stores it in EUR', async () => {
    const { user, repository } = await openEmployee({ ctx: USD });
    expect(addForm().getByLabelText('Hourly cost (USD)')).toBeInTheDocument();
    await fillAdd(user, '2026-11-01', '108');
    await user.click(addForm().getByRole('button', { name: 'Add rate' }));

    expect(await screen.findByText('Rate from 1 Nov 2026 added.')).toBeInTheDocument();
    expect(repository.writes[0]?.create.at(0)?.hourlyCost).toBeCloseTo(100, 10);
    expect(listedRates()).toContain('1 Nov 2026 $108.00/h');
  });

  it('refuses a day that another rate already starts on, at the day field, and sends nothing', async () => {
    const { user, repository } = await openEmployee();
    await fillAdd(user, '2026-03-12', '90');
    await user.click(addForm().getByRole('button', { name: 'Add rate' }));

    const error = await screen.findByText('Another rate already starts on 12 Mar 2026.');
    expect(addForm().getByLabelText('Valid from')).toHaveAccessibleDescription(error.textContent);
    expect(addForm().getByLabelText('Valid from')).toBeInvalid();
    expect(repository.writes).toHaveLength(0);
    expect(listedRates()).toHaveLength(3);
  });

  it('refuses a cost of 0, at the cost field, and sends nothing', async () => {
    const { user, repository } = await openEmployee();
    await fillAdd(user, '2026-11-01', '0');
    await user.click(addForm().getByRole('button', { name: 'Add rate' }));

    expect(await screen.findByText('The cost must be above 0.')).toBeInTheDocument();
    expect(addForm().getByLabelText(/Hourly cost/)).toBeInvalid();
    expect(repository.writes).toHaveLength(0);
  });

  it.each([
    ['', '2026-11-01', 'Enter the hourly cost.'],
    ['abc', '2026-11-01', 'Enter the cost as a number, for example 98.00.'],
    ['-5', '2026-11-01', 'The cost must be above 0.'],
    ['98', '', 'Enter the day the rate starts.'],
  ])('refuses cost "%s" with day "%s": %s', async (cost, day, message) => {
    const { user, repository } = await openEmployee();
    const form = addForm();
    if (day !== '') await user.type(form.getByLabelText('Valid from'), day);
    if (cost !== '') await user.type(form.getByLabelText(/Hourly cost/), cost);
    await user.click(form.getByRole('button', { name: 'Add rate' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(repository.writes).toHaveLength(0);
  });
});

describe('correcting a rate', () => {
  it('turns the row into a form with the stored values, in the display currency', async () => {
    const { user } = await openEmployee({ ctx: USD });
    await user.click(screen.getByRole('button', { name: 'Correct the rate from 12 Mar 2026' }));
    const row = correctRow();
    expect(row.getByLabelText('Valid from')).toHaveValue('2026-03-12');
    expect(row.getByLabelText('Hourly cost (USD)')).toHaveValue('102.60');
  });

  it('saves a new cost and says so', async () => {
    const { user, repository } = await openEmployee();
    await user.click(screen.getByRole('button', { name: 'Correct the rate from 12 Mar 2026' }));
    const cost = correctRow().getByLabelText('Hourly cost (EUR)');
    await user.clear(cost);
    await user.type(cost, '97');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Rate from 12 Mar 2026 corrected.')).toBeInTheDocument();
    expect(repository.writes[0]?.update).toEqual([{ ...ADAEZE_CURRENT_RATE, hourlyCost: 97 }]);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(listedRates()).toContain('12 Mar 2026 €97.00/hcurrent');
  });

  it('refuses a day that another rate already starts on, nothing is saved, and Cancel leaves the list as it was', async () => {
    const { user, repository } = await openEmployee();
    await user.click(screen.getByRole('button', { name: 'Correct the rate from 1 Jan 2025' }));
    const day = correctRow().getByLabelText('Valid from');
    await user.clear(day);
    await user.type(day, '2026-03-12');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Another rate already starts on 12 Mar 2026.')).toBeInTheDocument();
    expect(repository.writes).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(listedRates()).toEqual(['1 Jan 2099 €120.00/h', '12 Mar 2026 €95.00/hcurrent', '1 Jan 2025 €80.00/h']);
  });

  it('makes no write, and says nothing, when the correction changes nothing', async () => {
    const { user, repository } = await openEmployee();
    await user.click(screen.getByRole('button', { name: 'Correct the rate from 12 Mar 2026' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(repository.writes).toHaveLength(0);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('makes no write for the value it showed in another currency, so a round trip never nudges a stored rate', async () => {
    const { user, repository } = await openEmployee({ ctx: USD });
    await user.click(screen.getByRole('button', { name: 'Correct the rate from 12 Mar 2026' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(repository.writes).toHaveLength(0);

    // Retyping the same figure is no change either, and neither is an amount that shows the same.
    await user.click(screen.getByRole('button', { name: 'Correct the rate from 12 Mar 2026' }));
    const cost = correctRow().getByLabelText('Hourly cost (USD)');
    await user.clear(cost);
    await user.type(cost, '102.6');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(repository.writes).toHaveLength(0);
    expect(listedRates()).toContain('12 Mar 2026 $102.60/hcurrent');
  });

  it('changes only the day when only the day differs, so the stored cost stays exact', async () => {
    const { user, repository } = await openEmployee({ ctx: USD });
    await user.click(screen.getByRole('button', { name: 'Correct the rate from 12 Mar 2026' }));
    const day = correctRow().getByLabelText('Valid from');
    await user.clear(day);
    await user.type(day, '2026-03-16');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Rate from 16 Mar 2026 corrected.')).toBeInTheDocument();
    expect(repository.writes[0]?.update[0]).toEqual({ ...ADAEZE_CURRENT_RATE, validFrom: '2026-03-16' });
  });

  it('keeps the draft but cannot save it when the rate is removed elsewhere', async () => {
    const { user, repository, queryClient } = await openEmployee();
    await user.click(screen.getByRole('button', { name: 'Correct the rate from 1 Jan 2025' }));
    const cost = correctRow().getByLabelText('Hourly cost (EUR)');
    await user.clear(cost);
    await user.type(cost, '82');

    act(() => {
      queryClient.setQueryData(
        rateRecordKeys.all,
        RATE_RECORDS.filter(({ id }) => id !== ADAEZE_FIRST_RATE.id),
      );
    });

    expect(
      await screen.findByText("This rate was removed elsewhere, so the correction can't be saved."),
    ).toBeInTheDocument();
    expect(correctRow().getByLabelText('Hourly cost (EUR)')).toHaveValue('82');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(repository.writes).toHaveLength(0);
  });

  it('keeps what was typed when the stored rate changes elsewhere, and compares with the new one at save time', async () => {
    const { user, repository, queryClient } = await openEmployee();
    await user.click(screen.getByRole('button', { name: 'Correct the rate from 12 Mar 2026' }));
    const cost = correctRow().getByLabelText('Hourly cost (EUR)');
    await user.clear(cost);
    await user.type(cost, '97');

    act(() => {
      queryClient.setQueryData(
        rateRecordKeys.all,
        RATE_RECORDS.map((rate) => (rate.id === ADAEZE_CURRENT_RATE.id ? { ...rate, hourlyCost: 97 } : rate)),
      );
    });
    expect(correctRow().getByLabelText('Hourly cost (EUR)')).toHaveValue('97');

    // The stored rate is now what the form says, so there is nothing to write.
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(repository.writes).toHaveLength(0);
    expect(listedRates()).toContain('12 Mar 2026 €97.00/hcurrent');
  });
});

describe('removing a rate', () => {
  it('asks first, and warns which allocated months it leaves partly priced', async () => {
    const { user, repository } = await openEmployee();
    await user.click(screen.getByRole('button', { name: 'Remove the rate from 1 Jan 2025' }));

    const dialog = within(await screen.findByRole('dialog', { name: 'Remove the rate from 1 Jan 2025?' }));
    expect(
      dialog.getByText(/€80\.00\/h from 1 Jan 2025 will be removed\. The next rate starts on 12 Mar 2026\./),
    ).toBeInTheDocument();
    expect(
      dialog.getByText(/Adaeze Okafor has allocations in months this leaves without a full rate:/),
    ).toBeInTheDocument();
    expect(
      dialog.getByText('Mar 2026 — partly priced: 8 of 22 working days are before 12 Mar 2026'),
    ).toBeInTheDocument();
    expect(dialog.getByText(/Delivery costs those days at 0\./)).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(repository.writes).toHaveLength(0);
    expect(listedRates()).toHaveLength(3);
  });

  it('never blocks the removal: confirming removes the rate and says so', async () => {
    const { user, repository } = await openEmployee();
    await user.click(screen.getByRole('button', { name: 'Remove the rate from 1 Jan 2025' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove rate' }));

    expect(await screen.findByText('Rate from 1 Jan 2025 removed.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(repository.writes[0]?.delete).toEqual([ADAEZE_FIRST_RATE.id]);
    expect(listedRates()).toEqual(['1 Jan 2099 €120.00/h', '12 Mar 2026 €95.00/hcurrent']);
  });

  it('says so, and cannot confirm, when the rate is removed elsewhere while the dialog is open', async () => {
    const { user, repository, queryClient } = await openEmployee();
    await user.click(screen.getByRole('button', { name: 'Remove the rate from 1 Jan 2025' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('button', { name: 'Remove rate' })).toBeEnabled();

    act(() => {
      queryClient.setQueryData(
        rateRecordKeys.all,
        RATE_RECORDS.filter(({ id }) => id !== ADAEZE_FIRST_RATE.id),
      );
    });

    expect(
      await dialog.findByText('This rate was removed elsewhere, so there is nothing left to remove.'),
    ).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Remove rate' })).toBeDisabled();
    expect(dialog.queryByText(/will be removed/)).not.toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(repository.writes).toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has no warning when the removal leaves every allocated month fully priced', async () => {
    const { user } = await openEmployee();
    await user.click(screen.getByRole('button', { name: 'Remove the rate from 1 Jan 2099' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/€120\.00\/h from 1 Jan 2099 will be removed\.$/)).toBeInTheDocument();
    expect(dialog.queryByText(/allocations in months/)).not.toBeInTheDocument();
  });

  it('says so when Delivery’s data isn’t available to list the months, and still lets the user remove', async () => {
    const repository = createFakeRepository();
    repository.failLoads(new ApiError('unavailable', 'delivery'));
    const { user } = await openEmployee({ repository });
    await user.click(screen.getByRole('button', { name: 'Remove the rate from 1 Jan 2025' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/can't be listed: Delivery's data isn't available/)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Remove rate' })).toBeEnabled();
  });
});

describe('going from one employee to another', () => {
  it('leaves none of the first employee’s forms, drafts or messages on the second’s page', async () => {
    const { user, router } = await openEmployee();
    // Employee A: a result in the status line, an add draft, and a correction open on a rate.
    await fillAdd(user, '2026-11-01', '98');
    await user.click(addForm().getByRole('button', { name: 'Add rate' }));
    expect(await screen.findByText('Rate from 1 Nov 2026 added.')).toBeInTheDocument();
    await user.type(addForm().getByLabelText('Valid from'), '2027-01-01');
    await user.click(screen.getByRole('button', { name: 'Correct the rate from 1 Jan 2025' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    // A history jump or a host link: straight to employee B, with no register in between.
    await act(() => router.navigate('/emp-002'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Lena Okafor' })).toBeInTheDocument();

    expect(listedRates()).toEqual(['1 Jan 2024 €85.00/hcurrent']);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByText(/removed elsewhere/)).not.toBeInTheDocument();
    expect(screen.queryByText('Rate from 1 Nov 2026 added.')).not.toBeInTheDocument();
    expect(addForm().getByLabelText('Valid from')).toHaveValue('');
  });
});

describe('a correction whose result lands after its form has gone', () => {
  async function saveCorrectionOf12March(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Correct the rate from 12 Mar 2026' }));
    const cost = correctRow().getByLabelText('Hourly cost (EUR)');
    await user.clear(cost);
    await user.type(cost, '97');
    await user.click(screen.getByRole('button', { name: 'Save' }));
  }

  it('still reports a conflict, in the widget, when the form was cancelled while the write was on its way', async () => {
    const repository = createFakeRepository();
    const { user } = await openEmployee({ repository });
    const release = repository.holdWrites();
    repository.failWrites(new ApiError('conflict', 'people'));
    await saveCorrectionOf12March(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    release();
    expect(
      await screen.findByText('This data was changed elsewhere and has been reloaded. Check it and try again.'),
    ).toBeInTheDocument();
    expect(listedRates()).toContain('12 Mar 2026 €95.00/hcurrent');
  });

  it('does not close the form of another rate when the result lands, and still reports it', async () => {
    const repository = createFakeRepository();
    const { user } = await openEmployee({ repository });
    const release = repository.holdWrites();
    await saveCorrectionOf12March(user);

    // While that write is on its way, the user opens another rate and starts a draft.
    await user.click(screen.getByRole('button', { name: 'Correct the rate from 1 Jan 2025' }));
    const cost = correctRow().getByLabelText('Hourly cost (EUR)');
    await user.clear(cost);
    await user.type(cost, '82');

    release();
    expect(await screen.findByText('Rate from 12 Mar 2026 corrected.')).toBeInTheDocument();
    expect(correctRow().getByLabelText('Hourly cost (EUR)')).toHaveValue('82');
    expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(1);
  });
});

describe('a write that fails', () => {
  it('undoes the change and says so at the top, keeping the draft for another try', async () => {
    const repository = createFakeRepository();
    repository.failWrites(new ApiError('unavailable', 'people'));
    const { user } = await openEmployee({ repository });
    await fillAdd(user, '2026-11-01', '98');
    await user.click(addForm().getByRole('button', { name: 'Add rate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Your change wasn't saved: the People service didn't respond. It has been undone. Try again when the connection is back.",
    );
    expect(listedRates()).toHaveLength(3);
    expect(addForm().getByLabelText('Valid from')).toHaveValue('2026-11-01');
    expect(addForm().getByLabelText(/Hourly cost/)).toHaveValue('98');

    repository.failWrites(null);
    await user.click(addForm().getByRole('button', { name: 'Add rate' }));
    expect(await screen.findByText('Rate from 1 Nov 2026 added.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('puts a removed rate back when the removal fails', async () => {
    const repository = createFakeRepository();
    repository.failWrites(new ApiError('server', 'people'));
    const { user } = await openEmployee({ repository });
    await user.click(screen.getByRole('button', { name: 'Remove the rate from 1 Jan 2025' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove rate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Your change wasn't saved: the People service reported an error. It has been undone.",
    );
    expect(await screen.findByRole('button', { name: 'Remove the rate from 1 Jan 2025' })).toBeInTheDocument();
    expect(listedRates()).toHaveLength(3);
  });

  it('shows the failure of a removal that is still on its way when a second removal starts, and the second one’s result too', async () => {
    const repository = createFakeRepository();
    const { user } = await openEmployee({ repository });
    const release = repository.holdWrites();
    repository.failNextWrite(new ApiError('unavailable', 'people'));

    for (const day of ['1 Jan 2025', '1 Jan 2099']) {
      await user.click(screen.getByRole('button', { name: `Remove the rate from ${day}` }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove rate' }));
    }
    expect(listedRates()).toEqual(['12 Mar 2026 €95.00/hcurrent']);

    release();
    // The first removal fails and is undone, and says so; the second goes through and says so. Neither is lost.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Your change wasn't saved: the People service didn't respond.",
    );
    expect(await screen.findByText('Rate from 1 Jan 2099 removed.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(listedRates()).toEqual(['12 Mar 2026 €95.00/hcurrent', '1 Jan 2025 €80.00/h']);
  });

  it('says the data changed, in the form, when the server reports a conflict', async () => {
    const repository = createFakeRepository();
    repository.failWrites(new ApiError('conflict', 'people'));
    const { user } = await openEmployee({ repository });
    await fillAdd(user, '2026-11-01', '98');
    await user.click(addForm().getByRole('button', { name: 'Add rate' }));

    expect(
      await within(screen.getByRole('form', { name: 'Add a rate' })).findByText(
        'This data was changed elsewhere and has been reloaded. Check it and try again.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(listedRates()).toHaveLength(3);
  });
});
