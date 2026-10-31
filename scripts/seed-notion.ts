import { ensureCompany, addKeyword } from "../src/lib/keywords";
import { addSubreddit } from "../src/lib/subreddits";

const id = ensureCompany("Notion");
for (const t of ["Notion"]) addKeyword(id, t, "brand");
for (const t of ["notion.so", "Notion AI", "Notion Calendar"]) addKeyword(id, t, "alias");
for (const t of ["Obsidian", "Evernote", "Coda", "Airtable"]) addKeyword(id, t, "competitor");
for (const t of ["notion alternative", "best note taking app"]) addKeyword(id, t, "topic");
for (const s of ["Notion", "NotionTemplates", "ObsidianMD", "PKMS", "productivity", "evernote", "airtable"])
  addSubreddit(id, s);
console.log("Seeded Notion keywords and subreddits.");
