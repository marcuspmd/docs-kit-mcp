import type { CodeSymbol, SymbolRelationship } from "../indexer/symbol.types.js";

export type PatternKind = "observer" | "factory" | "singleton" | "strategy" | "repository";

export interface DetectedPattern {
  kind: PatternKind;
  symbols: string[];
  confidence: number;
  violations: string[];
}

export interface PatternAnalyzer {
  analyze(symbols: CodeSymbol[], relationships: SymbolRelationship[]): DetectedPattern[];
}

function detectObserver(
  symbols: CodeSymbol[],
  relationships: SymbolRelationship[],
): DetectedPattern[] {
  const events = symbols.filter((s) => s.kind === "event");
  const listeners = symbols.filter((s) => s.kind === "listener");
  const results: DetectedPattern[] = [];

  for (const event of events) {
    const matchedListeners = listeners.filter((l) => {
      const byName = l.name
        .toLowerCase()
        .includes(event.name.replace(/Events?$/, "").toLowerCase());
      const byRel = relationships.some(
        (r) =>
          (r.sourceId === l.id && r.targetId === event.id) ||
          (r.sourceId === event.id && r.targetId === l.id),
      );
      return byName || byRel;
    });

    const involvedIds = [event.id, ...matchedListeners.map((l) => l.id)];
    const violations: string[] = [];

    if (matchedListeners.length === 0) {
      violations.push(`No listeners found for event '${event.name}'`);
    }

    results.push({
      kind: "observer",
      symbols: involvedIds,
      confidence: matchedListeners.length > 0 ? 0.9 : 0.6,
      violations,
    });
  }

  return results;
}

function detectFactory(
  symbols: CodeSymbol[],
  relationships: SymbolRelationship[],
): DetectedPattern[] {
  const results: DetectedPattern[] = [];
  const classes = symbols.filter((s) => s.kind === "class" || s.kind === "abstract_class");

  for (const cls of classes) {
    const methods = symbols.filter((s) => s.parent === cls.id && s.kind === "method");
    const factoryMethods = methods.filter((m) => /^(create|build|make|from|of|new)/.test(m.name));

    if (factoryMethods.length === 0) continue;

    const producedTypes = relationships.filter(
      (r) => factoryMethods.some((m) => m.id === r.sourceId) && r.type === "instantiates",
    );

    const involvedIds = [cls.id, ...factoryMethods.map((m) => m.id)];
    const violations: string[] = [];

    if (producedTypes.length === 0) {
      violations.push(`Factory '${cls.name}' has create methods but no detected instantiations`);
    }

    const confidence = producedTypes.length > 0 ? 0.9 : 0.7;

    results.push({
      kind: "factory",
      symbols: involvedIds,
      confidence,
      violations,
    });
  }

  return results;
}

function detectSingleton(symbols: CodeSymbol[]): DetectedPattern[] {
  const results: DetectedPattern[] = [];
  const classes = symbols.filter((s) => s.kind === "class");

  for (const cls of classes) {
    const children = symbols.filter((s) => s.parent === cls.id);
    const hasPrivateConstructor = children.some(
      (s) => s.kind === "constructor" && s.visibility === "private",
    );
    const hasStaticInstance = children.some(
      (s) => s.name === "instance" || s.name === "getInstance",
    );

    if (!hasPrivateConstructor && !hasStaticInstance) continue;

    const violations: string[] = [];
    if (hasPrivateConstructor && !hasStaticInstance) {
      violations.push(
        `Singleton '${cls.name}' has private constructor but no static instance accessor`,
      );
    }
    if (!hasPrivateConstructor && hasStaticInstance) {
      violations.push(`Singleton '${cls.name}' has static instance but constructor is not private`);
    }

    const confidence = hasPrivateConstructor && hasStaticInstance ? 0.95 : 0.6;

    results.push({
      kind: "singleton",
      symbols: [cls.id],
      confidence,
      violations,
    });
  }

  return results;
}

function detectStrategy(
  symbols: CodeSymbol[],
  relationships: SymbolRelationship[],
): DetectedPattern[] {
  const results: DetectedPattern[] = [];
  const interfaces = symbols.filter((s) => s.kind === "interface");

  for (const iface of interfaces) {
    const implementors = symbols.filter(
      (s) => s.implements?.includes(iface.id) || s.implements?.includes(iface.name),
    );

    if (implementors.length < 2) continue;

    const hasRelConsumer = relationships.some((r) => r.targetId === iface.id && r.type === "uses");

    const violations: string[] = [];
    if (!hasRelConsumer) {
      violations.push(`Strategy interface '${iface.name}' has no detected consumer using it`);
    }

    results.push({
      kind: "strategy",
      symbols: [iface.id, ...implementors.map((s) => s.id)],
      confidence: hasRelConsumer ? 0.85 : 0.6,
      violations,
    });
  }

  return results;
}

function detectRepository(
  symbols: CodeSymbol[],
  relationships: SymbolRelationship[],
): DetectedPattern[] {
  const results: DetectedPattern[] = [];
  const repoCandidates = symbols.filter(
    (s) => s.kind === "repository" || (s.kind === "class" && /Repository$/i.test(s.name)),
  );

  const repoMethodNames = ["find", "save", "delete", "update", "get", "remove", "create"];

  for (const repo of repoCandidates) {
    const methods = symbols.filter((s) => s.parent === repo.id && s.kind === "method");
    const matchingMethods = methods.filter((m) =>
      repoMethodNames.some((n) => m.name.toLowerCase().startsWith(n)),
    );

    const entityRels = relationships.filter(
      (r) => r.sourceId === repo.id && (r.type === "uses" || r.type === "instantiates"),
    );
    const entityTargets = entityRels
      .map((r) => symbols.find((s) => s.id === r.targetId))
      .filter((s) => s?.kind === "entity");

    const violations: string[] = [];
    if (matchingMethods.length === 0) {
      violations.push(`Repository '${repo.name}' has no standard CRUD methods`);
    }
    if (entityTargets.length === 0) {
      violations.push(`Repository '${repo.name}' has no associated entity`);
    }

    const score =
      (matchingMethods.length > 0 ? 0.4 : 0) +
      (entityTargets.length > 0 ? 0.3 : 0) +
      (repo.kind === "repository" ? 0.3 : 0.1);

    results.push({
      kind: "repository",
      symbols: [repo.id, ...matchingMethods.map((m) => m.id)],
      confidence: Math.min(score, 1),
      violations,
    });
  }

  return results;
}

export function createPatternAnalyzer(): PatternAnalyzer {
  return {
    analyze(symbols, relationships) {
      return [
        ...detectObserver(symbols, relationships),
        ...detectFactory(symbols, relationships),
        ...detectSingleton(symbols),
        ...detectStrategy(symbols, relationships),
        ...detectRepository(symbols, relationships),
      ];
    },
  };
}
