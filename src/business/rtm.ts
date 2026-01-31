import type { TraceabilityEntry } from "./contextMapper.js";

export interface RTM {
  getByTicket(ticketId: string): TraceabilityEntry | undefined;
  getAll(): TraceabilityEntry[];
  export(format: "markdown" | "csv"): string;
}

export function createRTM(entries: TraceabilityEntry[]): RTM {
  const byTicket = new Map(entries.map((e) => [e.ticketId, e]));

  return {
    getByTicket(ticketId) {
      return byTicket.get(ticketId);
    },

    getAll() {
      return entries;
    },

    export(format) {
      if (format === "csv") {
        return exportCsv(entries);
      }
      return exportMarkdown(entries);
    },
  };
}

function exportMarkdown(entries: TraceabilityEntry[]): string {
  const lines: string[] = [
    "| Ticket | Symbols | Tests | Docs |",
    "|--------|---------|-------|------|",
  ];

  for (const e of entries) {
    const symbols = e.symbols.join(", ") || "—";
    const tests = e.tests.join(", ") || "—";
    const docs = e.docs.join(", ") || "—";
    lines.push(`| ${e.ticketId} | ${symbols} | ${tests} | ${docs} |`);
  }

  return lines.join("\n") + "\n";
}

function exportCsv(entries: TraceabilityEntry[]): string {
  const lines: string[] = ["ticket,symbols,tests,docs"];

  for (const e of entries) {
    const esc = (arr: string[]) => `"${arr.join(";")}"`;
    lines.push(`${e.ticketId},${esc(e.symbols)},${esc(e.tests)},${esc(e.docs)}`);
  }

  return lines.join("\n") + "\n";
}
