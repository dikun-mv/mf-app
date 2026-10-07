import { describe, expect, it } from '@rstest/core';
import { describeDeleted, describeDeletion } from './describeDeletion';

describe('describeDeletion', () => {
  it('counts the items and their allocations, naming the items', () => {
    expect(describeDeletion({ names: ['Discovery', 'Design', 'Rework'], allocations: 24 })).toBe(
      'This deletes 3 items (Discovery, Design, Rework) and their 24 allocations.',
    );
  });

  it('speaks of one item as it and its', () => {
    expect(describeDeletion({ names: ['Design'], allocations: 18 })).toBe(
      'This deletes "Design" and its 18 allocations.',
    );
    expect(describeDeletion({ names: ['Design'], allocations: 1 })).toBe('This deletes "Design" and its 1 allocation.');
  });

  it('says so when there are no allocations to lose', () => {
    expect(describeDeletion({ names: ['Cut-over'], allocations: 0 })).toBe(
      'This deletes "Cut-over". It holds no allocations.',
    );
    expect(describeDeletion({ names: ['A', 'B'], allocations: 0 })).toBe(
      'This deletes 2 items (A, B). They hold no allocations.',
    );
  });

  it('gives the first names and a count for a big subtree', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    expect(describeDeletion({ names, allocations: 5 })).toBe(
      'This deletes 8 items (A, B, C, D, E, F and 2 more) and their 5 allocations.',
    );
  });
});

describe('describeDeleted', () => {
  it('reports both counts for the status line', () => {
    expect(describeDeleted(2, 14)).toBe('Deleted 2 items and 14 allocations.');
    expect(describeDeleted(1, 1)).toBe('Deleted 1 item and 1 allocation.');
    expect(describeDeleted(1, 0)).toBe('Deleted 1 item and 0 allocations.');
  });
});
