import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string; icon?: ReactNode };
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? (
        <Link className="btn secondary" href={action.href}>
          {action.icon}
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
