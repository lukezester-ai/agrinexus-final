import { ReactNode } from "react";

type HeroProps = {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  children?: ReactNode;
};

export function Hero({ eyebrow, title, subtitle, children }: HeroProps) {
  return (
    <section className="px-8 pt-20 pb-7 text-center max-w-3xl mx-auto">
      {eyebrow && (
        <div className="font-mono text-[11px] text-ink/50 tracking-[0.08em] uppercase mb-4">
          {eyebrow}
        </div>
      )}
      <h1 className="text-[44px] md:text-[60px] font-medium leading-[1.02] tracking-[-0.04em] mb-5 bg-gradient-to-b from-ink to-ink/80 bg-clip-text text-transparent">
        {title}
      </h1>
      {subtitle && (
        <p className="text-[17px] text-ink/60 leading-[1.5] max-w-xl mx-auto mb-8">
          {subtitle}
        </p>
      )}
      {children}
    </section>
  );
}
