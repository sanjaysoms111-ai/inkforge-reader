import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 py-10 text-sm text-zinc-500">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-y-4 md:flex-row">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} inkforg_apexpanel Reader</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">Built for creators & readers</span>
          </div>

          <div className="flex gap-6">
            <Link href="/legal" className="hover:text-zinc-400">Legal &amp; Disclaimers</Link>
            <span className="text-zinc-700">•</span>
            <a href="#disclaimer" className="hover:text-zinc-400">AI Note</a>
            <span className="text-zinc-700">•</span>
            <span>Demo • No real payments</span>
          </div>
        </div>

        <div id="disclaimer" className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-xs leading-relaxed text-zinc-400">
          <strong className="text-zinc-300">Important:</strong> Some comics on inkforg_apexpanel are AI-generated. 
          Always check the creator&apos;s note on each title. inkforg_apexpanel provides tools for human creators and AI-assisted storytelling. 
          Reader discretion is advised. This is a demonstration platform — all monetization features are placeholders.
        </div>
      </div>
    </footer>
  );
}
