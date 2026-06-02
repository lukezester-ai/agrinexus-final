"use client";

import { useState } from "react";
import { HandThumbUpIcon, HandThumbDownIcon } from "@heroicons/react/24/outline";
import { HandThumbUpIcon as HandThumbUpSolid, HandThumbDownIcon as HandThumbDownSolid } from "@heroicons/react/24/solid";

interface ChatFeedbackProps {
	traceId: string;
}

export function ChatFeedback({ traceId }: ChatFeedbackProps) {
	const [status, setStatus] = useState<"idle" | "loading" | "submitted">("idle");
	const [selection, setSelection] = useState<number | null>(null);

	const handleFeedback = async (value: number) => {
		if (status !== "idle" && status !== "submitted") return;
		
		setSelection(value);
		setStatus("loading");

		try {
			const res = await fetch("/api/feedback", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ traceId, value }),
			});

			if (res.ok) {
				setStatus("submitted");
			} else {
				setStatus("idle");
				setSelection(null);
			}
		} catch (error) {
			console.error("Failed to submit feedback", error);
			setStatus("idle");
			setSelection(null);
		}
	};

	return (
		<div className="flex items-center gap-2 mt-2">
			<button
				onClick={() => handleFeedback(1)}
				disabled={status === "loading" || status === "submitted"}
				className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
				title="Полезен отговор"
			>
				{selection === 1 ? (
					<HandThumbUpSolid className="w-4 h-4 text-green-600" />
				) : (
					<HandThumbUpIcon className="w-4 h-4 text-gray-500 hover:text-green-600" />
				)}
			</button>
			<button
				onClick={() => handleFeedback(0)}
				disabled={status === "loading" || status === "submitted"}
				className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
				title="Неточен отговор"
			>
				{selection === 0 ? (
					<HandThumbDownSolid className="w-4 h-4 text-red-600" />
				) : (
					<HandThumbDownIcon className="w-4 h-4 text-gray-500 hover:text-red-600" />
				)}
			</button>
			{status === "submitted" && (
				<span className="text-xs text-gray-400 ml-1">Благодарим за обратната връзка!</span>
			)}
		</div>
	);
}
