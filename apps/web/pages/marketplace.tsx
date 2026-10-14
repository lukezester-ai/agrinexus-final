import { GetServerSideProps } from "next";
import SkillCard from "../components/SkillCard";
import { supabase } from "../lib/supabase";

type Skill = {
  id?: string;
  slug?: string;
  name: string;
  description: string;
  files_json?: string;
  public?: boolean;
  created_at?: string;
};

export const getServerSideProps: GetServerSideProps = async () => {
  // 1️⃣ Статични skills от публичния JSON
  const staticRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/public/skills-index.json`);
  const staticSkills: Skill[] = (await staticRes.json()) ?? [];

  // 2️⃣ Публични потребителски skills от Supabase
  const { data: userSkills, error } = await supabase
    .from("skills")
    .select("id, name, description, files_json, public, created_at")
    .eq("public", true);
  if (error) console.error("Supabase fetch error:", error);

  const allSkills = [...staticSkills, ...(userSkills ?? [])];

  return { props: { skills: allSkills } };
};

export default function Marketplace({ skills }: { skills: Skill[] }) {
  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Marketplace – Skills</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {skills.map((skill) => (
          <SkillCard key={skill.id ?? skill.slug} skill={skill} />
        ))}
      </div>
    </div>
  );
}
