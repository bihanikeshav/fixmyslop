import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSerialAppender } from "./io.js";

describe("createSerialAppender", () => {
  it("produces intact, non-interleaved lines under concurrent appends", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rtk-io-test-"));
    const path = join(dir, "out.ndjson");
    try {
      const appender = createSerialAppender(path);
      // Simulate a concurrency-N worker pool: many overlapping appends of
      // multi-line-length records, fired without awaiting each other first.
      const N = 40;
      const records = Array.from({ length: N }, (_, i) => ({
        host: `site-${i}.example.com`,
        // Pad the payload so a naive interleaved write would very likely
        // land mid-record rather than at a line boundary.
        blob: "x".repeat(500 + (i % 7) * 37),
        i,
      }));
      await Promise.all(records.map((r) => appender.append(JSON.stringify(r) + "\n")));

      const text = await readFile(path, "utf8");
      const lines = text.split("\n").filter((l) => l.length > 0);
      expect(lines.length).toBe(N);

      const parsed = lines.map((l) => JSON.parse(l));
      const seenIndices = new Set(parsed.map((p) => p.i));
      expect(seenIndices.size).toBe(N);
      for (let i = 0; i < N; i++) expect(seenIndices.has(i)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("appends in call order for sequential awaits", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rtk-io-test-"));
    const path = join(dir, "seq.ndjson");
    try {
      const appender = createSerialAppender(path);
      for (let i = 0; i < 10; i++) {
        await appender.append(`${i}\n`);
      }
      const text = await readFile(path, "utf8");
      expect(text).toBe("0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not permanently wedge the chain after a failed append", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rtk-io-test-"));
    const badPath = join(dir, "nested", "does-not-exist", "out.ndjson");
    const goodPath = join(dir, "ok.ndjson");
    try {
      const badAppender = createSerialAppender(badPath);
      await expect(badAppender.append("line\n")).rejects.toBeTruthy();

      const goodAppender = createSerialAppender(goodPath);
      await goodAppender.append("a\n");
      await goodAppender.append("b\n");
      const text = await readFile(goodPath, "utf8");
      expect(text).toBe("a\nb\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
