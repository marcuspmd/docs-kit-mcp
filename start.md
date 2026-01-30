# 📘 Documentation Agent MCP — Visão Completa

## 1. Visão de Produto

### 1.1 Problema que resolve

Desenvolvedores perdem tempo com documentação desatualizada, duplicada e divergente do código, o que gera bugs, retrabalho e medo de refatorar.
Arquitetos não conseguem garantir que padrões, camadas e linguagem ubíqua sejam respeitados ao longo do tempo, então a arquitetura “apodrece” silenciosamente.
Times de produto não têm rastreabilidade clara entre requisitos (tickets), código e docs, dificultando auditoria e confiança em mudanças críticas.

### 1.2 Proposta de valor

O **Documentation Agent MCP** é um sistema que transforma documentação em uma **camada viva de inteligência**, sempre alinhada ao código, que:

- Atualiza docs existentes com base em mudanças **semânticas** reais (não só diffs de texto).
- Prevê problemas antes de acontecerem, detectando violações de padrões, arquitetura, contratos de API e exemplos quebrados em docs.
- Ajuda devs a **entender, navegar e perguntar** sobre o sistema (RAG, Knowledge Graph, Onboarding Paths).
- Garante rastreabilidade entre requisitos de negócio, código e documentação (RTM, Business Context Mapper).

***

## 2. Visão de Negócio

### 2.1 Personas e dores

- Desenvolvedor de produto
    - Dor: escrever/atualizar doc é chato, gera duplicação, e ninguém confia que está correta.
    - Ganho: docs vivas, atualizadas por impacto de código, e exemplos verificáveis (“Executable Docs”).
- Tech Lead / Arquiteto
    - Dor: manter arquitetura (camadas, padrões, DDD) sob controle em times grandes, sem virar “polícia manual”.
    - Ganho: Arch Guard, Pattern Analyzer, DDD Enforcer, C4 diagrams, alertas automáticos em PR.
- Engenheiro de Qualidade / DevOps
    - Dor: não existe “gate” de documentação no CI, a doc sempre fica para depois.
    - Ganho: Doc-Guard em CI (build falha se mudança semântica não tiver doc atualizada), métricas de cobertura e drift.
- Produto / Compliance / Gestão
    - Dor: falta ligação clara entre tickets (Jira etc.), código e documentação, dificultando auditorias e decisões.
    - Ganho: RTM (Requirements Traceability Matrix), Business Translator, histórico de regras de negócio e APIs.


### 2.2 Jobs To Be Done (JTBD)

> “Como desenvolvedor, quero manter documentação técnica atualizada automaticamente com base em mudanças semânticas reais no código, incluindo diagramas Mermaid, identificação de padrões e fluxos de eventos, sem criar duplicatas, para reduzir manutenção manual e inconsistências em projetos complexos, suportando múltiplas linguagens.”

***

## 3. Visão de Sistema (Arquitetura Lógica)

### 3.1 Macro módulos

- Core de Análise
    - **Indexer (AST)**: extrai símbolos estruturais (classes, métodos, funções, entidades, eventos, listeners) em múltiplas linguagens usando tree-sitter.
    - **Change Analyzer**: combina diffs de Git e AST para detectar mudanças semânticas (assinatura, lógica, adição/remoção de símbolos).
- Camada de Conhecimento
    - **Knowledge Graph**: relaciona símbolos (calls, inherits, instantiates) para análises de impacto e fluxos.
    - **RAG / Vector DB**: indexa código + docs em embeddings para busca semântica e Q\&A conversacional.
- Camada de Documentação
    - **Doc Registry**: mapeia símbolos para arquivos `.md` via frontmatter (`symbols: [...]`).
    - **Doc Updater**: atualiza e remove seções específicas, sem criar docs novas nem mexer no resto.
    - **Executable Docs**: valida exemplos de código contidos nas docs contra o código real.
- Camada de Governança
    - **Pattern Analyzer + Violations**: detecção de padrões (Observer, Factory etc.) e violações (incluindo SOLID).
    - **Arch Guard**: aplica regras de arquitetura (camadas, imports proibidos, convenções de nomes).
    - **Doc-Guard (CI CLI)**: gate no CI que falha build se houver mudança com impacto em doc não tratada.
    - **Reaper**: identifica código morto, docs órfãs e links quebrados para limpeza proativa.
