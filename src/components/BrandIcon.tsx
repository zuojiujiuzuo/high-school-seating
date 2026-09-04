import type { SVGProps } from "react";

export function BrandIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect className="brand-icon-surface" x="5" y="5" width="54" height="54" rx="13" strokeWidth="2.5" />
      <path
        className="brand-icon-grid"
        d="M18 17.5H28.5V27H18zM35.5 17.5H46V27H35.5zM18 36H28.5V45.5H18zM35.5 36H46V45.5H35.5z"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect className="brand-icon-focus" x="33.5" y="15.5" width="14.5" height="13.5" rx="3" />
      <path className="brand-icon-note" d="M37 20H44.5M37 24H42" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
