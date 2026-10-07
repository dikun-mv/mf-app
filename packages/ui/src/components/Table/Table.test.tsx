import { describe, expect, it } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
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
    expect(screen.getByRole('table', { name: 'Employees' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Name', 'Weekly hours']);
    expect(screen.getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual(['Adaeze Okafor', 'Lena Okafor']);
    expect(screen.getAllByRole('cell')).toHaveLength(2);
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('scopes a header cell to its column unless told otherwise', () => {
    render(register());
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('scope', 'col');
    expect(screen.getByRole('rowheader', { name: 'Lena Okafor' })).toHaveAttribute('scope', 'row');
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
    expect(screen.getByRole('cell', { name: 'Total' })).toHaveAttribute('colspan', '3');
  });
});
