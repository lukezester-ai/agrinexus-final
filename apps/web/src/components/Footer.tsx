import Link from "next/link";

export function Footer() {
  return (
    <footer className="py-8 px-8 text-center text-[11px] text-ink/40 border-t border-ink/[0.06] mt-10">
      <p>
        AgriNexus · An open intelligence platform ·{" "}
        <Link href="/sponsors" className="hover:text-ink transition-colors">Sponsors</Link> ·{" "}
        <Link href="/sponsors#advertise" className="hover:text-ink transition-colors">Advertise</Link> ·{" "}
        <Link href="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
      </p>
      <p className="mt-2">2,847 farms · 14 countries · 1.2M hectares</p>
    </footer>
  );
}
