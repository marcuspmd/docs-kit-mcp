import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";

// Import all tool registration functions
import { registerGenerateDocsTool } from "./generateDocs.tool.js";
import { registerExplainSymbolTool, registerUpdateSymbolExplanationTool } from "./explainSymbol.tool.js";
import { registerGenerateMermaidTool } from "./generateMermaid.tool.js";
import { registerScanFileTool } from "./scanFile.tool.js";
import { registerImpactAnalysisTool } from "./impactAnalysis.tool.js";
import { registerAnalyzePatternsTool } from "./analyzePatterns.tool.js";
import { registerGenerateEventFlowTool } from "./generateEventFlow.tool.js";
import { registerCreateOnboardingTool } from "./createOnboarding.tool.js";
import { registerAskKnowledgeBaseTool } from "./askKnowledgeBase.tool.js";
import { registerScanForDeadCodeTool } from "./scanForDeadCode.tool.js";
import { registerBuildTraceabilityMatrixTool } from "./buildTraceabilityMatrix.tool.js";
import { registerDescribeInBusinessTermsTool } from "./describeInBusinessTerms.tool.js";
import { registerValidateExamplesTool } from "./validateExamples.tool.js";
import { registerSmartCodeReviewTool } from "./smartCodeReview.tool.js";
import { registerProjectStatusTool } from "./projectStatus.tool.js";
import { registerGetRelevantContextTool } from "./getRelevantContext.tool.js";

/**
 * Register all MCP tools with the server
 */
export function registerAllTools(server: McpServer, deps: ServerDependencies): void {
  // Documentation tools
  registerGenerateDocsTool(server, deps);
  registerScanFileTool(server, deps);
  registerValidateExamplesTool(server, deps);

  // Symbol tools
  registerExplainSymbolTool(server, deps);
  registerUpdateSymbolExplanationTool(server, deps);
  registerDescribeInBusinessTermsTool(server, deps);
  registerGetRelevantContextTool(server, deps);

  // Analysis tools
  registerImpactAnalysisTool(server, deps);
  registerAnalyzePatternsTool(server, deps);
  registerSmartCodeReviewTool(server, deps);

  // Visualization tools
  registerGenerateMermaidTool(server, deps);
  registerGenerateEventFlowTool(server, deps);

  // Knowledge tools
  registerCreateOnboardingTool(server, deps);
  registerAskKnowledgeBaseTool(server, deps);

  // Governance tools
  registerScanForDeadCodeTool(server, deps);
  registerBuildTraceabilityMatrixTool(server, deps);
  registerProjectStatusTool(server, deps);
}

// Re-export all tool schemas for reference
export { generateDocsSchema } from "./generateDocs.tool.js";
export { explainSymbolSchema, updateSymbolExplanationSchema } from "./explainSymbol.tool.js";
export { generateMermaidSchema } from "./generateMermaid.tool.js";
export { scanFileSchema } from "./scanFile.tool.js";
export { impactAnalysisSchema } from "./impactAnalysis.tool.js";
export { createOnboardingSchema } from "./createOnboarding.tool.js";
export { askKnowledgeBaseSchema } from "./askKnowledgeBase.tool.js";
export { scanForDeadCodeSchema } from "./scanForDeadCode.tool.js";
export { buildTraceabilityMatrixSchema } from "./buildTraceabilityMatrix.tool.js";
export { describeInBusinessTermsSchema } from "./describeInBusinessTerms.tool.js";
export { validateExamplesSchema } from "./validateExamples.tool.js";
export { smartCodeReviewSchema } from "./smartCodeReview.tool.js";
export { projectStatusSchema } from "./projectStatus.tool.js";
export { getRelevantContextSchema } from "./getRelevantContext.tool.js";
