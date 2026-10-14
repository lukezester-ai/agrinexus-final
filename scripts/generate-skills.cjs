// generate-skills.cjs
// Чете всички SKILL.md файлове под skill-squad/marketplace и генерира public/skills-index.json
const fs = require('fs');
const path = require('path');

const marketplaceDir = path.resolve(__dirname, '../skill-squad/marketplace');
const outFile = path.resolve(__dirname, '../public/skills-index.json');

function readSkillMeta(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!yamlMatch) return null;
  const yaml = yamlMatch[1];
  const meta = {};
  yaml.split('\n').forEach(line => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) meta[key.trim()] = rest.join(':').trim();
  });
  return {
    slug: path.basename(path.dirname(filePath)),
    name: meta.name || '',
    description: meta.description || ''
  };
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const skills = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const skillFile = path.join(full, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        const meta = readSkillMeta(skillFile);
        if (meta) skills.push(meta);
      }
    }
  }
  return skills;
}

const skills = walk(marketplaceDir);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(skills, null, 2), 'utf8');
console.log('Generated', outFile, 'with', skills.length, 'skills');
