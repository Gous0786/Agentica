"use client";

export function ThemeToggle() {
  const toggle = () => {
    const dark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // Storage unavailable (private mode); the toggle still works for this page.
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-md border border-agentica-muted px-3 py-1.5 text-sm hover:bg-agentica-muted"
    >
      Toggle theme
    </button>
  );
}
