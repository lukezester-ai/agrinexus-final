import { ReactNode } from "react";

type SectionHeaderProps = {
  num?: string;
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
};

export function SectionHeader({ num, eyebrow, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="py-10 px-8 pt-10 pb-5 max-w-3xl mx-auto">
      <div className="font-mono text-[11px] text-ink/45 tracking-[0.08em] uppercase mb-2.5 flex items-center gap-2.5">
        {num && (
          <span className="font-serif italic text-ink/30 text-[13px]">{num}</span>
        )}
        {eyebrow}
      </div>
      <h2 className="font-serif text-3xl font-normal tracking-[-0.02em] mb-2.5 leading-[1.2]">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-ink/60 max-w-md leading-[1.55]">{subtitle}</p>
      )}
    </div>
  );
}
