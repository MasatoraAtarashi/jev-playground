import { mkdirSync, writeFileSync } from "node:fs";

export function writeReport(name: string, markdown: string) {
  mkdirSync("reports", { recursive: true });
  const path = `reports/${name}.md`;
  writeFileSync(path, markdown);
  console.log(`wrote ${path}`);
}

export function table(headers: string[], rows: (string | number)[][]): string {
  const fmt = (v: string | number) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : v);
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(fmt).join(" | ")} |`),
  ].join("\n");
}

export function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, min: s[0], p50: q(0.5), p90: q(0.9), max: s[s.length - 1], mean: s.reduce((a, b) => a + b, 0) / s.length };
}
