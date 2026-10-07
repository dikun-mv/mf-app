import type { Project } from '@baseline/delivery-contract';
import { monthOf, monthsBetween } from '@baseline/delivery-domain';
import type { Month } from '@baseline/host-contract';

/** The months a project spans, first to last, both included: the grid's columns (plan §1). */
export const projectMonths = ({ startDate, endDate }: Pick<Project, 'startDate' | 'endDate'>): Month[] =>
  monthsBetween(monthOf(startDate), monthOf(endDate));
