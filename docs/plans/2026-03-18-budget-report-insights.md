# Budget Report Insights Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar um botão de insights no header do relatório de orçamento e uma sidebar lateral que exibe recomendações acionáveis sem sobrepor o conteúdo principal.

**Architecture:** A implementação fica concentrada em `components/BudgetReportModal.tsx`. O modal passa a ter uma área de body em duas colunas quando os insights estiverem abertos: conteúdo principal à esquerda e sidebar à direita. Os insights são gerados por regras locais usando as métricas já calculadas no componente e templates textuais por cenário.

**Tech Stack:** React, TypeScript, Tailwind utility classes, Chart.js já existente no modal

---

### Task 1: Estruturar o estado e o layout do modal

**Files:**
- Modify: `components/BudgetReportModal.tsx`

**Step 1: Adicionar o estado de abertura do painel**

- Criar `isInsightsOpen` no componente.

**Step 2: Atualizar o header**

- Inserir botão ícone `search` antes do botão de fechar.
- Garantir estado visual ativo/inativo.

**Step 3: Reestruturar o body**

- Separar a área scrollável principal da sidebar.
- Fazer a sidebar empurrar o conteúdo usando layout em duas colunas.

**Step 4: Verificar o comportamento**

- Confirmar que o conteúdo principal continua scrollável e o header permanece estável.

### Task 2: Gerar os insights híbridos

**Files:**
- Modify: `components/BudgetReportModal.tsx`

**Step 1: Criar helpers**

- Inferir objetivo a partir de `campaign.mediaTypes`.
- Criar helper de formatação e classes semânticas.

**Step 2: Criar lista de insights**

- Usar pacing diário, semanal e total.
- Usar previsão total, impression share, bid strength e métricas básicas.

**Step 3: Limitar e ordenar**

- Priorizar insights mais acionáveis.
- Renderizar 4 a 6 cards úteis.

### Task 3: Refinar a UI da sidebar

**Files:**
- Modify: `components/BudgetReportModal.tsx`

**Step 1: Criar header da sidebar**

- Título e microcopy curta.

**Step 2: Criar cards**

- Categoria, título, descrição e recomendação.
- Visual consistente com o restante da interface.

**Step 3: Ajustar responsividade**

- Garantir boa leitura dentro da largura do modal.

### Task 4: Verificação

**Files:**
- Modify: `components/BudgetReportModal.tsx`

**Step 1: Rodar lint/diagnostics**

Run: verificar lints do arquivo editado  
Expected: sem erros novos

**Step 2: Revisão visual**

- Confirmar que a sidebar abre à direita.
- Confirmar que o body principal é empurrado para a esquerda.
- Confirmar que o botão usa apenas ícone de busca.
