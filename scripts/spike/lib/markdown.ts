export type Cell = string | number | bigint | boolean | null | undefined;

function cell(value: Cell): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "✓" : "✗";
  return String(value);
}

export function table(headers: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const head = `| ${headers.join(" | ")} |`;
  const rule = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(cell).join(" | ")} |`);
  return [head, rule, ...body].join("\n");
}

export function heading(level: number, text: string): string {
  return `\n${"#".repeat(level)} ${text}\n`;
}

export function bullets(lines: readonly string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}
