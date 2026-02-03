import { Entity } from "../../../../@core/domain/Entity.js";
import { SymbolId } from "../value-objects/SymbolId.js";
import { SymbolKind, type SymbolKindType } from "../value-objects/SymbolKind.js";
import { FileLocation } from "../value-objects/FileLocation.js";
import { Signature } from "../value-objects/Signature.js";
import { z } from "zod";

export const VisibilitySchema = z.enum(["public", "protected", "private"]);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const LayerSchema = z.enum([
  "domain",
  "application",
  "infrastructure",
  "presentation",
  "test",
]);
export type Layer = z.infer<typeof LayerSchema>;

export const StabilitySchema = z.enum(["experimental", "stable", "deprecated"]);
export type Stability = z.infer<typeof StabilitySchema>;

export const LanguageSchema = z.enum(["ts", "js", "php", "python", "go"]);
export type Language = z.infer<typeof LanguageSchema>;

export interface CodeMetrics {
  linesOfCode?: number;
  cyclomaticComplexity?: number;
  parameterCount?: number;
  testCoverage?: {
    hitCount: number;
    linesHit: number;
    linesCovered: number;
    coveragePercent: number;
    branchesHit?: number;
    branchesCovered?: number;
  };
}

export interface CodeSymbolProps {
  name: string;
  qualifiedName?: string;
  kind: SymbolKindType;
  location: FileLocation;
  parent?: string;
  visibility?: Visibility;
  exported?: boolean;
  language?: Language;
  docRef?: string;
  summary?: string;
  docComment?: string;
  tags?: string[];
  domain?: string;
  boundedContext?: string;
  extends?: string;
  implements?: string[];
  usesTraits?: string[];
  references?: string[];
  referencedBy?: string[];
  layer?: Layer;
  metrics?: CodeMetrics;
  pattern?: string;
  violations?: string[];
  deprecated?: boolean;
  since?: string;
  stability?: Stability;
  generated?: boolean;
  source?: "human" | "ai";
  lastModified?: Date;
  signature?: Signature;
  explanation?: string;
  explanationHash?: string;
}

/**
 * CodeSymbol Entity
 *
 * Represents a symbol extracted from source code (function, class, method, etc.)
 */
export class CodeSymbol extends Entity<CodeSymbolProps, string> {
  private constructor(props: CodeSymbolProps, id: string) {
    super(props, id);
  }

  get name(): string {
    return this.props.name;
  }

  get qualifiedName(): string | undefined {
    return this.props.qualifiedName;
  }

  get kind(): SymbolKindType {
    return this.props.kind;
  }

  get kindVO(): SymbolKind {
    return SymbolKind.create(this.props.kind);
  }

  get location(): FileLocation {
    return this.props.location;
  }

  get file(): string {
    return this.props.location.filePath;
  }

  get startLine(): number {
    return this.props.location.startLine;
  }

  get endLine(): number {
    return this.props.location.endLine;
  }

  get parent(): string | undefined {
    return this.props.parent;
  }

  get visibility(): Visibility | undefined {
    return this.props.visibility;
  }

  get exported(): boolean | undefined {
    return this.props.exported;
  }

  get language(): Language | undefined {
    return this.props.language;
  }

  get docRef(): string | undefined {
    return this.props.docRef;
  }

  get summary(): string | undefined {
    return this.props.summary;
  }

  get docComment(): string | undefined {
    return this.props.docComment;
  }

  get tags(): string[] {
    return this.props.tags ?? [];
  }

  get domain(): string | undefined {
    return this.props.domain;
  }

  get boundedContext(): string | undefined {
    return this.props.boundedContext;
  }

  get extends(): string | undefined {
    return this.props.extends;
  }

  get implements(): string[] {
    return this.props.implements ?? [];
  }

  get usesTraits(): string[] {
    return this.props.usesTraits ?? [];
  }

  get references(): string[] {
    return this.props.references ?? [];
  }

