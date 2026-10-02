import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_GAMES, type GameDefinition } from "../src/index.ts";

export const FIXTURES = join(import.meta.dirname, "..", "..", "..", "fixtures");
export const fixture = (rel: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, rel), "utf8"));
export const game = (slug: string): GameDefinition => DEFAULT_GAMES[slug] as GameDefinition;
export const FIXED_NOW = new Date("2026-10-02T12:00:00Z");
