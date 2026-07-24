"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  name?: string;
  value?: string;
  className: string;
  pendingLabel: string;
  children: ReactNode;
};

export function SubmitButton({ name, value, className, pendingLabel, children }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" name={name} value={value} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
