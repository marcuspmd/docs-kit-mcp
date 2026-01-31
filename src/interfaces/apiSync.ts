import { readFile } from "node:fs/promises";
import YAML from "yaml";
import type { CodeSymbol } from "../indexer/symbol.types.js";

export interface ApiEndpoint {
  method: string;
  path: string;
  parameters: Array<{ name: string; type: string; required: boolean }>;
  responseType?: string;
  symbolId: string;
}

export interface ApiDiscrepancy {
  type: "missing_in_spec" | "missing_in_code" | "type_mismatch" | "deprecated";
  endpoint: string;
  details: string;
}

export interface ApiSync {
  extractEndpointsFromCode(symbols: CodeSymbol[]): ApiEndpoint[];
  parseOpenApiSpec(specPath: string): Promise<ApiEndpoint[]>;
  parseOpenApiObject(spec: OpenApiSpec): ApiEndpoint[];
  compare(code: ApiEndpoint[], spec: ApiEndpoint[]): ApiDiscrepancy[];
}

/* ================== OpenAPI types (minimal) ================== */

interface OpenApiParameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: { type?: string };
}

interface OpenApiOperation {
  operationId?: string;
  parameters?: OpenApiParameter[];
  responses?: Record<string, { content?: Record<string, { schema?: { type?: string; $ref?: string } }> }>;
  deprecated?: boolean;
}

type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  delete?: OpenApiOperation;
  patch?: OpenApiOperation;
  parameters?: OpenApiParameter[];
}

export interface OpenApiSpec {
  paths?: Record<string, OpenApiPathItem>;
}

/* ================== Helpers ================== */

const HTTP_METHODS: HttpMethod[] = ["get", "post", "put", "delete", "patch"];

const METHOD_TAG_PATTERN = /^(GET|POST|PUT|DELETE|PATCH)\s+(.+)$/i;

function endpointKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${normalizePath(path)}`;
}

function normalizePath(path: string): string {
  return path.replace(/\{([^}]+)\}/g, ":$1");
}

function extractResponseType(op: OpenApiOperation): string | undefined {
  const resp200 = op.responses?.["200"] ?? op.responses?.["201"];
  if (!resp200?.content) return undefined;
  const json = resp200.content["application/json"];
  if (!json?.schema) return undefined;
  if (json.schema.$ref) {
    return json.schema.$ref.split("/").pop();
  }
  return json.schema.type;
}

/* ================== Implementation ================== */

export function createApiSync(): ApiSync {
  return {
    extractEndpointsFromCode(symbols) {
      const endpoints: ApiEndpoint[] = [];
      const controllers = symbols.filter(
        (s) => s.kind === "controller" || /Controller$/i.test(s.name),
      );
      const controllerIds = new Set(controllers.map((c) => c.id));

      const methods = symbols.filter(
        (s) => s.kind === "method" && s.parent && controllerIds.has(s.parent),
      );

      for (const m of methods) {
        const tags = m.tags ?? [];
        for (const tag of tags) {
          const match = METHOD_TAG_PATTERN.exec(tag);
          if (!match) continue;

          const httpMethod = match[1].toUpperCase();
          const path = match[2];

          const params: ApiEndpoint["parameters"] = [];
          const sig = m.signature ?? "";
          const paramMatches = sig.matchAll(/(\w+)\s*:\s*(\w+)/g);
          for (const pm of paramMatches) {
            params.push({ name: pm[1], type: pm[2], required: true });
          }

          endpoints.push({
            method: httpMethod,
            path,
            parameters: params,
            responseType: m.summary?.match(/returns?\s+(\w+)/i)?.[1],
            symbolId: m.id,
          });
        }
      }

      return endpoints;
    },

    async parseOpenApiSpec(specPath) {
      const content = await readFile(specPath, "utf-8");
      const spec: OpenApiSpec = specPath.endsWith(".json")
        ? JSON.parse(content)
        : YAML.parse(content);

      return this.parseOpenApiObject(spec);
    },

    parseOpenApiObject(spec) {
      const endpoints: ApiEndpoint[] = [];
      const paths = spec.paths ?? {};

      for (const [path, pathItem] of Object.entries(paths)) {
        const sharedParams = pathItem.parameters ?? [];

        for (const method of HTTP_METHODS) {
          const op = pathItem[method];
          if (!op) continue;

          const allParams = [...sharedParams, ...(op.parameters ?? [])];
          const params = allParams.map((p) => ({
            name: p.name,
            type: p.schema?.type ?? "string",
            required: p.required ?? false,
          }));

          endpoints.push({
            method: method.toUpperCase(),
            path: normalizePath(path),
            parameters: params,
            responseType: extractResponseType(op),
            symbolId: op.operationId ?? `${method}:${path}`,
          });
        }
      }

      return endpoints;
    },

    compare(code, spec) {
      const discrepancies: ApiDiscrepancy[] = [];
      const codeMap = new Map(code.map((e) => [endpointKey(e.method, e.path), e]));
      const specMap = new Map(spec.map((e) => [endpointKey(e.method, e.path), e]));

      // Missing in spec
      for (const [key, ep] of codeMap) {
        if (!specMap.has(key)) {
          discrepancies.push({
            type: "missing_in_spec",
            endpoint: key,
            details: `Exists in code (${ep.symbolId}) but not in spec`,
          });
        }
      }

      // Missing in code
      for (const [key, ep] of specMap) {
        if (!codeMap.has(key)) {
          discrepancies.push({
            type: "missing_in_code",
            endpoint: key,
            details: `Exists in spec (${ep.symbolId}) but not in code`,
          });
        }
      }

      // Type/param mismatches
      for (const [key, codeEp] of codeMap) {
        const specEp = specMap.get(key);
        if (!specEp) continue;

        const codeParams = new Map(codeEp.parameters.map((p) => [p.name, p]));
        const specParams = new Map(specEp.parameters.map((p) => [p.name, p]));

        for (const [name, cp] of codeParams) {
          const sp = specParams.get(name);
          if (!sp) {
            discrepancies.push({
              type: "type_mismatch",
              endpoint: key,
              details: `Parameter '${name}' exists in code but missing in spec`,
            });
          } else if (cp.type !== sp.type) {
            discrepancies.push({
              type: "type_mismatch",
              endpoint: key,
              details: `Parameter '${name}' type mismatch: code='${cp.type}' spec='${sp.type}'`,
            });
          }
        }

        for (const name of specParams.keys()) {
          if (!codeParams.has(name)) {
            discrepancies.push({
              type: "type_mismatch",
              endpoint: key,
              details: `Parameter '${name}' exists in spec but missing in code`,
            });
          }
        }

        if (codeEp.responseType && specEp.responseType && codeEp.responseType !== specEp.responseType) {
          discrepancies.push({
            type: "type_mismatch",
            endpoint: key,
            details: `Response type mismatch: code='${codeEp.responseType}' spec='${specEp.responseType}'`,
          });
        }
      }

      return discrepancies;
    },
  };
}
