import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-xl text-slate-950", {
	variants: {
		variant: {
			solid: "border border-slate-200/90 bg-white shadow-sm",
			glass:
				"border border-white/50 bg-gradient-to-br from-white/70 via-white/45 to-white/30 shadow-[0_8px_40px_rgba(14,55,32,0.1)] backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/45",
		},
	},
	defaultVariants: {
		variant: "solid",
	},
});

export type CardProps = React.ComponentProps<"div"> & VariantProps<typeof cardVariants>;

function Card({ className, variant, ...props }: CardProps) {
	return <div className={cn(cardVariants({ variant }), className)} data-slot="card" {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("flex flex-col gap-1.5 border-b border-slate-100 px-5 py-4", className)} data-slot="card-header" {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("font-semibold leading-none tracking-tight text-slate-900", className)} data-slot="card-title" {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("text-sm text-slate-600", className)} data-slot="card-description" {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("px-5 py-4", className)} data-slot="card-content" {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("flex items-center border-t border-slate-100 px-5 py-3", className)} data-slot="card-footer" {...props} />;
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
