# Task: TASK-001
## Branch: feat/TASK-001

**Description:**
Integrate LLM for intelligent doc generation: Update prompts in `src/prompts/` (ex.: `updateSection.prompt.ts`) to call a provider like OpenAI/Anthropic; implement fallback conservador para evitar over-automation; test com exemplos de atualização de seções em docs existentes.

**Metadata:**
- **Priority:** High
- **Status:** Done
- **Start Date:** 2026-01-31
- **End Date:** 2026-01-31
- **Due Date:** 2026-02-07

**To Do:**
  - [x] 1. Configurar integração com LLM provider (OpenAI) 🔴
  > Instalar dependências e configurar API key.
  >
  > - [x] 1.1 Instalar openai library
  > - [x] 1.2 Configurar variáveis de ambiente para API key
  >> [!TIP]
  >> Use dotenv para gerenciar secrets.
  >
  >> [!WARNING]
  >> Nunca commite API keys no código.

  ---

  - [x] 2. Atualizar prompts para usar LLM 🟡
  > Modificar arquivos em src/prompts/ para fazer chamadas reais ao LLM.
  >> [!NOTE]
  >> Manter fallback para templates se LLM falhar.

  ---

  - [x] 3. Implementar fallback conservador 🟢
  > Garantir que se LLM não responder, use templates existentes.
  >
  >> [!IMPORTANT]
  >> Testar cenários de falha de rede/API.

  ---

  - [x] 4. Testar com exemplos reais 🟡
  > Executar testes com mudanças em docs e verificar atualizações inteligentes.
  >> [!TIP]
  >> Usar docs existentes para validar.
  ---</content>
<parameter name="filePath">/Users/marcusp/Documents/docs-kit/tasks/TASK-001.md