import { describe, expect, it } from '@rstest/core';
import { searchEmployees } from './search';

const people = [
  { id: 'emp-001', name: 'Adaeze Okafor', role: 'Tech Lead' },
  { id: 'emp-002', name: 'Lena Okafor', role: 'Frontend Engineer' },
  { id: 'emp-003', name: 'Milan Brandt', role: 'Backend Engineer' },
  { id: 'emp-004', name: 'Samira Haddad', role: 'Frontend Engineer' },
];
const ids = (found: readonly { id: string }[]) => found.map((employee) => employee.id);

describe('searchEmployees', () => {
  it('matches the name, ignoring case', () => {
    expect(ids(searchEmployees(people, 'okafor'))).toEqual(['emp-001', 'emp-002']);
    expect(ids(searchEmployees(people, 'MILAN'))).toEqual(['emp-003']);
  });

  it('matches the role, ignoring case', () => {
    expect(ids(searchEmployees(people, 'frontend'))).toEqual(['emp-002', 'emp-004']);
    expect(ids(searchEmployees(people, 'Tech LEAD'))).toEqual(['emp-001']);
  });

  it('matches part of a word in either field, once per employee', () => {
    expect(ids(searchEmployees(people, 'en'))).toEqual(['emp-002', 'emp-003', 'emp-004']);
  });

  it('ignores spaces around the term', () => {
    expect(ids(searchEmployees(people, '  brandt '))).toEqual(['emp-003']);
  });

  it('matches everyone for an empty or blank term, and keeps the order', () => {
    expect(ids(searchEmployees(people, ''))).toEqual(['emp-001', 'emp-002', 'emp-003', 'emp-004']);
    expect(ids(searchEmployees(people, '   '))).toEqual(['emp-001', 'emp-002', 'emp-003', 'emp-004']);
  });

  it('returns a new array and finds nothing when nothing matches', () => {
    const all = searchEmployees(people, '');
    expect(all).not.toBe(people);
    expect(searchEmployees(people, 'xyz')).toEqual([]);
  });

  it('does not match the id', () => {
    expect(searchEmployees(people, 'emp-001')).toEqual([]);
  });
});
