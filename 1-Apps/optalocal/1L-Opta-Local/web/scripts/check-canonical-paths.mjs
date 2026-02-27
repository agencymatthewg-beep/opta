import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..", "..");

const filesToCheck = [
  "docs/WORKFLOWS.md",
  "docs/KNOWLEDGE.md",
  "docs/plans/2026-02-26-production-readiness-plan.md",
  "COMPLETION-PLAN-2026-02-26.md",
  "gu-opta-local.html",
];

const forbiddenAliasPaths = [
  "1-Apps/1L-Opta-Local",
  "1-Apps/1M-Opta-LMX",
  "1-Apps/1D-Opta-CLI-TS",
  "1-Apps/1I-OptaPlus",
  "1-Apps/1J-Optamize-MacOS",
  "1-Apps/1F-Opta-Life-Web",
  "1-Apps/1B-AICompare-Web",
];

const violations = [];

for (const relativeFile of filesToCheck) {
  const absoluteFile = path.join(appRoot, relativeFile);
  if (!fs.existsSync(absoluteFile)) {
    violations.push({
      file: relativeFile,
      line: 0,
      pattern: "missing-file",
    });
    continue;
  }

  const lines = fs.readFileSync(absoluteFile, "utf8").split(/\r?\n/);
  lines.forEach((line, lineIndex) => {
    for (const forbiddenPath of forbiddenAliasPaths) {
      if (line.includes(forbiddenPath)) {
        violations.push({
          file: relativeFile,
          line: lineIndex + 1,
          pattern: forbiddenPath,
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error("Canonical path check failed.");
  for (const violation of violations) {
    if (violation.pattern === "missing-file") {
      console.error(`- ${violation.file}: file not found`);
      continue;
    }
    console.error(
      `- ${violation.file}:${violation.line} contains alias path "${violation.pattern}"`,
    );
  }
  process.exit(1);
}

console.log(
  `Canonical path check passed (${filesToCheck.length} files checked).`,
);
