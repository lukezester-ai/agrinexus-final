"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type FadeInProps = {
	children: ReactNode;
	className?: string;
	delay?: number;
	duration?: number;
};

export function FadeIn({ children, className, delay = 0, duration = 0.42 }: FadeInProps) {
	const reduce = useReducedMotion();
	if (reduce) {
		return <div className={className}>{children}</div>;
	}
	return (
		<motion.div
			className={cn(className)}
			initial={{ opacity: 0, y: 14 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] as const }}
		>
			{children}
		</motion.div>
	);
}
