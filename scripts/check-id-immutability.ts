/**
 * ID Immutability Check
 *
 * Ensures that existing IDs are not modified in PRs.
 * Compares modified YAML files against the base branch.
 * Run with: tsx scripts/check-id-immutability.ts <base-ref>
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const baseRef = process.argv[2] ?? "origin/main";

function getModifiedDataFiles(): string[] {
  try {
    const output = execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=M", baseRef, "--", "data/**/*.yaml"],
      { encoding: "utf-8" }
    );
    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function getBaseFileContent(filePath: string): string | null {
  try {
    return execFileSync("git", ["show", `${baseRef}:${filePath}`], {
      encoding: "utf-8",
    });
  } catch {
    return null;
  }
}

function checkIdImmutability(): void {
  const modifiedFiles = getModifiedDataFiles();
  const errors: string[] = [];

  for (const file of modifiedFiles) {
    const baseContent = getBaseFileContent(file);
    if (!baseContent) continue;

    const baseData = parseYaml(baseContent) as { id?: unknown };
    if (baseData.id === undefined) continue;

    const currentPath = path.resolve(file);
    if (!fs.existsSync(currentPath)) continue;

    const currentContent = fs.readFileSync(currentPath, "utf-8");
    const currentData = parseYaml(currentContent) as { id?: unknown };

    if (currentData.id !== baseData.id) {
      errors.push(
        `${file}: ID was changed from '${baseData.id}' to '${currentData.id}'. IDs are immutable once assigned.`
      );
    }
  }

  if (errors.length > 0) {
    console.error("❌ ID immutability check failed!\n");
    for (const error of errors) {
      console.error(`  ⚠️  ${error}`);
    }
    process.exit(1);
  }

  console.log(`✅ ID immutability check passed (${modifiedFiles.length} files checked)`);
}

checkIdImmutability();
