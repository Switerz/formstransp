---
name: Report Diario do Transportador
description: Diario de bordo operacional para acompanhar SLA, pendencias e reports diarios de transportadoras.
colors:
  navy: "#0f2742"
  blue: "#2563eb"
  green: "#16a34a"
  orange: "#f59e0b"
  red: "#dc2626"
  gray: "#64748b"
  line: "#d8dee8"
  bg: "#f4f7fb"
  text: "#172033"
  report-muted: "#b8c7d9"
  surface: "#ffffff"
  table-header: "#eef4fb"
  empty-bg: "#f8fbff"
typography:
  display:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0"
  headline:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
  title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
rounded:
  md: "8px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "38px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.navy}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "38px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
    height: "40px"
  pill-status:
    backgroundColor: "#e2e8f0"
    textColor: "{colors.navy}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: Report Diario do Transportador

## 1. Overview

**Creative North Star: "Torre de Controle Operacional"**

Este sistema visual existe para uma rotina de decisao: abrir, conferir, identificar pendencias e agir. A interface deve parecer uma torre de controle de operacao logistica, com informacao densa, status legiveis e superficies quietas que deixam os indicadores trabalharem.

O produto deve preservar a personalidade definida em `PRODUCT.md`: executivo, confiavel e operacional. Isso significa que o visual pode ser apresentavel em reuniao, mas nunca deve virar site marketing, dashboard decorativo ou tela de BI generica. A confianca vem de consistencia, hierarquia clara e componentes previsiveis.

**Key Characteristics:**
- Superficie clara, fria e operacional, sem atmosfera promocional.
- Azul escuro como eixo de autoridade e navegacao.
- Cores semanticas usadas para estado e leitura de risco, nao para enfeite.
- Cards compactos, tabelas legiveis e botoes padronizados.
- Movimento restrito a feedback e carregamento.

## 2. Colors

A paleta e restrita: azul escuro para comando, azul vivo para acao e cores semanticas para leitura operacional.

### Primary
- **Azul Controle**: token `navy`. Usado em navegacao, headers de report, texto de alta hierarquia e botoes primarios. E a cor de autoridade do produto.
- **Azul Acao**: token `blue`. Usado para indicadores principais, destaques de SLA e acentos de acao quando o azul controle seria pesado demais.

### Secondary
- **Verde SLA**: token `green`. Usado para sucesso, report recebido, entregue e indicadores saudaveis.
- **Ambar Atencao**: token `orange`. Usado para pendencias, campos que exigem revisao e alertas operacionais.
- **Vermelho Incidencia**: token `red`. Usado para devolucao, erro e problema real. Nao usar como decoracao.

### Neutral
- **Fundo Operacional**: token `bg`. Fundo geral frio e claro que separa as telas de uma planilha branca.
- **Superficie Branca**: token `surface`. Base de cards, formularios e tabelas.
- **Texto Primario**: token `text`. Corpo e dados principais.
- **Texto Secundario**: token `gray`. Metadados, labels auxiliares e descricoes curtas.
- **Texto Suave em Header**: token `report-muted`. Subtitulo dentro do header escuro do report.
- **Linha Estrutural**: token `line`. Bordas, divisores e separacao de tabela.
- **Cabecalho de Tabela**: token `table-header`. Fundo de `th` para ancorar leitura horizontal.

### Named Rules

**The Semantic Color Rule.** Verde, ambar e vermelho sao estados. Se a cor nao ajuda a decidir, nao use.

**The Navy Authority Rule.** O azul controle deve concentrar navegacao, hierarquia e comando. Nao diluir a identidade com muitos azuis concorrentes.

## 3. Typography

**Display Font:** Arial, Helvetica, sans-serif
**Body Font:** Arial, Helvetica, sans-serif
**Label/Mono Font:** Nao ha fonte mono dedicada.

**Character:** Uma familia sans unica, familiar e utilitaria. O produto nao precisa de contraste editorial; precisa de leitura rapida, numeros claros e labels previsiveis.

### Hierarchy
- **Display** (800, 30px, 1.2): Numeros principais dos cards e KPIs.
- **Headline** (700, 24px, 1.25): Titulos de pagina e report.
- **Title** (700, 18px, 1.3): Titulos de secao e cards de tabela.
- **Body** (400, 14px, 1.45): Texto de tabela, descricoes, conteudo de formulario e mensagens.
- **Label** (700, 13px, 1.25): Labels de formulario, nomes de metrica e metadados compactos.

### Named Rules

**The Data First Type Rule.** Numeros podem ser fortes; labels devem ser menores e estaveis. Nunca usar fonte display ou tipografia ornamental em UI, tabela, botao ou formulario.

## 4. Elevation

O sistema usa camadas discretas, quase planas. A separacao vem primeiro de fundo, borda e espaco; a sombra e apenas uma pista baixa de superficie. Cards usam `0 1px 3px rgba(15, 39, 66, 0.06)`, suficiente para separar sem parecer dashboard promocional.

