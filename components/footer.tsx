export function Footer() {
  return (
    <footer className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-6 text-xs text-slate-500">
      <p>
        HisabAgent · offline demo ·{' '}
        <a className="text-slate-400 hover:text-mint" href="/evals">
          Evals Lab
        </a>
      </p>
      <a className="text-slate-400 hover:text-mint" href="https://github.com/visshva-r/HisabAgent" target="_blank" rel="noreferrer">
        GitHub
      </a>
    </footer>
  );
}
