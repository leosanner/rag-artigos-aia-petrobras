import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { pipelineVersion } from "./pipeline-version";

const EXPECTED_PIPELINE_VERSION = ["f01", "1.0.0"].join("-");
const PIPELINE_VERSION_MODULE = path.join(
  "src",
  "domain",
  "documents",
  "pipeline-version.ts",
);

describe("pipelineVersion", () => {
  it("exposes the F-01 pipeline version string", () => {
    expect(pipelineVersion).toBe(EXPECTED_PIPELINE_VERSION);
  });

  it("keeps the F-01 pipeline version literal in this module only", async () => {
    const srcRoot = path.join(process.cwd(), "src");
    const matchingFiles: string[] = [];

    for (const filePath of await collectTypeScriptFiles(srcRoot)) {
      const relativePath = path.relative(process.cwd(), filePath);
      if (relativePath === PIPELINE_VERSION_MODULE) {
        continue;
      }

      const contents = await readFile(filePath, "utf8");
      if (contents.includes(EXPECTED_PIPELINE_VERSION)) {
        matchingFiles.push(relativePath);
      }
    }

    expect(matchingFiles).toEqual([]);
  });
});

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}
