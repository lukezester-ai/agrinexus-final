"""
Tomato Harvest 2026 - Bilingual Report Generator (EN/RU)
Generates PNG charts for the Furrow Markets article.
Run: python scripts/generate-tomato-charts.py
Output: articles/assets/tomato-2026/*.png
"""

import os
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")

import matplotlib.pyplot as plt
import pandas as pd

OUT = Path(__file__).resolve().parent.parent / "articles" / "assets" / "tomato-2026"
OUT.mkdir(parents=True, exist_ok=True)

years = [2023, 2024, 2025, 2026]
global_prod = [44.4, 45.9, 40.3, 39.8]

countries = ["Italy", "Spain", "China", "Portugal", "Chile", "Egypt", "France", "Bulgaria"]
prod_2026 = [5.8, 2.6, 5.0, 1.3, 1.2, 0.8, 0.15, 0.02]

iran_replacement = pd.DataFrame(
    {
        "Former market": ["Iraq", "Afghanistan", "UAE", "Russia", "Kazakhstan / Central Asia"],
        "Annual volume (t)": ["~80,000", "~34,000", "~6,000", "~4,500", "<1,000"],
        "Most likely replacement": [
            "China, Türkiye, UAE re-export",
            "China, Pakistan re-export",
            "China, Egypt",
            "China, Türkiye, Uzbekistan",
            "Uzbekistan, China",
        ],
        "Strategic reasoning": [
            "Already taking share; proximity favours Türkiye",
            "Logistics through Central Asia, lower price points",
            "UAE itself re-exports to Iraq; tolerant of multiple origins",
            "Russia heavily reliant on Iran for fresh produce (Dec-Jun)",
            "Local processing capacity is growing",
        ],
    }
)

fig1, ax1 = plt.subplots(figsize=(8, 5))
ax1.plot(years, global_prod, marker="o", linewidth=2, markersize=8, color="#2c5f2d")
ax1.set_title(
    "Global Processing Tomato Production\nМировое производство томатов для переработки",
    fontsize=14,
)
ax1.set_xlabel("Year / Год", fontsize=12)
ax1.set_ylabel("Million tonnes / Млн тонн", fontsize=12)
ax1.grid(True, linestyle="--", alpha=0.6)
for y, val in zip(years, global_prod):
    ax1.annotate(f"{val} Mt", (y, val), textcoords="offset points", xytext=(0, 10), ha="center")
plt.tight_layout()
fig1.savefig(OUT / "global_production_trend.png", dpi=150)
plt.close(fig1)

fig2, ax2 = plt.subplots(figsize=(10, 6))
bars = ax2.bar(countries, prod_2026, color="#4a7c3a", edgecolor="#1a2a3a", linewidth=0.5)
ax2.set_title(
    "Processing Tomato Production 2026 (selected countries)\n"
    "Производство томатов для переработки 2026 (отдельные страны)",
    fontsize=14,
)
ax2.set_xlabel("Country / Страна", fontsize=12)
ax2.set_ylabel("Million tonnes / Млн тонн", fontsize=12)
ax2.grid(axis="y", linestyle="--", alpha=0.5)
for bar in bars:
    h = bar.get_height()
    ax2.text(
        bar.get_x() + bar.get_width() / 2.0,
        h + 0.05,
        f"{h} Mt",
        ha="center",
        va="bottom",
        fontsize=9,
    )
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
fig2.savefig(OUT / "production_2026_bar.png", dpi=150)
plt.close(fig2)

fig3, ax3 = plt.subplots(figsize=(12, 4))
ax3.axis("tight")
ax3.axis("off")
table = ax3.table(
    cellText=iran_replacement.values.tolist(),
    colLabels=iran_replacement.columns.tolist(),
    loc="center",
    cellLoc="left",
    colColours=["#f0f4f0"] * len(iran_replacement.columns),
)
table.auto_set_font_size(False)
table.set_fontsize(9)
table.scale(1.2, 1.5)
ax3.set_title(
    "Iran's former markets and likely replacements\nБывшие рынки Ирана и вероятные заменители",
    fontsize=14,
    pad=20,
)
plt.tight_layout()
fig3.savefig(OUT / "iran_replacement_table.png", dpi=150)
plt.close(fig3)

print("Saved charts to:", OUT.as_posix())
