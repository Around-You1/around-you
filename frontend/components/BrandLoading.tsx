// Branded loading splash — the Around You logo while a page/dashboard loads,
// instead of a plain "Loading…" line.
export default function BrandLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand/10 to-background flex flex-col items-center justify-center gap-4 px-6">
      <img src="/around-you-logo.png" alt="Around You" className="w-56 max-w-[75%] animate-pulse" />
      <p className="text-lg text-muted-foreground">Loading…</p>
    </div>
  );
}
