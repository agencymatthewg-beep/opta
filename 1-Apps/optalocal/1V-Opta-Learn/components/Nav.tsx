import Link from 'next/link';

export function Nav() {
  return (
    <nav className="fixed top-0 right-0 p-6 z-50">
      <Link
        href="https://optalocal.com"
        className="text-xs font-mono text-text-muted hover:text-white transition-colors"
      >
        optalocal.com ↗
      </Link>
    </nav>
  );
}
