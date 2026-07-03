import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API blocked (e.g. insecure context) - silently ignore, user can select manually
    }
  };

  return (
    <button type="button" onClick={copy} className="btn-ghost !px-2 !py-1.5" title="Copy">
      {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
