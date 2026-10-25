import type { CSSProperties } from 'react';

export type PortalIconName = 'board' | 'package' | 'calendar' | 'card' | 'users' | 'check' | 'scan' | 'catalog' | 'chart' | 'profile' | 'home' | 'logout' | 'search' | 'menu' | 'arrow' | 'building';

const paths: Record<PortalIconName, string> = {
  board: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  package: 'm12 3 9 5-9 5-9-5 9-5Z M3 8v9l9 5 9-5V8 M12 13v9 M7.5 5.5l9 5',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M16 3v4 M8 3v4 M3 11h18 M8 15h2 M14 15h2',
  card: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M2 10h20 M6 15h4 M16 15h2',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  check: 'M9 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-4 M9 2h6v4H9z M8 14l3 3 5-6',
  scan: 'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M3 12h18 M8 8h1 M15 8h1 M8 16h1 M15 16h1',
  catalog: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 17h7 M17.5 14v7',
  chart: 'M3 3v18h18 M8.5 16v-5 M13.5 16V7 M18.5 16v-9',
  profile: 'M19 21v-2a7 7 0 0 0-14 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  home: 'm3 10 9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  search: 'M21 21l-4.35-4.35 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  building: 'M4 21V5l8-3 8 3v16 M2 21h20 M9 21v-5h6v5 M8 7h1 M15 7h1 M8 11h1 M15 11h1',
};

export function PortalIcon({ name, size = 20, style }: { name: PortalIconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ display: 'block', flexShrink: 0, ...style }}>
    <path d={paths[name]} />
  </svg>;
}
