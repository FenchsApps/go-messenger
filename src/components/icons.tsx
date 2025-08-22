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
      <path d="M10.2,3.2A2.47,2.47,0,0,1,12.6,3a2.38,2.38,0,0,1,2.3,1.9" />
      <path d="M14.7,5.5a2.12,2.12,0,0,1-1.9-1.3" />
      <path d="M22,9.3l-2,2.5a2.27,2.27,0,0,1-3.6-1L15,9.2a4.47,4.47,0,0,0-7.6-1.9" />
      <path d="M13.4,13.2a2.5,2.5,0,0,1,3.4-3.4" />
      <path d="M9.2,12.7A2.35,2.35,0,0,0,4,13.6a2,2,0,0,0-1.2.5,2.2,2.2,0,0,0-.8,1.6,2.35,2.35,0,0,0,1.1,2.2,2.5,2.5,0,0,0,2.1.2l6.2-2.1" />
      <path d="M13,22a2,2,0,0,0,2-2" />
      <path d="M10,18a2,2,0,0,1-2,2" />
    </svg>
  );
}
