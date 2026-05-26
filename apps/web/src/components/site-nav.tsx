"use client";

import type { ComponentProps } from "react";
import { usePathname } from "@/i18n/navigation";
import { Nav } from "@/components/Nav";

type NavActive = ComponentProps<typeof Nav>["active"];

function activeFromPath(path: string): NavActive {
	if (path === "/" || path.startsWith("/login") || path.startsWith("/privacy")) return undefined;
	if (path.startsWith("/platform")) return "platform";
	if (path.startsWith("/market")) return "market";
	if (path.startsWith("/agents")) return "agents";
	if (path.startsWith("/academy")) return "academy";
	if (path.startsWith("/sponsors")) return "sponsors";
	return undefined;
}

export function SiteNav() {
	const path = usePathname();
	return <Nav active={activeFromPath(path ?? "/")} />;
}
