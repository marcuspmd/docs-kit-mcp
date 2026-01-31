import type { CodeSymbol, SymbolRelationship } from "../indexer/symbol.types.js";

export interface EventFlow {
  event: CodeSymbol;
  emitters: CodeSymbol[];
  listeners: CodeSymbol[];
  complete: boolean;
}

export interface EventFlowAnalyzer {
  analyze(symbols: CodeSymbol[], relationships: SymbolRelationship[]): EventFlow[];
}

export function createEventFlowAnalyzer(): EventFlowAnalyzer {
  return {
    analyze(symbols, relationships) {
      const events = symbols.filter((s) => s.kind === "event");
      const listeners = symbols.filter((s) => s.kind === "listener");
      const byId = new Map(symbols.map((s) => [s.id, s]));

      return events.map((event) => {
        const eventBaseName = event.name.replace(/Event$/, "").toLowerCase();

        const matchedEmitters = findEmitters(event, symbols, relationships, byId);
        const matchedListeners = findListeners(event, listeners, relationships, eventBaseName);

        return {
          event,
          emitters: matchedEmitters,
          listeners: matchedListeners,
          complete: matchedEmitters.length > 0 && matchedListeners.length > 0,
        };
      });
    },
  };
}

function findEmitters(
  event: CodeSymbol,
  symbols: CodeSymbol[],
  relationships: SymbolRelationship[],
  byId: Map<string, CodeSymbol>,
): CodeSymbol[] {
  const emitterIds = new Set<string>();

  for (const r of relationships) {
    if (r.targetId === event.id && (r.type === "uses" || r.type === "instantiates")) {
      const candidate = byId.get(r.sourceId);
      if (candidate && candidate.kind !== "listener") {
        emitterIds.add(r.sourceId);
      }
    }
  }

  const result: CodeSymbol[] = [];
  for (const id of emitterIds) {
    const sym = byId.get(id);
    if (sym) result.push(sym);
  }
  return result;
}

function findListeners(
  event: CodeSymbol,
  listeners: CodeSymbol[],
  relationships: SymbolRelationship[],
  eventBaseName: string,
): CodeSymbol[] {
  const matched = new Map<string, CodeSymbol>();

  for (const r of relationships) {
    if (r.targetId === event.id || r.sourceId === event.id) {
      const candidateId = r.targetId === event.id ? r.sourceId : r.targetId;
      const candidate = listeners.find((l) => l.id === candidateId);
      if (candidate) matched.set(candidate.id, candidate);
    }
  }

  for (const listener of listeners) {
    if (matched.has(listener.id)) continue;
    const listenerBase = listener.name
      .replace(/Listener$|Handler$|Subscriber$/, "")
      .toLowerCase();
    if (listenerBase && eventBaseName && listenerBase === eventBaseName) {
      matched.set(listener.id, listener);
    }
  }

  return [...matched.values()];
}
