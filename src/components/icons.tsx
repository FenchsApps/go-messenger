import type { SVGProps } from 'react';

export function PigeonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Pigeon Body & Head */}
      <path d="M22 8.6c0-1.4-1.2-2.6-2.6-2.6H14" />
      <path d="M15.4 12.4c-1.8-1.8-3.6-1.8-5.4 0" />
      <path d="M11 18.6c-1.7 0-3.3-.8-4.3-2.2" />
      <path d="M15.2 21.6c-2.4 0-4.8-1.6-4.8-4.2 0-2.8 2.2-4.8 4.6-5" />
      <path d="M5.4 15c-1.2 0-2.3.7-2.7 1.8" />
      <path d="M11.6 6.2c0-2.4-1.4-4.2-3.6-4.2s-3.6 1.8-3.6 4.2c0 2.4 1.6 4.2 3.6 4.2" />

      {/* Postcard with "Go" */}
      <g>
        <rect x="13" y="3" width="7" height="5" rx="1" fill="hsl(var(--card))" stroke="currentColor" strokeWidth="1"/>
        <text
          x="16.5"
          y="6"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="3"
          fontWeight="bold"
          fill="currentColor"
          stroke="none"
        >
          Go
        </text>
      </g>
    </svg>
  );
}
