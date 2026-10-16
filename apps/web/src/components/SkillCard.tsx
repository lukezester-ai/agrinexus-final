import React from "react";

type Skill = {
  id?: string; // Supabase id
  slug?: string; // static skill folder name
  name: string;
  description: string;
  files_json?: string; // JSON string with zip_url
  public?: boolean;
};

export default function SkillCard({ skill }: { skill: Skill }) {
  let zipUrl: string | undefined;
  if (skill.files_json) {
    try {
      const parsed = JSON.parse(skill.files_json);
      zipUrl = parsed.zip_url;
    } catch {
      // невалиден files_json — оставяме zipUrl празен
    }
  }
  // fallback for static skills (assume zip at /skill/<slug>.zip)
  if (!zipUrl && skill.slug) {
    zipUrl = `/skill/${skill.slug}.zip`;
  }

  return (
    <div className="border rounded-lg p-4 shadow hover:shadow-lg transition">
      <h3 className="text-xl font-semibold mb-1">{skill.name}</h3>
      <p className="text-gray-600 mb-2 line-clamp-3">{skill.description}</p>
      {zipUrl && (
        <a
          href={zipUrl}
          download
          className="inline-block px-3 py-1 bg-green-600 text-white rounded"
        >
          📦 Свали ZIP
        </a>
      )}
      {skill.public === false && (
        <span className="ml-2 text-sm italic text-gray-500">(личен)</span>
      )}
    </div>
  );
}
