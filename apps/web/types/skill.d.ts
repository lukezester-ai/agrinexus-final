export interface Skill {
  id?: string;
  slug?: string; // for static skills – folder name
  name: string;
  description: string;
  instructions?: string;
  files_json?: string; // JSON string { zip_url: string }
  public?: boolean;
  created_at?: string;
}
