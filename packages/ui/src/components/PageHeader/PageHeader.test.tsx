import { createRef } from 'react';
import { getByRole, getByText, queryByRole, render } from '../../testing/dom';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('has the title as the page heading, with the subtitle under it', () => {
    render(<PageHeader title="Adaeze Okafor" subtitle="Tech Lead · 40 h/week · emp-001" />);
    expect(getByRole('heading', { name: 'Adaeze Okafor' }).tagName).toBe('H1');
    expect(getByText('Tech Lead · 40 h/week · emp-001')).toBeTruthy();
  });

  it('puts the back slot before the title, so the link comes first in reading order', () => {
    render(<PageHeader title="Milan Brandt" back={<a href="/people">All employees</a>} />);
    const back = getByRole('link', { name: 'All employees' });
    const title = getByRole('heading', { name: 'Milan Brandt' });
    expect(back.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the aside slot after the title', () => {
    render(<PageHeader title="Milan Brandt" aside={<button>Add rate</button>} />);
    const title = getByRole('heading', { name: 'Milan Brandt' });
    const aside = getByRole('button', { name: 'Add rate' });
    expect(title.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leaves out the slots it is not given', () => {
    render(<PageHeader title="Employees" />);
    expect(queryByRole('link')).toBeNull();
    expect(queryByRole('button')).toBeNull();
  });

  it('forwards its ref and passes attributes on', () => {
    const ref = createRef<HTMLDivElement>();
    render(<PageHeader ref={ref} title="Projects" data-testid="header" />);
    expect(ref.current?.getAttribute('data-testid')).toBe('header');
  });
});
