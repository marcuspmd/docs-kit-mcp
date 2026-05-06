import "reflect-metadata";
import { setupContainer, resolve } from "../../di/container.js";
import {
  SYMBOL_REPO_TOKEN,
  DOC_REGISTRY_TOKEN,
  KNOWLEDGE_GRAPH_TOKEN,
  DATABASE_TOKEN,
  LLM_PROVIDER_TOKEN,
} from "../../di/tokens.js";
import type { SymbolRepository } from "../../storage/db.js";
import type { DocRegistry } from "../../docs/docRegistry.js";
import type { KnowledgeGraph } from "../../knowledge/graph.js";
import type { LlmProvider } from "../../llm/provider.js";
import type Database from "better-sqlite3";
import { buildExplainSymbolContext, cacheSymbolExplanation } from "../../handlers/explainSymbol.js";
import { resolveConfigPath } from "../utils/index.js";
import { loadConfig } from "../../configLoader.js";

/**
 * Explain symbol command - Explain a symbol with code + docs context
 */
export interface ExplainSymbolUseCaseParams {
  symbolName: string;
  docsDir?: string;
  dbPath?: string;
  cwd?: string;
  useLlm?: boolean;
}

export async function explainSymbolUseCase(params: ExplainSymbolUseCaseParams): Promise<string> {
  const { symbolName, docsDir: customDocsDir, useLlm = true } = params;

  if (!symbolName) {
    throw new Error("Symbol name is required");
  }

  const configDir = params.cwd || process.cwd();
  const config = await loadConfig(configDir);
  const dbPath = resolveConfigPath(params.dbPath, configDir, config.dbPath);
  const docsDir = customDocsDir || "docs";

  await setupContainer({ cwd: configDir, dbPath });

  const db = resolve<Database.Database>(DATABASE_TOKEN);
  try {
    const symbolRepo = resolve<SymbolRepository>(SYMBOL_REPO_TOKEN);
    const registry = resolve<DocRegistry>(DOC_REGISTRY_TOKEN);
    const graph = resolve<KnowledgeGraph>(KNOWLEDGE_GRAPH_TOKEN);
    const llm = resolve<LlmProvider>(LLM_PROVIDER_TOKEN);

    const result = await buildExplainSymbolContext(symbolName, {
      projectRoot: configDir,
      docsDir,
      registry,
      symbolRepo,
      graph,
    });

    if (!result.found) {
      return `❌ Symbol not found: "${symbolName}"\n\nTry using \`docs-kit index\` to build the symbol index first.`;
    }

    if (result.cachedExplanation && !result.needsUpdate) {
      console.log("✅ explain-symbol: explicação em cache está válida (hash ok).\n");
      return `✅ Cached Explanation for \`${symbolName}\`:\n\n${result.cachedExplanation}`;
    }

    if (result.cachedExplanation && result.needsUpdate) {
      console.log("♻️ explain-symbol: cache encontrado, mas está desatualizado. Recalculando...");
    }

    if (result.prompt) {
      if (!result.needsUpdate && result.cachedExplanation) {
        return `✅ Cached Explanation for \`${symbolName}\`:\n\n${result.cachedExplanation}`;
      }
      if (!useLlm) {
        return result.prompt;
      }

      const hasApiKey = Boolean(config.llm.apiKey || process.env.OPENAI_API_KEY);
      if (!hasApiKey) {
        return `${result.prompt}\n\n---\n⚠️  LLM API key not configured. Set OPENAI_API_KEY or configure llm.apiKey in docs.config.js.`;
      }

      try {
        console.log("🔎 explain-symbol: enviando prompt para a LLM...");
        console.log(
          `   modelo: ${config.llm.model} | maxTokens: ${config.llm.maxTokens} | temperature: ${config.llm.temperature}`,
        );
        console.log(`   prompt: ${result.prompt.length} caracteres`);
        const explanation = await llm.chat([{ role: "user", content: result.prompt }], {
          maxTokens: config.llm.maxTokens,
          temperature: config.llm.temperature,
        });
        console.log("✅ explain-symbol: resposta da LLM recebida.");

        const symbols = symbolRepo.findByName(symbolName);
        const sym = symbols[0];
        if (sym) {
          console.log("💾 explain-symbol: salvando explicação em cache...");
          try {
            await cacheSymbolExplanation(symbolRepo, sym, explanation, configDir);
            console.log("✅ explain-symbol: cache atualizado.");
          } catch {
            /* ignore cache update errors */
          }
        }

        return explanation;
      } catch (error) {
        console.warn("LLM call failed, returning prompt instead:", error);
        return result.prompt;
      }
    }

    return `⚠️ Could not generate explanation for "${symbolName}".`;
  } finally {
    db.close();
  }
}
