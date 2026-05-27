import type { Config } from "tailwindcss";

const config: Config = {
	content: ["./src/pages/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}", "./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
	theme: {
		extend: {
			colors: {
				forest: {
					900: "#0E2818",
					700: "#1F4D2C",
					500: "#5A9968",
					200: "#B0DCBC",
					50: "#F0F5F0",
				},
				harvest: {
					700: "#8A6A2F",
					500: "#C4A86A",
					200: "#E6C98A",
					50: "#FAEDD1",
				},
				earth: { 600: "#B87A3D" },
				cream: "#FAF7F0",
				paper: "#F8F6F1",
				stone: { 200: "#D3D1C7", 600: "#5F5E5A" },
				ink: "#0A0A0A",
				semantic: {
					success: "#2D7A3F",
					warning: "#B87A3D",
					alert: "#A85050",
					info: "#3A6580",
				},
			},
			fontFamily: {
				sans: ["var(--font-sans)", "system-ui", "sans-serif"],
				serif: ["var(--font-fraunces)", "Georgia", "serif"],
				mono: ["var(--font-mono)", "ui-monospace", "monospace"],
			},
			backgroundImage: {
				"brand-gradient": "linear-gradient(110deg, #1F4D2C 0%, #5A9968 35%, #C4A86A 75%, #B87A3D 100%)",
			},
			animation: {
				drift: "drift 25s ease-in-out infinite",
				pulse: "pulseDot 2s infinite",
			},
			keyframes: {
				drift: {
					"0%, 100%": { transform: "translate(0, 0) scale(1)" },
					"33%": { transform: "translate(-30px, 20px) scale(1.04)" },
					"66%": { transform: "translate(20px, -15px) scale(1.02)" },
				},
				pulseDot: {
					"0%": { boxShadow: "0 0 0 0 rgba(90,153,104,0.5)" },
					"70%": { boxShadow: "0 0 0 8px rgba(90,153,104,0)" },
					"100%": { boxShadow: "0 0 0 0 rgba(90,153,104,0)" },
				},
			},
		},
	},
	plugins: [],
};

export default config;
