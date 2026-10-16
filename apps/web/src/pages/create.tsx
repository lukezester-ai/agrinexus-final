import { useState, ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import JSZip from "jszip";
import { marked } from "marked";

export default function CreateSkill() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = name && description && instructions;

  const onFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const onPreview = async () => setPreview(await marked.parse(instructions));

  const onSubmit = async () => {
    if (!isValid) return setError("Попълнете задължителните полета.");
    setLoading(true);
    setError(null);
    try {
      const frontMatter = `---\nname: ${name}\ndescription: ${description}\n---\n\n`;
      const skillMd = frontMatter + instructions;

      const zip = new JSZip();
      zip.file("SKILL.md", skillMd);
      files.forEach((f) => zip.file(f.name, f));

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipFileName = `${crypto.randomUUID()}.zip`;

      // Upload to Supabase Storage (public bucket "skills")
      const { error: storageErr } = await supabase.storage
        .from("skills")
        .upload(zipFileName, zipBlob, { upsert: false, contentType: "application/zip" });
      if (storageErr) throw storageErr;

      const publicUrl = supabase.storage
        .from("skills")
        .getPublicUrl(zipFileName).data.publicUrl;

      const { error: dbErr } = await supabase.from("skills").insert([
        {
          user_id: (await supabase.auth.getUser()).data.user?.id,
          name,
          description,
          instructions,
          files_json: JSON.stringify({ zip_url: publicUrl }),
          public: true,
        },
      ]);
      if (dbErr) throw dbErr;

      // Redirect to marketplace
      window.location.href = "/marketplace";
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Неочаквана грешка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Създай нов Skill</h1>

      {error && <p className="text-red-600 mb-2">{error}</p>}

      <label className="block mb-2">
        Име *
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
      </label>

      <label className="block mb-2">
        Описание *
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 border rounded"
          rows={2}
          required
        />
      </label>

      <label className="block mb-2">
        Инструкции (Markdown) *
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          className="w-full p-2 border rounded"
          rows={6}
          required
        />
      </label>

      <button
        type="button"
        onClick={onPreview}
        className="mt-2 mb-4 text-blue-600 underline"
      >
        Преглед (Markdown)
      </button>

      {preview && (
        <div
          className="prose p-2 border rounded mb-4"
          dangerouslySetInnerHTML={{ __html: preview }}
        />
      )}

      <label className="block mb-2">
        Прикачени файлове (по избор)
        <input
          type="file"
          multiple
          onChange={onFilesChange}
          className="block w-full text-sm text-gray-500"
        />
      </label>

      <button
        disabled={!isValid || loading}
        onClick={onSubmit}
        className={`mt-4 w-full py-2 px-4 rounded ${
          isValid ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
        } text-white`}
      >
        {loading ? "Съхранява се…" : "Създай Skill"}
      </button>
    </div>
  );
}
