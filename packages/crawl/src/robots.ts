/**
 * TypeScript-facing re-export of the shared robots.txt parser/checker.
 *
 * The implementation lives in robots.mjs (plain ESM JS, typed via the
 * sibling robots.d.mts) so it can be imported with no loader by both the
 * TS crawl entry points (via this file) AND harvest-gallery-leads.mjs,
 * which runs under plain `node` and cannot import .ts source directly.
 */
export * from "./robots.mjs";
