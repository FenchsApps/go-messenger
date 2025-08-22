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
      {/* Pigeon Body */}
      <path d="M10.2,3.2A2.47,2.47,0,0,1,12.6,3a2.38,2.38,0,0,1,2.3,1.9" />
      <path d="M9.2,12.7A2.35,2.35,0,0,0,4,13.6a2,2,0,0,0-1.2.5,2.2,2.2,0,0,0-.8,1.6,2.35,2.35,0,0,0,1.1,2.2,2.5,2.5,0,0,0,2.1.2l6.2-2.1" />
      <path d="M13,22a2,2,0,0,0,2-2" />
      <path d="M10,18a2,2,0,0,1-2,2" />
      <path d="M14.7,5.5a2.12,2.12,0,0,1-1.9-1.3" />
      
      {/* Postcard with "Go" */}
      <g transform="rotate(25 16 9)">
        <rect x="13" y="7" width="10" height="7" rx="1" fill="hsl(var(--card))" stroke="currentColor" />
        <text
          x="18"
          y="12.5"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="5"
          fontWeight="bold"
          fill="currentColor"
          stroke="none"
        >
          Go
        </text>
      </g>
      
      {/* Pigeon Head and Wing */}
      <path d="M20,9.3l-2,2.5a2.27,2.27,0,0,1-3.6-1L13,9.2a4.47,4.47,0,0,0-6.6-1.9" />
    </svg>
  );
}
