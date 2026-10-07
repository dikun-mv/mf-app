import { clsx } from 'clsx';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  /** The page's heading (an `<h1>`). */
  title: ReactNode;
  /** One line under the title: role, dates, id. */
  subtitle?: ReactNode;
  /** A link back to the list, above the title. The app passes its router `Link`, because `ui` can't import a router. */
  back?: ReactNode;
  /** Status or actions at the far end of the title row, such as a capacity badge. */
  aside?: ReactNode;
}

/** The top of a page: an optional back link, the title with its subtitle, and an aside. */
export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(function PageHeader(
  { title, subtitle, back, aside, className, ...rest },
  ref,
) {
  return (
    <div {...rest} ref={ref} className={clsx(styles.header, className)}>
      {back ? <div className={styles.back}>{back}</div> : null}
      <div className={styles.row}>
        <div className={styles.titles}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </div>
    </div>
  );
});
