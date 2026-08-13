'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

const links = [
  ['/workspace', 'Workspace'],
  ['/evals', 'Evals Lab'],
  ['/process', 'Process'],
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
      <Link href="/" className="flex items-center gap-3 font-bold tracking-tight">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-mint text-xl text-ink">₹</span>
        <span>
          Hisab<span className="text-mint">Agent</span>
        </span>
      </Link>
      <div className="hidden gap-5 text-sm md:flex">
        {links.map(([href, label]) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={active ? 'font-medium text-mint' : 'text-slate-300 transition hover:text-mint'}
              aria-current={active ? 'page' : undefined}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <details className="md:hidden">
        <summary aria-label="Open navigation" className="list-none rounded-lg border border-white/15 p-2 text-mint">
          <Menu size={19} />
        </summary>
        <div className="absolute right-5 z-20 mt-2 grid w-44 gap-3 rounded-xl border border-white/15 bg-panel p-3 text-sm shadow-xl">
          {links.map(([href, label]) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} className={active ? 'font-medium text-mint' : ''}>
                {label}
              </Link>
            );
          })}
        </div>
      </details>
    </nav>
  );
}