- Camada de Negócio
    - **Business Context Mapper**: liga commits, comentários e tags (`ref: PROJ-123`) a docs e símbolos.
    - **Requirements Traceability Matrix (RTM)**: monta matriz requisito → código → teste → doc.
    - **Business Translator**: gera descrição em linguagem de negócio a partir de código (if/else, regras).
- Camada de Interfaces
    - **MCP Server**: expõe ferramentas para Copilot / VS Code (generateDocs, explainSymbol, generateMermaid, analyzePatterns, generateEventFlow etc.).
    - **CLI (audit, impactAnalysis, createOnboarding)**: comandos para CI/CD e uso local.
    - **API Sync**: sincroniza especificações OpenAPI/Swagger e GraphQL com o código real.


### 3.2 Fluxos principais

#### 3.2.1 Atualização de Documentação (Core)

1. Dev altera código e abre PR.
2. Change Analyzer detecta símbolos impactados (assinatura, lógica, remoção/adição).
3. Para cada símbolo com `doc_update_required`:
    - Doc-Guard verifica se há doc vinculada (`findDocBySymbol`) e se foi tocada no PR.
    - MCP `generateDocs` dispara LLM com `updateSectionPrompt` para atualizar somente aquela seção.
4. Se símbolo foi removido, `removeSection` limpa a seção correspondente.
5. CI aprova somente se impactos em docs forem tratados (ou marcados como aceitos manualmente).

#### 3.2.2 Prevenção de Problemas (Arquitetura e Padrões)

1. A cada commit/PR, Arch Guard analisa AST e relações (imports, herança, dependências).
2. Violação detectada (ex.: Domain importando Infrastructure, Controller com lógica pesada) gera alerta e pode falhar o build.
3. Pattern Analyzer registra padrões e violações (Observer sem listeners, por exemplo) e gera relatórios ou comentários no PR.

#### 3.2.3 Descoberta e Onboarding

1. Dev pergunta: “onde é calculada regra X?” ou pede `createOnboarding --focus="Estoque"`.
2. RAG busca em código + docs e Knowledge Graph encontra o caminho (Controller → UseCase → Policy → Repo).
3. Sistema gera um “learning path” com explicações por etapa + diagramas Mermaid / C4.

***

## 4. Arquitetura Técnica

### 4.1 Estrutura de projeto

```txt
docs-agent/
├── package.json
├── mcp.json
├── tsconfig.json
├── jest.config.js
├── src/
│   ├── server.ts
│   ├── config.ts
│   ├── indexer/
│   │   ├── indexer.ts
│   │   └── symbol.types.ts
│   ├── analyzer/
│   │   ├── gitDiff.ts
│   │   ├── astDiff.ts
│   │   └── changeAnalyzer.ts
│   ├── patterns/
│   │   └── patternAnalyzer.ts
│   ├── events/
│   │   └── eventFlowAnalyzer.ts
│   ├── docs/
│   │   ├── docRegistry.ts
│   │   ├── docUpdater.ts
│   │   ├── frontmatter.ts
│   │   └── codeExampleValidator.ts   // novo
│   ├── knowledge/
│   │   ├── graph.ts
│   │   └── rag.ts
│   ├── governance/
│   │   ├── archGuard.ts
│   │   ├── docGuardCli.ts
│   │   └── reaper.ts
│   ├── business/
│   │   ├── contextMapper.ts
│   │   ├── rtm.ts
│   │   └── businessTranslator.ts
│   ├── prompts/
│   │   ├── updateSection.prompt.ts
│   │   ├── explainSymbol.prompt.ts
│   │   ├── generateMermaid.prompt.ts
│   │   ├── analyzePatterns.prompt.ts
│   │   └── generateEventFlow.prompt.ts
│   └── storage/
│       ├── index.db
│       ├── db.ts
│       └── schema.sql
├── docs/
│   └── domain/
│       └── estoque.md
├── tests/
│   ├── indexer.test.ts
│   ├── analyzer.test.ts
│   ├── docs.test.ts
│   └── governance.test.ts
└── README.md
```