### Shadow Vocabulary
- **Surface Low** (`box-shadow: 0 1px 3px rgba(15, 39, 66, 0.06)`): cards, paineis e blocos de formulario.
- **No Shadow** (`box-shadow: none`): impressao/PDF e tabelas internas.

### Named Rules

**The Almost Flat Rule.** Se a sombra for percebida antes do conteudo, ela esta errada. Use sombra baixa ou nenhuma sombra.

## 5. Components

### Buttons

- **Shape:** canto contido (8px), nunca arredondamento excessivo.
- **Primary:** fundo Azul Controle, texto branco, altura minima de 38px, padding horizontal curto para densidade operacional.
- **Hover / Focus:** deve manter o mesmo vocabulario; foco visivel e obrigatorio quando houver polimento de acessibilidade.
- **Secondary:** fundo branco, borda Azul Controle e texto Azul Controle. Usado para navegacao secundaria e acoes nao destrutivas.
- **Warning:** fundo Ambar Atencao com texto escuro. Usado para acoes sensiveis como regenerar token.

### Chips

- **Style:** pills compactas com 999px de radius, padding `4px 10px`, texto de 12px.
- **State:** `ok` usa verde com fundo claro; `pending` usa ambar com fundo claro. O texto deve carregar o significado junto com a cor.

### Cards / Containers

- **Corner Style:** canto funcional (8px).
- **Background:** branco sobre Fundo Operacional.
- **Shadow Strategy:** Surface Low em tela; sem sombra em print/PDF.
- **Border:** Linha Estrutural de 1px.
- **Internal Padding:** 16px por padrao; 22px no header do report; 28px em estados vazios ou sucesso.

### Report KPIs

- **Health labels:** usar texto explicito junto com cor: `Dentro da meta`, `Atencao` ou `Critico`.
- **Threshold copy:** cada KPI executivo deve explicar o limiar operacional, por exemplo meta minima de SLA ou alerta acima de determinado percentual.
- **Visual language:** cards continuam compactos, com borda superior semantica e sem faixas laterais.
- **Status meaning:** verde = dentro da meta, ambar = acompanhar, vermelho = priorizar plano de acao.

### Report Charts

- **SLA scale:** graficos de SLA devem usar escala focada em 80-100% quando a pergunta for sustentacao de meta.
- **Reference line:** incluir linha de meta em 93% nos graficos de SLA.
- **Captions:** cada grafico deve ter uma frase curta explicando como interpretar a visualizacao.
- **Static capture:** manter animacoes do Recharts desativadas em graficos de report para reduzir risco de PDF/screenshot em branco.

### Report Navigation

- **Toolbar:** report diario usa uma toolbar compacta acima do header com voltar ao admin, report anterior/proximo, historico e exportar PDF.
- **Disabled state:** quando nao houver report anterior/proximo, manter botao visualmente desabilitado com `aria-disabled`.
- **Hierarchy:** secoes do report devem alternar entre blocos executivos e tabelas; evitar repeticao de cards sem narrativa.

### Inputs / Fields

- **Style:** fundo branco, borda `#cbd5e1`, radius 8px, altura minima 40px.
- **Focus:** deve preservar borda clara e indicar foco sem inventar affordance.
- **Error / Disabled:** erros devem aparecer em bloco de alerta com texto explicito; nao depender apenas de borda vermelha.

### Navigation

- **Style:** topbar Azul Controle, texto branco e uma linha inferior azul claro.
- **Typography:** simples, 14px, sem uppercase rastreado.
- **Mobile:** topbar empilha links e preserva area de toque.

### Tables

- **Style:** linhas horizontais leves, cabecalho frio e contraste suficiente para varredura.
- **Density:** 10px vertical por celula. A tabela e uma ferramenta, nao uma peca editorial.

## 6. Do's and Don'ts

### Do:
- **Do** usar Azul Controle para autoridade, navegacao e botoes primarios.
- **Do** usar cores semanticas junto com texto de status.
- **Do** manter cards em 8px de radius e padding de 16px na maioria das superficies.
- **Do** preservar tabelas densas e legiveis; este produto e uma ferramenta operacional.
- **Do** usar estados vazios que orientam a proxima acao.
- **Do** respeitar `prefers-reduced-motion`; animacao existe para estado, nao para coreografia.

### Don't:
- **Don't** parecer Power BI generico.
- **Don't** parecer planilha cinza.
- **Don't** virar SaaS coloridinho demais.
- **Don't** usar dashboard escuro de NOC como referencia visual.
- **Don't** construir tela com linguagem de site marketing, hero promocional ou copy de venda.
- **Don't** usar `border-left` ou `border-right` maior que 1px como faixa colorida de destaque.
- **Don't** usar glassmorphism, texto em gradiente, ilustração decorativa ou sombras largas.
- **Don't** depender apenas de cor para comunicar status operacional.
