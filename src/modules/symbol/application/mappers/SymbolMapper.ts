import { CodeSymbol } from "../../domain/entities/CodeSymbol.js";
import { FileLocation } from "../../domain/value-objects/FileLocation.js";
import { Signature } from "../../domain/value-objects/Signature.js";
import type { SymbolOutput } from "../dtos/symbol.dto.js";

/**
 * Symbol Mapper
 *
 * Maps between domain entities and DTOs.
 */
export class SymbolMapper {
  /**
   * Convert CodeSymbol entity to SymbolOutput DTO
   */
  public static toDto(symbol: CodeSymbol): SymbolOutput {
    return {
      id: symbol.id,
      name: symbol.name,
      qualifiedName: symbol.qualifiedName,
      kind: symbol.kind,
      file: symbol.file,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      parent: symbol.parent,
      visibility: symbol.visibility,
      exported: symbol.exported,
      language: symbol.language,
      docRef: symbol.docRef,
      summary: symbol.summary,
      docComment: symbol.docComment,
      tags: symbol.tags.length > 0 ? symbol.tags : undefined,
      domain: symbol.domain,
      boundedContext: symbol.boundedContext,
      extends: symbol.extends,
      implements: symbol.implements.length > 0 ? symbol.implements : undefined,
      layer: symbol.layer,
      metrics: symbol.metrics,
      pattern: symbol.pattern,
      violations: symbol.violations.length > 0 ? symbol.violations : undefined,
      deprecated: symbol.deprecated,
      stability: symbol.stability,
      signature: symbol.signature?.raw,
      explanation: symbol.explanation,
    };
  }

  /**
   * Convert multiple CodeSymbol entities to DTOs
   */
  public static toDtoList(symbols: CodeSymbol[]): SymbolOutput[] {
    return symbols.map((s) => SymbolMapper.toDto(s));
  }

  /**
   * Convert raw persistence data to CodeSymbol entity
   */
  public static toDomain(raw: {
    id: string;
    name: string;
    qualified_name?: string | null;
    kind: string;
    file: string;
    start_line: number;
    end_line: number;
    parent?: string | null;
    visibility?: string | null;
    exported?: number | null;
    language?: string | null;
    doc_ref?: string | null;
    summary?: string | null;
    doc_comment?: string | null;
    tags?: string | null;
    domain?: string | null;
    bounded_context?: string | null;
    sym_extends?: string | null;
    sym_implements?: string | null;
    uses_traits?: string | null;
    sym_references?: string | null;
    referenced_by?: string | null;
    layer?: string | null;
    metrics?: string | null;
    pattern?: string | null;
    violations?: string | null;
    deprecated?: number | null;
    since?: string | null;
    stability?: string | null;
    generated?: number | null;
    source?: string | null;
    last_modified?: string | null;
    signature?: string | null;
    explanation?: string | null;
    explanation_hash?: string | null;
  }): CodeSymbol {
    const parseJson = (v: string | null): string[] | undefined => (v ? JSON.parse(v) : undefined);
    const toBool = (v: number | null): boolean | undefined => (v !== null ? v === 1 : undefined);

    return CodeSymbol.fromPersistence(raw.id, {
      name: raw.name,
      qualifiedName: raw.qualified_name ?? undefined,
      kind: raw.kind as CodeSymbol["kind"],
      location: FileLocation.create({
        filePath: raw.file,
        startLine: raw.start_line,
        endLine: raw.end_line,
      }),
      parent: raw.parent ?? undefined,
      visibility: raw.visibility as CodeSymbol["visibility"],
      exported: toBool(raw.exported ?? null),
      language: raw.language as CodeSymbol["language"],
      docRef: raw.doc_ref ?? undefined,
      summary: raw.summary ?? undefined,
      docComment: raw.doc_comment ?? undefined,
      tags: parseJson(raw.tags ?? null),
      domain: raw.domain ?? undefined,
      boundedContext: raw.bounded_context ?? undefined,
      extends: raw.sym_extends ?? undefined,
      implements: parseJson(raw.sym_implements ?? null),
      usesTraits: parseJson(raw.uses_traits ?? null),
      references: parseJson(raw.sym_references ?? null),
      referencedBy: parseJson(raw.referenced_by ?? null),
      layer: raw.layer as CodeSymbol["layer"],
      metrics: raw.metrics ? JSON.parse(raw.metrics) : undefined,
      pattern: raw.pattern ?? undefined,
      violations: parseJson(raw.violations ?? null),
      deprecated: toBool(raw.deprecated ?? null),
      since: raw.since ?? undefined,
      stability: raw.stability as CodeSymbol["stability"],
      generated: toBool(raw.generated ?? null),
      source: raw.source as CodeSymbol["source"],
      lastModified: raw.last_modified ? new Date(raw.last_modified) : undefined,
      signature: raw.signature ? Signature.fromRaw(raw.signature) : undefined,
      explanation: raw.explanation ?? undefined,
      explanationHash: raw.explanation_hash ?? undefined,
    });
  }

  /**
   * Convert CodeSymbol to persistence format
   */
  public static toPersistence(symbol: CodeSymbol): Record<string, unknown> {
    const toJson = (v: unknown) => (v != null ? JSON.stringify(v) : null);
    const toBit = (v: boolean | undefined) => (v != null ? (v ? 1 : 0) : null);

    return {
      id: symbol.id,
      name: symbol.name,
      qualified_name: symbol.qualifiedName ?? null,
      kind: symbol.kind,
      file: symbol.file,
      start_line: symbol.startLine,
      end_line: symbol.endLine,
      parent: symbol.parent ?? null,
      visibility: symbol.visibility ?? null,
      exported: toBit(symbol.exported),
      language: symbol.language ?? null,
      doc_ref: symbol.docRef ?? null,
      summary: symbol.summary ?? null,
      doc_comment: symbol.docComment ?? null,
      tags: toJson(symbol.tags.length > 0 ? symbol.tags : null),
      domain: symbol.domain ?? null,
      bounded_context: symbol.boundedContext ?? null,
      sym_extends: symbol.extends ?? null,
      sym_implements: toJson(symbol.implements.length > 0 ? symbol.implements : null),
      uses_traits: toJson(symbol.usesTraits.length > 0 ? symbol.usesTraits : null),
      sym_references: toJson(symbol.references.length > 0 ? symbol.references : null),
      referenced_by: toJson(symbol.referencedBy.length > 0 ? symbol.referencedBy : null),
      layer: symbol.layer ?? null,
      metrics: toJson(symbol.metrics),
      pattern: symbol.pattern ?? null,
      violations: toJson(symbol.violations.length > 0 ? symbol.violations : null),
      deprecated: toBit(symbol.deprecated),
      since: symbol.since ?? null,
      stability: symbol.stability ?? null,
      generated: toBit(symbol.generated),
      source: symbol.source ?? null,
      last_modified: symbol.lastModified?.toISOString() ?? null,
      signature: symbol.signature?.raw ?? null,
      explanation: symbol.explanation ?? null,
      explanation_hash: symbol.explanationHash ?? null,
    };
  }
}
