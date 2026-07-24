"use client";

import { useFormStatus } from "react-dom";
import { LogIn } from "lucide-react";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="btn" type="submit" disabled={pending}>
      <LogIn size={18} /> {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}
