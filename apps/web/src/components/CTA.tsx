import { Link } from "@/i18n/navigation";
import { ReactNode } from "react";

type CTAProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
};

export function CTA({ href, children, variant = "primary" }: CTAProps) {
  const base =
    "inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13px] font-medium no-underline transition-all";
  const styles =
    variant === "primary"
      ? "bg-ink text-white shadow-[0_6px_18px_rgba(10,10,10,0.2)] hover:bg-ink/90"
      : "bg-white/75 backdrop-blur-xl text-ink border border-ink/10 hover:bg-white/90";

  // External links open in a new tab
  if (href.startsWith("http") || href.startsWith("mailto:")) {
    return (
      <a href={href} className={`${base} ${styles}`}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
    </Link>
  );
}

export function CTARow({ children }: { children: ReactNode }) {
  return <div className="inline-flex gap-2.5 items-center flex-wrap justify-center">{children}</div>;
}
