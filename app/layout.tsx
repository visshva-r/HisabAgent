import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'HisabAgent — books that explain themselves', description:"The MSME back-office agent for messy real-world money." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