  get referencedBy(): string[] {
    return this.props.referencedBy ?? [];
  }

  get layer(): Layer | undefined {
    return this.props.layer;
  }

  get metrics(): CodeMetrics | undefined {
    return this.props.metrics;
  }

  get pattern(): string | undefined {
    return this.props.pattern;
  }

  get violations(): string[] {
    return this.props.violations ?? [];
  }

  get deprecated(): boolean | undefined {
    return this.props.deprecated;
  }

  get since(): string | undefined {
    return this.props.since;
  }

  get stability(): Stability | undefined {
    return this.props.stability;
  }

  get generated(): boolean | undefined {
    return this.props.generated;
  }

  get source(): "human" | "ai" | undefined {
    return this.props.source;
  }

  get lastModified(): Date | undefined {
    return this.props.lastModified;
  }

  get signature(): Signature | undefined {
    return this.props.signature;
  }

  get explanation(): string | undefined {
    return this.props.explanation;
  }

  get explanationHash(): string | undefined {
    return this.props.explanationHash;
  }

  /**
   * Create a new CodeSymbol with auto-generated ID
   */
  public static create(props: CodeSymbolProps): CodeSymbol {
    const symbolId = SymbolId.create(props.location.filePath, props.name, props.kind);
    return new CodeSymbol(props, symbolId.value);
  }

  /**
   * Reconstitute a CodeSymbol from persistence
   */
  public static fromPersistence(id: string, props: CodeSymbolProps): CodeSymbol {
    return new CodeSymbol(props, id);
  }

  /**
   * Create a stub symbol for testing or fallback
   */
  public static createStub(name: string, kind: SymbolKindType = "function"): CodeSymbol {
    const props: CodeSymbolProps = {
      name,
      kind,
      location: FileLocation.create({
        filePath: "unknown",
        startLine: 0,
        endLine: 0,
      }),
    };
    return new CodeSymbol(props, "_stub");
  }

  /**
   * Update explanation and its hash
   */
  public updateExplanation(explanation: string, hash: string): CodeSymbol {
    return new CodeSymbol(
      {
        ...this.props,
        explanation,
        explanationHash: hash,
      },
      this.id,
    );
  }

  /**
   * Mark as deprecated
   */
  public markAsDeprecated(since?: string): CodeSymbol {
    return new CodeSymbol(
      {
        ...this.props,
        deprecated: true,
        since,
        stability: "deprecated",
      },
      this.id,
    );
  }

  /**
   * Add a violation
   */
  public addViolation(violation: string): CodeSymbol {
    return new CodeSymbol(
      {
        ...this.props,
        violations: [...(this.props.violations ?? []), violation],
      },
      this.id,
    );
  }

  /**
   * Convert to plain object (for persistence)
   */
  public toPersistence(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.props.name,
      qualifiedName: this.props.qualifiedName,
      kind: this.props.kind,
      file: this.props.location.filePath,
      startLine: this.props.location.startLine,
      endLine: this.props.location.endLine,
      parent: this.props.parent,
      visibility: this.props.visibility,
      exported: this.props.exported,
      language: this.props.language,
      docRef: this.props.docRef,
      summary: this.props.summary,
      docComment: this.props.docComment,
      tags: this.props.tags,
      domain: this.props.domain,
      boundedContext: this.props.boundedContext,
      extends: this.props.extends,
      implements: this.props.implements,
      usesTraits: this.props.usesTraits,
      references: this.props.references,
      referencedBy: this.props.referencedBy,
      layer: this.props.layer,
      metrics: this.props.metrics,
      pattern: this.props.pattern,
      violations: this.props.violations,
      deprecated: this.props.deprecated,
      since: this.props.since,
      stability: this.props.stability,
      generated: this.props.generated,
      source: this.props.source,
      lastModified: this.props.lastModified,
      signature: this.props.signature?.raw,
      explanation: this.props.explanation,
      explanationHash: this.props.explanationHash,
    };
  }
}
