import { describe, expect, it } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFocusedCell } from './useFocusedCell';

function Harness() {
  const { focus, onFocus } = useFocusedCell();
  return (
    <>
      <div onFocus={onFocus}>
        <button>outside of a cell</button>
        <table>
          <tbody>
            <tr>
              <td data-row-key="item/emp" data-month-index="2">
                <button>cell</button>
              </td>
              <td data-row-key="item/emp" data-month-index="3">
                <input aria-label="editor" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p data-testid="focus">{focus === null ? 'none' : `${focus.rowKey}:${String(focus.monthIndex)}`}</p>
    </>
  );
}

describe('useFocusedCell', () => {
  it('follows focus into a cell, whatever the cell holds, and keeps the last cell when focus leaves', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    expect(screen.getByTestId('focus')).toHaveTextContent('none');

    await user.click(screen.getByRole('button', { name: 'outside of a cell' }));
    expect(screen.getByTestId('focus')).toHaveTextContent('none');

    await user.click(screen.getByRole('button', { name: 'cell' }));
    expect(screen.getByTestId('focus')).toHaveTextContent('item/emp:2');

    await user.click(screen.getByRole('textbox', { name: 'editor' }));
    expect(screen.getByTestId('focus')).toHaveTextContent('item/emp:3');

    await user.click(screen.getByRole('button', { name: 'outside of a cell' }));
    expect(screen.getByTestId('focus')).toHaveTextContent('item/emp:3');
  });
});
