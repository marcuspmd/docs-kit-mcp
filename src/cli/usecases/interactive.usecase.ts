import "reflect-metadata";
import path from "node:path";
import * as p from "@clack/prompts";
import { colors } from "../utils/colors.js";
import { listBranches, getCurrentBranch, formatBranchAge } from "../utils/gitBranches.js";
import { diffUseCase } from "./diff.usecase.js";
import type { DiffUseCaseResult } from "./diff.usecase.js";
import { checkUseCase } from "./check.usecase.js";
import { openSiteUseCase } from "./openSite.usecase.js";
import { serveSite } from "./openSite.usecase.js";
import { projectTreeUseCase } from "./projectTree.usecase.js";

export async function interactiveUseCase(): Promise<void> {
  p.intro(colors.bold("docs-kit"));

  const action = await p.select({
    message: "O que deseja fazer?",
    options: [
      { value: "diff", label: "Diff review", hint: "comparar branches e ver o que mudou" },
      { value: "coverage", label: "Coverage check", hint: "símbolos com cobertura baixa" },
      { value: "arch", label: "Architecture check", hint: "violações de regras de arquitetura" },
      { value: "health", label: "Full health check", hint: "cobertura + arquitetura + docs" },
      { value: "site", label: "Open site", hint: "gerar e servir o docs site localmente" },
      {
        value: "project-tree",
        label: "Project tree",
        hint: "gerar STRUCTURE.md para contexto de LLMs",
      },
      { value: "exit", label: "Sair" },
    ],
  });

  if (p.isCancel(action) || action === "exit") {
    p.outro("Até mais.");
    return;
  }

  try {
    if (action === "diff") {
      await interactiveDiff({ flags: {} });
    } else if (action === "coverage") {
      p.outro("");
      await checkUseCase({ checks: ["coverage"] });
    } else if (action === "arch") {
      p.outro("");
      await checkUseCase({ checks: ["architecture"] });
    } else if (action === "health") {
      p.outro("");
      await checkUseCase({ checks: ["coverage", "architecture", "documentation"] });
    } else if (action === "site") {
      p.outro("Abrindo site...");
      await openSiteUseCase({});
    } else if (action === "project-tree") {
      await interactiveProjectTree();
    }
  } catch (err) {
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

async function interactiveProjectTree(): Promise<void> {
  const rootDir = await p.text({
    message: "Diretório raiz para mapear:",
    defaultValue: ".",
    validate: (value) => (!value?.trim() ? "Informe um diretório." : undefined),
  });
  if (p.isCancel(rootDir)) {
    p.cancel("Cancelado.");
    return;
  }

  const outFile = await p.text({
    message: "Arquivo Markdown de saída:",
    defaultValue: "STRUCTURE.md",
    validate: (value) => (!value?.trim() ? "Informe um arquivo de saída." : undefined),
  });
  if (p.isCancel(outFile)) {
    p.cancel("Cancelado.");
    return;
  }

  const depthInput = await p.text({
    message: "Profundidade máxima da árvore:",
    defaultValue: "4",
    validate: (value) => {
      const parsed = parseInt(value ?? "", 10);
      return Number.isNaN(parsed) || parsed < 0
        ? "Informe um número maior ou igual a zero."
        : undefined;
    },
  });
  if (p.isCancel(depthInput)) {
    p.cancel("Cancelado.");
    return;
  }

  const dirsOnly = await p.confirm({
    message: "Mostrar apenas diretórios?",
    initialValue: false,
  });
  if (p.isCancel(dirsOnly)) {
    p.cancel("Cancelado.");
    return;
  }

  const sourceOnly = await p.confirm({
    message: "Usar apenas os includes de código-fonte do docs.config.js?",
    initialValue: false,
  });
  if (p.isCancel(sourceOnly)) {
    p.cancel("Cancelado.");
    return;
  }

  p.outro("");
  const depth = parseInt(depthInput, 10);
  await projectTreeUseCase({
    rootDir: rootDir.trim(),
    outFile: outFile.trim(),
    depth: Number.isNaN(depth) ? 4 : depth,
    dirsOnly,
    sourceOnly,
  });
}

export async function interactiveDiff(opts: { flags: Record<string, string> }): Promise<void> {
  const cwd = process.cwd();

  const spin = p.spinner();
  spin.start("Buscando branches...");
  const [branches, current] = await Promise.all([listBranches(cwd), getCurrentBranch(cwd)]);
  spin.stop(`Branch atual: ${colors.bold(current)}`);

  if (branches.length === 0) {
    p.log.warn("Nenhuma branch encontrada. Certifique-se de estar em um repositório git.");
    return;
  }

  const branchOptions = [
    ...branches
      .filter((b) => !b.isCurrent)
      .map((b) => ({
        value: b.name,
        label: colors.bold(b.name),
        hint: `${colors.dim(formatBranchAge(b.committerDate))} ${colors.dim(b.subject)}`,
      })),
    { value: "__manual__", label: colors.dim("[digitar manualmente...]"), hint: "" },
  ];

  const selectedBranch = await p.select({
    message: "Selecione a branch base para comparar:",
    options: branchOptions,
  });

  if (p.isCancel(selectedBranch)) {
    p.cancel("Cancelado.");
    return;
  }

  let base = selectedBranch as string;
  if (base === "__manual__") {
    const manual = await p.text({
      message: "Digite a branch/ref base:",
      validate: (v) => (!v?.trim() ? "Informe uma branch ou ref." : undefined),
    });
    if (p.isCancel(manual)) {
      p.cancel("Cancelado.");
      return;
    }
    base = manual as string;
  }

  const openSite = await p.confirm({ message: "Abrir no browser após o diff?" });
  if (p.isCancel(openSite)) {
    p.cancel("Cancelado.");
    return;
  }

  let port = 3001;
  if (openSite) {
    const portInput = await p.text({
      message: "Porta para o diff site:",
      defaultValue: opts.flags.port ?? "3001",
      validate: (v) => {
        const n = parseInt(v ?? "", 10);
        return isNaN(n) || n < 1 || n > 65535 ? "Porta inválida." : undefined;
      },
    });
    if (p.isCancel(portInput)) {
      p.cancel("Cancelado.");
      return;
    }
    port = parseInt(portInput as string, 10) || 3001;
  }

  const diffSpin = p.spinner();
  diffSpin.start(`Analisando diff ${colors.bold(base)}...HEAD`);

  let result: DiffUseCaseResult;
  try {
    result = await diffUseCase({
      base,
      head: opts.flags.head || undefined,
      outDir: opts.flags.out || "docs-site-diff",
      dbPath: opts.flags.db || undefined,
      docsDir: opts.flags.docs || "docs",
      rootDir: opts.flags.root || undefined,
      strict: opts.flags.strict === "true",
      aiReview: opts.flags["ai-review"] === "true",
    });
    diffSpin.stop("Análise concluída.");
  } catch (err) {
    diffSpin.stop("Falha na análise.");
    p.log.error(err instanceof Error ? err.message : String(err));
    return;
  }

  if (openSite) {
    const outDir = opts.flags.out || "docs-site-diff";
    await serveSite(outDir, port);
    const url = `http://localhost:${port}`;
    p.outro(`Site rodando em ${colors.info(url)}  (Ctrl+C para parar)`);
    const { exec } = await import("child_process");
    const opener =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${opener} ${url}`);
    process.on("SIGINT", () => process.exit(0));
    process.on("SIGTERM", () => process.exit(0));
    await new Promise(() => {});
  } else {
    renderTerminalDiff(result, base);
  }
}

function renderTerminalDiff(result: DiffUseCaseResult, base: string): void {
  const { changedFiles, impacts, docGuard, review, outDir } = result;
  const line = "═".repeat(50);

  console.log(`\n${colors.bold(line)}`);
  console.log(
    `  ${colors.bold(`Diff: ${base}...HEAD  (${changedFiles.length} arquivo(s), ${impacts.length} símbolo(s))`)}`,
  );
  console.log(`${colors.bold(line)}\n`);

  if (changedFiles.length > 0) {
    console.log(`  ${colors.bold("Arquivos alterados")}`);
    console.log(`  ${"─".repeat(46)}`);
    for (const f of changedFiles) {
      const status = colors.modified("M");
      const name = path.relative(process.cwd(), f.startsWith("/") ? f : path.resolve(f));
      console.log(`  ${status}  ${name}`);
    }
    console.log("");
  }

  if (impacts.length > 0) {
    console.log(`  ${colors.bold("Mudanças de símbolos")}`);
    console.log(`  ${"─".repeat(46)}`);
    for (const impact of impacts) {
      let marker: string;
      let label: string;
      switch (impact.changeType) {
        case "added":
          marker = colors.added("+");
          label = colors.added("adicionado");
          break;
        case "removed":
          marker = colors.removed("-");
          label = colors.removed("removido");
          break;
        default:
          marker = colors.modified("~");
          label = colors.modified(impact.changeType.replace("_", " "));
      }
      const file = colors.dim(path.basename(impact.symbol.file ?? ""));
      const name = impact.symbol.name.padEnd(28);
      console.log(`  ${marker}  ${name} ${file}  ${colors.dim(`(${label})`)}`);
    }
    console.log("");
  }

  const guardStatus = docGuard.passed
    ? `${colors.tick()} ${colors.ok("PASSED")}`
    : `${colors.cross()} ${colors.error("FAILED")}`;
  console.log(`  Docs-Guard: ${guardStatus}`);
  if (!docGuard.passed) {
    for (const v of docGuard.uncoveredChanges) {
      console.log(`    ${colors.dim(v.symbolName)} — ${v.reason}`);
    }
  }
  console.log("");

  if (review.status !== "not_requested") {
    console.log(`  AI Review: ${colors.dim(review.status)}`);
    if (review.summary) {
      const lines = review.summary.split("\n").slice(0, 5);
      for (const line of lines) {
        console.log(`    ${colors.dim(line)}`);
      }
    }
    console.log("");
  }

  const absOut = path.resolve(outDir);
  console.log(`  ${colors.dim(`Site gerado em: ${absOut}/index.html`)}\n`);
}
