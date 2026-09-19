/**
 * Serialized NDJSON append helper.
 *
 * `node:fs/promises` `appendFile` does not guarantee atomic ordering when
 * called concurrently from multiple in-process workers (a bounded-concurrency
 * crawl pool, for example) — on Windows in particular, overlapping appendFile
 * calls can interleave partial writes and corrupt lines in the middle of an
 * NDJSON stream. Chaining every append through a single promise tail forces
 * writes to happen one-at-a-time, in call order, while still letting callers
 * `await` each append individually and run their crawl workers concurrently.
 */
import { appendFile } from "node:fs/promises";

export interface SerialAppender {
  /** Append `text` after every previously queued append to this path has finished. */
  append(text: string): Promise<void>;
}

/**
 * Create a serial appender bound to `path`. Every call to `.append()` is
 * queued behind the previous one, so concurrent callers never interleave
 * writes even though `appendFile` itself is not atomic for multi-chunk data.
 */
export function createSerialAppender(path: string): SerialAppender {
  let tail: Promise<void> = Promise.resolve();
  return {
    append(text: string): Promise<void> {
      const next = tail.then(() => appendFile(path, text));
      // Swallow so a single failed append doesn't permanently wedge the
      // chain for subsequent callers; each caller still sees its own
      // rejection via the returned promise.
      tail = next.catch(() => undefined);
      return next;
    },
  };
}
