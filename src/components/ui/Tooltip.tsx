import type { ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div
        className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
                   px-3 py-2 glass-heavy rounded-lg text-xs font-body text-text-primary
                   opacity-0 pointer-events-none group-hover/tooltip:opacity-100
                   transition-opacity duration-150 whitespace-nowrap min-w-max"
      >
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1
                       border-4 border-transparent border-t-surface-overlay" />
      </div>
    </div>
  );
}