### 4.2 MCP Server (resumo)

- Registra ferramentas:
    - `generateDocs` (pipeline de atualização de docs via AST diff).
    - `explainSymbol` (explicação direcionada de símbolo, código + doc).
    - `generateMermaid` (diagramas de estrutura, fluxos, eventos).
    - `analyzePatterns` e `generateEventFlow` (arquitetura e eventos).
    - Futuro: `impactAnalysis`, `createOnboarding`, `askKnowledgeBase`.

Config MCP:

```json
{
  "name": "docs-agent",
  "description": "Agente MCP para documentação inteligente baseada em mudanças reais",
  "command": "node",
  "args": ["dist/server.js"],
  "env": {
    "NODE_ENV": "production"
  }
}
```


### 4.3 Modelo de dados central

```ts
export type SymbolKind =
  | "class"
  | "method"
  | "function"
  | "interface"
  | "dto"
  | "entity"
  | "event"
  | "listener";

export interface CodeSymbol {
  id: string;
  name: string;
  kind: SymbolKind;
  file: string;
  startLine: number;
  endLine: number;
  parent?: string;
  docRef?: string;
  lastModified?: Date;
  pattern?: string;
  violations?: string[];
}
```

Relações (Knowledge Graph):

```sql
CREATE TABLE relationships (
    source_id TEXT,
    target_id TEXT,
    type TEXT, -- 'calls', 'inherits', 'implements', 'instantiates'
    PRIMARY KEY (source_id, target_id)
);
```


***

## 5. Funcionalidades e Roadmap

### 5.1 Story Mapping (resumido)

| Atividade | MVP | Release 1 | Release 2 |
| :-- | :-- | :-- | :-- |
| Indexação de Código | Indexar símbolos via AST | Suporte a múltiplas linguagens | Cache com embeddings (RAG) |
| Detecção de Mudanças | Git diff + AST diff | Mudanças lógicas profundas | Integração com testes |
| Atualização de Docs | Atualizar seções existentes | Remover seções obsoletas | Sugerir novas seções via LLM |
| Diagramas | Mermaid básico | Diagramas avançados (fluxos, classes, eventos) | C4/Arquitetura navegável |
| Padrões | Detectar padrões básicos | Detectar violações (SOLID, etc.) | Relatórios e Arch Guard no CI |
| Fluxos de Eventos | Gráficos simples | Análise de listeners/handlers | Simulação de fluxos |
| Integração MCP | Ferramentas básicas via VS Code | Comandos avançados (impactAnalysis, onboarding) | Extensão auto-instalável |
| Segurança e Métricas | – | Autenticação básica | Métricas de cobertura e precisão |
| Governança \& Negócio | Doc-Guard CLI | RTM, Context Mapper | Business Translator, Narrator |



### 5.2 Priorização (RICE, resumo)

- Criticamente alta:
    - Atualização de docs existentes por impacto semântico.
    - Doc-Guard (CI CLI) para impedir drift de doc.
- Alta:
    - Indexação AST multi-linguagem, Integração MCP, Padrões básicos e violações principais.
- Média/Avançada:
    - RAG, Knowledge Graph, Onboarding Paths, API Sync, DDD Enforcer, Reaper.

***

## 6. UX Funcional — Exemplos de Uso

### 6.1 VS Code / Copilot (MCP)

- `@docs-agent generateDocs`
Atualiza automaticamente docs ligadas a símbolos afetados no último diff.
- `@docs-agent explainSymbol symbol=RecalcularMovimentacoesStep.convertOpMovements`
Gera explicação em português combinando código + doc existente.
- `@docs-agent generateMermaid symbols=ClassA,ClassB type=classDiagram`
Cria diagrama para ilustrar relações chave.
- Futuro:
    - `@docs-agent impactAnalysis symbol=ProductService` (quem quebra se eu mudar X?).
    - `@docs-agent createOnboarding --focus="Estoque"`.
    - `@docs-agent askKnowledgeBase "como é calculada a taxa de juros?"`.


### 6.2 CI/CD (prevenção de problemas)

- Job `audit-docs` roda `docGuardCli`:
    - Se `ChangeImpact` marca `doc_update_required` e a doc correspondente não foi alterada no PR, build falha com mensagem clara.
    - Se Arch Guard detecta import proibido ou violação DDD, build falha com descrição da regra violada.

***

## 7. Riscos e Mitigações (resumo)

| Risco | Prob. | Impacto | Mitigação |
| :-- | :-- | :-- | :-- |
| Falsos positivos em mudanças | Alta | Médio | Refinar AST diff, permitir override manual |
| Dependência de LLM | Média | Alto | Prompts controlados, fallback conservador |
| Compatibilidade multi-linguagem | Média | Médio | Testes extensivos com tree-sitter |
| Detecção incorreta de padrões | Média | Médio | Heurísticas + confirmação manual |
| Over-automation mexendo demais em doc | Média | Alto | “Dry-run” e PR automático, não commit direto |

---

## 📋 Plano Detalhado para Criar PRD Abrangente

### 1. 🔍 Entendimento Aprofundado
- **Reformulação do Objetivo**: Criar um PRD completo e acionável para o Documentation Agent MCP, baseado no resumo da conversa, que inclui arquitetura, funcionalidades, priorização e roadmap.
- **Premissas Implícitas**: O PRD deve cobrir JTBD, story mapping, RICE, user stories, riscos, cronograma e tabelas; assumir suporte a múltiplas linguagens e integração com LLM; focar em evitar duplicação de docs e atualização semântica.
- **Ambiguidades**: Confirmar provedor LLM e restrições de segurança; esclarecer se o PRD deve ser expandido para incluir protótipos ou apenas planejamento.
- **Perguntas para Esclarecimento**: Qual o escopo exato do PRD (ex.: incluir wireframes ou apenas texto)? Há restrições de tempo ou orçamento?

### 2. 🧩 Decomposição em Sub-tarefas
- [ ] **Sub-tarefa 1: Revisar e Consolidar Informações Existentes** - [complexidade: baixa] - Analisar o resumo da conversa e o PRD atual em start.md para identificar lacunas.
- [ ] **Sub-tarefa 2: Definir Estrutura do PRD** - [complexidade: média] - Usar frameworks como JTBD, RICE, Gherkin para organizar seções.
- [ ] **Sub-tarefa 3: Expandir JTBD e User Stories** - [complexidade: média] - Detalhar jobs-to-be-done e cenários baseados nas funcionalidades (padrões, eventos, Mermaid).
- [ ] **Sub-tarefa 4: Priorizar com RICE e Story Mapping** - [complexidade: alta] - Calcular scores e mapear releases, incluindo novas funcionalidades.
- [ ] **Sub-tarefa 5: Identificar Riscos e Mitigações** - [complexidade: baixa] - Atualizar tabela de riscos com itens como falsos positivos em padrões.
- [ ] **Sub-tarefa 6: Criar Cronograma e Roadmap** - [complexidade: média] - Estimar durações e dependências para MVP, Release 1, Release 2.
- [ ] **Sub-tarefa 7: Adicionar Tabelas e Métricas** - [complexidade: baixa] - Incluir tabelas de funcionalidades, riscos, cronograma.
- [ ] **Sub-tarefa 8: Validar e Refinar** - [complexidade: média] - Revisar por consistência, acionabilidade e alinhamento com objetivos.

### 3. 📊 Análise de Dependências
- **Dependências entre Sub-tarefas**: Sub-tarefa 1 deve preceder todas; Sub-tarefa 2 antes de 3-7; Sub-tarefa 8 no final.
- **Caminho Crítico**: Revisão → Estrutura → Expansão → Priorização → Validação.
- **Ordem Otimizada**: Sequencial, começando pela revisão para evitar retrabalho.

### 4. 💡 Sugestões de Melhoria
- **O que poderia ser diferente/melhor**: Incluir protótipos de código ou wireframes para maior clareza; adicionar seção de métricas de sucesso (ex.: redução de tempo em docs).
- **Padrões Recomendados**: Usar Gherkin para user stories; RICE para priorização; RAID para riscos.
- **Riscos Comuns a Evitar**: Sobrecarga de detalhes (manter focado); assumir sem validar premissas.
- **Oportunidades**: Integrar com ferramentas como Jira ou Miro para visualização; automatizar geração de PRD via templates.

