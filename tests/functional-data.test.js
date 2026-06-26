import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(__dirname, "..", "skills");

test("ponytail SKILL.md contains functional data rule", () => {
  const skill = readFileSync(join(skillsDir, "ponytail", "SKILL.md"), "utf8");
  
  // Rule must mention functional data preservation
  assert.match(skill, /functional data/i, "Rule should mention 'functional data'");
  
  // Rule must specify URLs need protocols
  assert.match(skill, /https?:\/\//, "Rule should show protocol example");
  
  // Rule must state URLs without protocol are broken
  assert.match(skill, /broken/i, "Rule should warn about broken URLs");
});

test("ponytail-review SKILL.md contains functional data rule", () => {
  const skill = readFileSync(join(skillsDir, "ponytail-review", "SKILL.md"), "utf8");
  
  // Rule must be in Boundaries section
  assert.match(skill, /Never shrink functional data/i, "Boundary should forbid shrinking functional data");
  
  // Rule must mention URLs specifically
  assert.match(skill, /URL.*protocol/i, "Rule should mention URL protocols");
});

test("functional data example exists", () => {
  const example = readFileSync(join(__dirname, "..", "examples", "functional-data.md"), "utf8");
  
  // Example must show the broken case
  assert.match(example, /alibabacloud\.com\/help/i, "Example should show URL without protocol");
  
  // Example must show the correct case  
  assert.match(example, /https:\/\/www\.alibabacloud\.com/i, "Example should show URL with protocol");
  
  // Example must explain why
  assert.match(example, /not.*shorter.*broken/i, "Example should explain the principle");
});
