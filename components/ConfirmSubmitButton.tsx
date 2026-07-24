"use client";

import { useState, type ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  className: string;
  confirmLabel: string;
  children: ReactNode;
};

export function ConfirmSubmitButton({ className, confirmLabel, children }: ConfirmSubmitButtonProps) {
  const [armed, setArmed] = useState(false);

  return (
    <button
      className={armed ? "btn warning compact" : className}
      type={armed ? "submit" : "button"}
      onClick={(event) => {
        if (!armed) {
          event.preventDefault();
          setArmed(true);
        }
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
