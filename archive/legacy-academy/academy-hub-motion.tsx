"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const tileContainer = {
	hidden: {},
	show: {
		transition: { staggerChildren: 0.09, delayChildren: 0.04 },
	},
};

const tileItem = {
	hidden: { opacity: 0, y: 12 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
	},
};

const listContainer = {
	hidden: {},
	show: {
		transition: { staggerChildren: 0.06, delayChildren: 0.08 },
	},
};

const listItem = {
	hidden: { opacity: 0, y: 10 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
	},
};

export type AcademyCourseRow = {
	slug: string;
	title: string;
	description: string;
	modulesLine: string;
};

const glassCourseCard = cn(
	"flex h-full flex-col duration-300",
	"transition-[border-color,box-shadow,background-color]",
	"group-hover:border-forest-300/50 group-hover:shadow-[0_16px_52px_rgba(14,55,32,0.14)] group-hover:ring-forest-200/40",
);

const glassCourseHeader = "flex-1 border-b border-white/40 bg-white/[0.07] pb-3 backdrop-blur-sm";
const glassCourseFooter =
	"mt-auto justify-between gap-3 border-t border-white/40 bg-black/[0.03] py-3 text-sm backdrop-blur-sm";

function AcademyCourseGlassCard({
	c,
	openCourse,
}: {
	c: AcademyCourseRow;
	openCourse: string;
}) {
	return (
		<Link
			href={`/academy/course/${c.slug}`}
			className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
		>
			<Card variant="glass" className={glassCourseCard}>
				<CardHeader className={glassCourseHeader}>
					<CardTitle className="text-lg leading-snug text-slate-900">{c.title}</CardTitle>
					<CardDescription className="line-clamp-3 text-sm leading-relaxed text-slate-700">{c.description}</CardDescription>
				</CardHeader>
				<CardFooter className={glassCourseFooter}>
					<span className="text-slate-600">{c.modulesLine}</span>
					<span className="font-medium text-forest-800">{openCourse}</span>
				</CardFooter>
			</Card>
		</Link>
	);
}

type AcademyFeatureTilesProps = {
	className?: string;
	lab: ReactNode;
	lecturer: ReactNode;
	maps?: ReactNode;
	community?: ReactNode;
};

export function AcademyFeatureTiles({ className, lab, lecturer, maps, community }: AcademyFeatureTilesProps) {
	const reduce = useReducedMotion();
	if (reduce) {
		return (
			<section className={className}>
				{lab}
				{lecturer}
				{maps}
				{community}
			</section>
		);
	}
	return (
		<motion.section
			className={className}
			variants={tileContainer}
			initial="hidden"
			whileInView="show"
			viewport={{ once: true, margin: "-40px" }}
		>
			<motion.div variants={tileItem} className="min-w-0">
				{lab}
			</motion.div>
			<motion.div variants={tileItem} className="min-w-0">
				{lecturer}
			</motion.div>
			{maps ? (
				<motion.div variants={tileItem} className="min-w-0">
					{maps}
				</motion.div>
			) : null}
			{community ? (
				<motion.div variants={tileItem} className="min-w-0">
					{community}
				</motion.div>
			) : null}
		</motion.section>
	);
}

type AcademyCourseStaggerProps = {
	className?: string;
	courses: AcademyCourseRow[];
	openCourse: string;
};

export function AcademyCourseStagger({ className, courses, openCourse }: AcademyCourseStaggerProps) {
	const reduce = useReducedMotion();
	if (reduce) {
		return (
			<div className={className}>
				{courses.map((c) => (
					<AcademyCourseGlassCard key={c.slug} c={c} openCourse={openCourse} />
				))}
			</div>
		);
	}
	return (
		<motion.div
			className={className}
			variants={listContainer}
			initial="hidden"
			whileInView="show"
			viewport={{ once: true, margin: "-24px" }}
		>
			{courses.map((c) => (
				<motion.div key={c.slug} variants={listItem} className="min-w-0">
					<AcademyCourseGlassCard c={c} openCourse={openCourse} />
				</motion.div>
			))}
		</motion.div>
	);
}
