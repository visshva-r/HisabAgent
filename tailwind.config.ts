import type { Config } from 'tailwindcss';
export default { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { ink:'#071721', panel:'#0d2633', line:'#244653', mint:'#9dffd0', amber:'#ffc857', sky:'#76d7ff', danger:'#ff796c' }, boxShadow: { glow:'0 0 50px rgba(118,215,255,.12)' } } }, plugins: [] } satisfies Config;
