import { createRef } from 'react';
import { getByRole, queryAllByRole, render } from '../../testing/dom';
import { Table, TableCell, TableHeaderCell } from './Table';

function register() {
  return (
    <Table aria-label="Employees">
      <thead>
        <tr>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell numeric>Weekly hours</TableHeaderCell>
        </tr>
      </thead>
      <tbody>
        <tr>
          <TableHeaderCell scope="row">Adaeze Okafor</TableHeaderCell>
          <TableCell numeric>40 h</TableCell>
        </tr>
        <tr>
          <TableHeaderCell scope="row">Lena Okafor</TableHeaderCell>
          <TableCell numeric>40 h</TableCell>
        </tr>
      </tbody>
    </Table>
  );
}

describe('Table', () => {
  it('is a native table with column headers, row headers and cells', () => {
    render(register());
    expect(getByRole('table', { name: 'Employees' })).toBeTruthy();
    expect(queryAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Name', 'Weekly hours']);
    expect(queryAllByRole('rowheader').map((cell) => cell.textContent)).toEqual(['Adaeze Okafor', 'Lena Okafor']);
    expect(queryAllByRole('cell')).toHaveLength(2);
    expect(queryAllByRole('row')).toHaveLength(3);
  });

  it('scopes a header cell to its column unless told otherwise', () => {
    render(register());
    expect(getByRole('columnheader', { name: 'Name' }).getAttribute('scope')).toBe('col');
    expect(getByRole('rowheader', { name: 'Lena Okafor' }).getAttribute('scope')).toBe('row');
  });

  it('forwards its ref to the table element and passes cell attributes on', () => {
    const ref = createRef<HTMLTableElement>();
    render(
      <Table ref={ref}>
        <tbody>
          <tr>
            <TableCell colSpan={3}>Total</TableCell>
          </tr>
        </tbody>
      </Table>,
    );
    expect(ref.current?.tagName).toBe('TABLE');
    expect(getByRole('cell', { name: 'Total' }).getAttribute('colspan')).toBe('3');
  });
});
