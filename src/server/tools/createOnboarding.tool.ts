import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";

export const createOnboardingSchema = {
  topic: z.string().describe("Topic to generate learning path for"),
  docsDir: z.string().default("docs").describe("Docs directory"),
};

export function registerCreateOnboardingTool(server: McpServer, deps: ServerDependencies): void {
  const { config, ragIndex, llm } = deps;

  server.registerTool(
    "createOnboarding",
    {
      description: "Generate learning paths using RAG",
      inputSchema: createOnboardingSchema,
    },
    async ({ topic, docsDir }) => {
      try {
        if (ragIndex.chunkCount() === 0) {
          await ragIndex.indexDocs(docsDir);
        }
        const minScore = config.rag?.minScore ?? 0.2;
        const results = await ragIndex.search(topic, 10, minScore);
        if (results.length === 0) {
          return mcpSuccess(`Nenhum conteúdo relevante encontrado para: ${topic}`);
        }

        const context = results
          .map((r) => `## ${r.source} (relevância: ${(r.score * 100).toFixed(0)}%)\n${r.content}`)
          .join("\n\n");

        const prompt = `Você é um tech lead criando um guia de onboarding para um novo engenheiro.

Tópico: "${topic}"

Contexto disponível:
${context}

Crie um learning path estruturado com:
1. Visão geral: o que é e por que importa
2. Conceitos fundamentais em ordem de aprendizado
3. Como começar com passos práticos
4. Armadilhas comuns
5. Recursos para aprofundamento

Use apenas o contexto disponível. Se houver lacunas, diga quais são. Seja conciso, progressivo e responda em ${config.outputLanguage}.`;

        const answer =
          (await llm.chat([{ role: "user", content: prompt }])) || "No onboarding generated.";

        return mcpSuccess(answer);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
