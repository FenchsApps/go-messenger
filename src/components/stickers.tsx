import type { SVGProps } from 'react';

export function HeartSticker(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12 20.84C10.29 19.54 2 14.18 2 8.5C2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5c0 5.68-8.29 11.04-10 12.34z" fill="#FF4B4B" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function ThumbsUpSticker(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M7 11v9a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h3a2 2 0 0 0 2-2l1-4a2 2 0 0 0-2-2H9a1 1 0 0 1-1-1V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6" fill="#FFD24B" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 11H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function ShopSticker(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M4 8h16l-1.5 9H5.5L4 8z" fill="#A0E8FF" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 8V6a4 4 0 0 1 8 0v2" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function HomeSticker(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M3 9l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" fill="#90EE90" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 22V12h6v10" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    )
}

export function SchoolSticker(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M2 22l10-7 10 7M4 10v12h16V10L12 4 4 10z" fill="#D2B48C" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
             <path d="M12 14v8" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    )
}

export function WorkSticker(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" fill="#B0C4DE" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 7V5a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v2" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    )
}

export function YummySticker(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <circle cx="12" cy="12" r="10" fill="#FFD24B" stroke="#000000" strokeWidth="2"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="#000000" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="9" cy="10" r="1" fill="#000000"/>
            <circle cx="15" cy="10" r="1" fill="#000000"/>
        </svg>
    )
}

export function SleepSticker(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M10 19s2 1 4 0" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round"/>
            <path d="M6 15s2 1 4 0" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round"/>
            <path d="M2 11s2 1 4 0" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round"/>
        </svg>
    )
}
