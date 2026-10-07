import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-agentica-muted border-b bg-agentica-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          agentica
        </Link>
        <nav className="flex gap-4 text-sm opacity-70">
          <Link href="/" className="hover:opacity-100">
            Foundation
          </Link>
          <Link href="/lab" className="hover:opacity-100">
            Runtime lab
          </Link>
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
