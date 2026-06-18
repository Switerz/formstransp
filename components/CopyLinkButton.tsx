"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const label = copied ? "Copiado" : "Copiar link";
  const href = useMemo(() => {
    if (typeof window === "undefined") return path;
    return new URL(path, window.location.origin).toString();
  }, [path]);

  async function copy() {
    await navigator.clipboard.writeText(href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className="btn secondary" type="button" onClick={copy} title="Copiar link">
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {label}
    </button>
  );
}
