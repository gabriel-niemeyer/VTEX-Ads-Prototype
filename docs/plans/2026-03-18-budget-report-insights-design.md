# Budget Report Insights Design

**Contexto:** adicionar um botão de "gerar insights" no header do `BudgetReportModal`, representado apenas por um ícone de busca, que abre uma sidebar à direita dentro do body do modal.

**Objetivo:** oferecer recomendações acionáveis para otimização de orçamento e resultados da campanha sem quebrar a linguagem visual atual do projeto.

## Decisão de UX

- O botão de insights fica no header do modal, ao lado do botão de fechar.
- O botão usa apenas o ícone `search`, com estados visualmente consistentes com os demais controles do projeto.
- Ao clicar, a sidebar abre no lado direito do body do modal.
- A sidebar empurra o conteúdo principal para a esquerda em vez de sobrepor os gráficos.
- O header permanece intacto; a mudança ocorre apenas na área de conteúdo.

## Conteúdo dos Insights

- Os insights seguem abordagem híbrida:
- Regras calculadas a partir dos dados já disponíveis no modal.
- Templates curtos de texto para transformar métricas em oportunidades claras.
- Fallback de "objetivo da campanha" inferido pelos `mediaTypes`, já que o tipo `Campaign` compartilhado com o modal não expõe um campo explícito de objetivo.

## Estrutura da Sidebar

- Cabeçalho com título curto e texto de apoio.
- Lista vertical de cards.
- Cada card contém:
- categoria
- título
- contexto/resumo
- recomendação prática

## Linguagem Visual

- Fundo branco e bordas `#e0e0e0`.
- Cards com cantos arredondados, sombra discreta e estados suaves de hover.
- Tipografia alinhada aos demais cards do relatório.
- Uso das mesmas cores semânticas do modal para estados como abaixo do ritmo, no ritmo e acima.

## Dados-base para insights

- `consumptionDay`, `consumptionWeek`, `consumptionTotal`
- `expectedDay`, `expectedWeek`, `expectedTotalToDate`
- `forecastTotal`
- `projectedHitHour`
- `campaign.impressionShare`
- `campaign.bidStrength`
- `campaign.revenue`, `campaign.clicks`, `campaign.conversions`, `campaign.spend`

## Comportamento

- Sidebar fecha ao clicar novamente no botão.
- Conteúdo principal continua scrollável.
- Sidebar possui scroll próprio se necessário.
- Sem dependência de IA externa; insights são determinísticos e rápidos.
