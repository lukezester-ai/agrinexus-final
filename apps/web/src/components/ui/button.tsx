import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-forest-700 text-white shadow-sm hover:bg-forest-900",
				secondary: "border border-slate-200/80 bg-white text-slate-900 shadow-sm hover:bg-slate-50",
				outline: "border border-slate-300 bg-transparent hover:bg-slate-50",
				ghost: "hover:bg-slate-100/80 hover:text-slate-900",
				link: "text-forest-700 underline-offset-4 hover:underline",
			},
			size: {
				default: "h-10 whitespace-nowrap px-4 py-2",
				sm: "h-9 whitespace-nowrap rounded-md px-3",
				lg: "h-11 whitespace-nowrap rounded-md px-8",
				xl: "h-auto min-h-[4.5rem] w-full max-w-full min-w-0 items-start justify-between whitespace-normal break-words rounded-xl px-5 py-4 text-left",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export type ButtonProps = React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };
