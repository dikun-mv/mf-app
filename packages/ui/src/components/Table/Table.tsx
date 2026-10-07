import { clsx } from 'clsx';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import styles from './Table.module.css';

/**
 * A styled `<table>` for lists (the register, rate history, the project list). Write the table as
 * usual (`<thead>`, `<tbody>`, `<tr>`) with `TableHeaderCell` and `TableCell` for the cells. It is not
 * the staffing grid, which has its own table. A wide table scrolls sideways inside its own box.
 * `className` goes to the `<table>`.
 */
export const Table = forwardRef<HTMLTableElement, ComponentPropsWithoutRef<'table'>>(function Table(
  { className, ...rest },
  ref,
) {
  return (
    <div className={styles.scroll}>
      <table {...rest} ref={ref} className={clsx(styles.table, className)} />
    </div>
  );
});

export interface TableCellProps extends ComponentPropsWithoutRef<'td'> {
  /** Right-aligns the cell, so figures line up on their decimal point. Use it on the column's header too. */
  numeric?: boolean;
}

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(function TableCell(
  { numeric = false, className, ...rest },
  ref,
) {
  return <td {...rest} ref={ref} className={clsx(styles.cell, numeric && styles.numeric, className)} />;
});

export interface TableHeaderCellProps extends ComponentPropsWithoutRef<'th'> {
  numeric?: boolean;
}

/** A header cell; `scope` is `col` unless the cell heads a row (`scope="row"`). */
export const TableHeaderCell = forwardRef<HTMLTableCellElement, TableHeaderCellProps>(function TableHeaderCell(
  { numeric = false, scope = 'col', className, ...rest },
  ref,
) {
  return <th {...rest} ref={ref} scope={scope} className={clsx(styles.header, numeric && styles.numeric, className)} />;
});
