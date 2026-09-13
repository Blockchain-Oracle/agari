import { cn } from "@/lib/utils";
import { shortHex } from "@masayume/core/units";

interface HashProps {
  value: string;
  href?: string;
  lead?: number;
  tail?: number;
  className?: string;
}

export function Hash({ value, href, lead, tail, className }: HashProps) {
  const short = shortHex(value, lead, tail);
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={value}
        className={cn("numbers underline decoration-dotted underline-offset-4 hover:text-accent", className)}
      >
        {short}
      </a>
    );
  }
  return (
    <span title={value} className={cn("numbers", className)}>
      {short}
    </span>
  );
}
