import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tight?: boolean;
  hoverable?: boolean;
}

export function Card({ children, tight, hoverable, className = '', ...rest }: CardProps) {
  const classes = [
    'card',
    tight ? 'card-tight' : '',
    hoverable ? 'is-hoverable' : '',
    className,
  ].filter(Boolean).join(' ');
  return <div {...rest} className={classes}>{children}</div>;
}

interface HeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export function CardHeader({ title, eyebrow, subtitle, action }: HeaderProps) {
  return (
    <div className="card-header" style={{ marginBottom: subtitle ? 'var(--sp-2)' : undefined }}>
      <div>
        {eyebrow && <div className="card-eyebrow">{eyebrow}</div>}
        <h3 className="card-title">{title}</h3>
        {subtitle && <div className="card-subtitle" style={{ marginTop: 4 }}>{subtitle}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface StatProps {
  label: ReactNode;
  value: ReactNode;
  footnote?: ReactNode;
  trend?: { dir: 'up' | 'down'; label: string };
}

export function StatCard({ label, value, footnote, trend }: StatProps) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {trend && (
        <div className={`stat-trend ${trend.dir === 'up' ? 'is-up' : 'is-down'}`}>
          {trend.dir === 'up' ? '↑' : '↓'} {trend.label}
        </div>
      )}
      {footnote && <div className="stat-footnote">{footnote}</div>}
    </div>
  );
}