### 5. 🛠️ Plano de Implementação
#### Sub-tarefa 1: Revisar e Consolidar Informações Existentes
- **Abordagem Técnica**: Ler start.md e resumo da conversa; extrair pontos-chave (funcionalidades, arquitetura, PRD atual).
- **Arquivos/Componentes Afetados**: start.md.
- **Testes Necessários**: N/A (análise manual).
- **Critérios de Aceite**: Lista de lacunas identificadas (ex.: falta de wireframes).
- **Pontos de Atenção**: Garantir que todas as funcionalidades do resumo estejam cobertas.

#### Sub-tarefa 2: Definir Estrutura do PRD
- **Abordagem Técnica**: Criar template baseado em frameworks (JTBD, Story Mapping, etc.).
- **Arquivos/Componentes Afetados**: Adicionar seção em start.md.
- **Testes Necessários**: Revisão por pares.
- **Critérios de Aceite**: Estrutura clara e completa.
- **Pontos de Atenção**: Alinhar com melhores práticas de PRD.

#### Sub-tarefa 3: Expandir JTBD e User Stories
- **Abordagem Técnica**: Escrever JTBD em português; user stories em Gherkin.
- **Arquivos/Componentes Afetados**: start.md.
- **Testes Necessários**: Validação de cenários.
- **Critérios de Aceite**: Pelo menos 8 user stories cobrindo funcionalidades principais.
- **Pontos de Atenção**: Focar em valor para o usuário.

#### Sub-tarefa 4: Priorizar com RICE e Story Mapping
- **Abordagem Técnica**: Calcular RICE scores; mapear atividades por releases.
- **Arquivos/Componentes Afetados**: start.md.
- **Testes Necessários**: Verificar cálculos.
- **Critérios de Aceite**: Tabela RICE com scores; mapa de releases.
- **Pontos de Atenção**: Usar dados realistas para estimativas.

#### Sub-tarefa 5: Identificar Riscos e Mitigações
- **Abordagem Técnica**: Listar riscos com probabilidade/impacto; sugerir mitigações.
- **Arquivos/Componentes Afetados**: start.md.
- **Testes Necessários**: N/A.
- **Critérios de Aceite**: Tabela RAID completa.
- **Pontos de Atenção**: Incluir riscos técnicos (ex.: compatibilidade linguagens).

#### Sub-tarefa 6: Criar Cronograma e Roadmap
- **Abordagem Técnica**: Estimar durações em dias; definir dependências.
- **Arquivos/Componentes Afetados**: start.md.
- **Testes Necessários**: Simulação de timeline.
- **Critérios de Aceite**: Cronograma viável.
- **Pontos de Atenção**: Considerar equipe e recursos.

#### Sub-tarefa 7: Adicionar Tabelas e Métricas
- **Abordagem Técnica**: Criar tabelas Markdown.
- **Arquivos/Componentes Afetados**: start.md.
- **Testes Necessários**: Verificar formatação.
- **Critérios de Aceite**: Tabelas legíveis e completas.
- **Pontos de Atenção**: Usar Markdown puro.

#### Sub-tarefa 8: Validar e Refinar
- **Abordagem Técnica**: Revisão interna; feedback simulado.
- **Arquivos/Componentes Afetados**: start.md.
- **Testes Necessários**: Checklist de qualidade.
- **Critérios de Aceite**: PRD aprovado e acionável.
- **Pontos de Atenção**: Garantir alinhamento com objetivos iniciais.

### 6. ✅ Checklist de Validação Final
- [ ] PRD cobre todas as funcionalidades do resumo?
- [ ] Estrutura segue frameworks padrão?
- [ ] Estimativas são realistas?
- [ ] Riscos estão mitigados?
- [ ] Documento é acionável para desenvolvimento?

### 7. 🎯 Resumo Executivo
Este plano cria um PRD abrangente para o Documentation Agent MCP, expandindo o existente com detalhes acionáveis, priorização e roadmap. Foca em decomposição sequencial, mitigação de riscos e alinhamento com melhores práticas, resultando em um documento pronto para guiar implementação e stakeholders.


