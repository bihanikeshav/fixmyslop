/** Recover valid, unique geometry-crawl.v2 records into a new versioned NDJSON stream. */
import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

const root = resolve(new URL(".", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)), "../../..");
const inputPath = resolve(root, "data/geometry-crawl-raw.v2.ndjson");
const outputPath = resolve(root, "data/geometry-crawl-raw.v2.1.ndjson");

async function main(): Promise<void> {
  const input = createReadStream(inputPath, { encoding: "utf8" });
  const output = createWriteStream(outputPath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  const seen = new Set<string>();
  let physical = 0; let valid = 0; let duplicates = 0; let bad = 0;
  for await (const line of lines) {
    physical++;
    if (!line.trim()) continue;
    let record: Record<string, any>;
    try { record = JSON.parse(line); } catch { bad++; continue; }
    if (record.schemaVersion !== "geometry-crawl.v2" || !record.host) { bad++; continue; }
    if (seen.has(record.host)) { duplicates++; continue; }
    seen.add(record.host);
    const serialized = JSON.stringify(record) + "\n";
    if (!output.write(serialized)) await new Promise<void>((resolveDrain) => output.once("drain", resolveDrain));
    valid++;
  }
  await new Promise<void>((resolveClose, rejectClose) => output.end(() => resolveClose()));
  console.log(JSON.stringify({ physical, valid, duplicates, bad, output: outputPath }));
}

main().catch((error) => { console.error(error); process.exit(1); });
