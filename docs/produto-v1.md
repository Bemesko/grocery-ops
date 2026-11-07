# Grocery Ops: especificação da v1

## Tese

A lista de compras e os preços do mercado se informam. A lista diz o que comprar e em que ordem; os preços registrados no mercado estimam quanto a lista vai custar e onde ela sai mais barata. O dado coletado é o produto: toda compra grava preço, quantidade, mercado e data de forma estruturada desde o primeiro dia, mesmo antes de existir a tela que usa esse dado.

## Contexto de uso

- Uma casa, duas pessoas. As duas anotam na lista durante a semana, cada uma no seu celular; no mercado, só uma usa o app.
- Todo o gasto de mercado é pago com VR. Todos os VRs recarregam no dia 1 do mês.
- Dois mercados regulares: um atacado e um com mais variedade. Comparar preços entre eles ajuda a decidir aonde ir.
- O mercado tem sinal de celular: offline não é prioridade.
- Sem login: a tailnet já controla quem acessa, e a lista é única da casa.

## Critérios de sucesso

1. Usamos o app em toda compra.
2. Usamos o budget com consciência: estourar às vezes é intencional (compras que duram o mês), mas a decisão é tomada vendo o impacto.
3. O total do app bate com o da nota dentro de ±5%. Na v1 isso é medido pelo campo opcional "total da nota" ao fechar a compra.

## Story map

Etapas, na ordem do uso: **Anotar → Preparar a ida → No mercado → Fechar a compra → Analisar**.

| Etapa | v1 | v1.1 | v2 | v3 |
| --- | --- | --- | --- | --- |
| Anotar | item genérico com sugestão de nomes já usados; categoria lembrada; prioritário em 1 toque; sincronização entre celulares | | | sugestão de itens pelo padrão de recompra |
| Preparar a ida | seleção "nesta ida"; estimativa por mercado lado a lado; budget restante | | assistente "encaixar no budget"; comparação exata por tamanho de embalagem | |
| No mercado | lista por corredor; registrar preço com 1 toque se não mudou; R$/kg + peso; ↑↓; item fora da lista; total vs budget; transbordo | | ordem de corredores por mercado | foto da etiqueta; código de barras; offline |
| Fechar a compra | total da nota; resumo da compra | leitura do QR da NFC-e (SC) e conferência do total | importar os itens da NFC-e e casar com os itens do app | outros estabelecimentos pagos com VR |
| Analisar | gasto do mês; itens que mais pesaram; gasto por categoria; histórico de preço do item; importação de histórico (CSV) | | evolução de preço; inflação da cesta | |

## Telas da v1

### Lista (anotar)

- Campo único "adicionar item" no topo. Ao digitar, sugere itens já registrados (inclusive os que só aparecem em compras), com busca sem acento e sem diferenciar maiúsculas. Se o texto é parecido com um item existente, a sugestão aparece primeiro ("Tapioca" para "tapioka"), para manter os dados consistentes.
- Item novo: escolher a categoria em chips (uma vez; depois é lembrada).
- Quantidade opcional ("2", "1 kg"). Item que já está na lista não duplica: o app destaca o existente.
- Um toque marca/desmarca prioritário (estrela). Prioritários aparecem primeiro dentro de cada categoria.
- Agrupada por categoria, na ordem dos corredores.
- Sincronização: a tela refaz a busca a cada 5 s enquanto está visível e ao voltar o foco. Sem tempo real na v1; a última escrita vale.

### Preparar a ida

A lista é o que a casa precisa; a ida ao mercado leva só uma parte. Preparar a ida é um **modo da tela da lista**, não uma tela nova, e é opcional.

- Botão "Preparar ida": cada item ganha um marcador "nesta ida". Os prioritários já vêm marcados.
- Rodapé fixo, atualizado a cada toque:
  - `12 itens · Atacado ≈ R$ 312 (11/12) · Variedade ≈ R$ 341 (9/12)`
  - `Nos 9 itens com preço nos dois: Atacado R$ 210 · Variedade R$ 236`
  - `Budget restante da semana: R$ 420`
- Botões "Começar no Atacado" / "Começar na Variedade" (um por mercado cadastrado).
- Pular a preparação e tocar direto em "Começar compra" leva a lista inteira.
- A seleção fica no servidor: dá para preparar num celular e comprar no outro.

### Modo mercado

- Cabeçalho fixo:
  - total do carrinho;
  - "faltam ≈ R$ 85 (4 itens)": estimativa dos itens selecionados ainda fora do carrinho;
  - restante do budget, em verde/amarelo/vermelho;
  - linha de transbordo quando o total previsto passa do budget: `Se fechar assim: próximas 3 semanas com R$ 386,67 (era R$ 420)`.
- Itens selecionados primeiro, por corredor. O resto da lista fica numa seção recolhida "Também na lista (5)"; comprar algo dela conta como item da lista.
- Tocar num item abre uma folha:
  - preço já preenchido com o último preço daquele item naquele mercado: se não mudou, um toque confirma;
  - unidade un/kg (padrão do item); em kg, R$/kg + peso;
  - quantidade (padrão: a da lista, senão 1);
  - "mais detalhes", recolhido: marca/variante e preço cheio (sem promoção).
- No carrinho, cada item mostra o total e o selo ↑↓ em relação à última compra.
- Botão "+" para item fora da lista: o mesmo campo com sugestões e a mesma folha. Fica marcado como fora da lista.
- A compra em andamento é salva a cada item: fechar o app não perde nada. Só existe uma compra em andamento por vez.

### Fechar a compra

- "Finalizar": campo opcional "total da nota".
- Resumo: total e diferença para o budget; divergência com a nota (se informada); top 5 itens que mais pesaram; itens fora da lista (quantidade e R$); maiores altas e baixas.
- Itens comprados saem da lista; os não comprados ficam, e a seleção "nesta ida" é limpa.
- Histórico de compras: lista de compras finalizadas, com detalhe e edição (corrigir preço ou quantidade depois).

### Gastos (analisar)

Por mês (o ciclo do VR):

- total gasto e número de compras;
- itens que mais pesaram: top 10 por valor, com % do total;
- gasto por categoria, em barras;
- % do gasto fora da lista (só compras em que isso é conhecido).

Detalhe do item: último preço em cada mercado e as últimas compras.

### Configurações

- Mercados: nome e tipo (atacado/varejo). Criados pela interface; nomes não ficam no repo.
- Categorias: nome e ordem (arrastar). Seed inicial, na ordem dos corredores: Hortifruti, Padaria, Frios e laticínios, Congelados, Açougue e peixaria, Mercearia, Limpeza, Utilidades do lar, Higiene pessoal, Pet, Bebidas, Outros.
- Saldo do VR: "ajustar saldo" (valor de agora) e histórico de ajustes. No dia 1, o ajuste registra a recarga.
- Itens: renomear, mudar categoria/unidade, juntar dois itens (para corrigir duplicatas).
- Importar histórico (CSV).

## Regras de cálculo

Datas e semanas em `America/Sao_Paulo` (o container roda em UTC).

### Budget

- **Ciclo**: do dia 1 ao último dia do mês.
- **Período**: a interseção da semana (segunda a domingo) com o ciclo. Uma semana que atravessa o dia 1 vira dois períodos.
- **Saldo atual** `S` = último ajuste − compras finalizadas depois dele.
- `G` = todas as compras finalizadas do período, inclusive as feitas antes do último ajuste.
- `S0 = S + G`: o saldo no início do período. O saldo pode ser ajustado em qualquer dia e os budgets são recalculados na hora; como `G` continua contando o que a semana já gastou, o ajuste não devolve esse dinheiro à semana atual.
- `D` = dias do início do período até o fim do ciclo; `d` = dias do período.
- **Budget do período** `B = S0 × d / D`. O que sobra se redistribui sozinho, porque cada período recalcula a partir do saldo.
- **Restante** = `B − G − carrinho`.
- **Transbordo**: se `G + carrinho > B` e `D > d`, as próximas semanas ficam com `(S0 − G − carrinho) × 7 / (D − d)`. No último período do ciclo, mostrar quanto do saldo passa para o próximo ciclo. Se `carrinho > S`, avisar que falta saldo no VR.

Exemplo: segunda, dia 3, mês de 30 dias. `S0 = R$ 1.680`, `D = 28`, `d = 7`, então `B = R$ 420`. Um carrinho de R$ 520 estoura em R$ 100: as próximas semanas ficam com `1.160 × 7 / 21 = R$ 386,67`.

### Estimativas

A comparação na v1 é aproximada: ignora marca e tamanho de embalagem.

- **Preço de referência** de um item num mercado: o preço unitário (R$/un ou R$/kg) da compra mais recente desse item nesse mercado.
- **Quantidade estimada**: a da lista; senão a da última compra do item (útil para kg); senão 1.
- **Estimativa no mercado M**: soma dos itens com referência em M, com a cobertura (`11/12`).
- **Comparação justa**: a mesma soma restrita aos itens com referência em todos os mercados comparados.
- **"Faltam ≈" no modo mercado**: referência no mercado atual; sem ela, a do outro mercado; itens sem nenhuma referência ficam fora e são contados.

### ↑↓ do preço

Compara o preço unitário com a compra anterior do mesmo item no mesmo mercado: `+8% (R$ 4,59 → R$ 4,99)`. Sem histórico no mercado, compara com o outro e diz qual ("vs Atacado"). Variação abaixo de 1% aparece como "=".

### Valores

Dinheiro em centavos (inteiro) no banco e na API. Quantidade com 3 casas (peso em kg). Total do item = `round(quantidade × preço_unitário)`.

## Modelo de dados (Postgres)

```text
categoria      id, nome (único), ordem
mercado        id, nome (único), tipo [atacado|varejo], criado_em
item           id, nome, nome_normalizado (único: minúsculo, sem acento, espaços colapsados),
               categoria_id, unidade [un|kg], criado_em
lista_item     id, item_id, quantidade (texto livre, opcional), prioritario, nesta_ida,
               status [aberto|comprado|removido], criado_em, resolvido_em
               -- único: um lista_item aberto por item
compra         id, mercado_id, status [em_andamento|finalizada|cancelada],
               data (dia da compra), iniciada_em, finalizada_em,
               total_nota_centavos, chave_nfce (único, v1.1),
               origem [app|importacao|nfce], importacao_id
compra_item    id, compra_id, item_id, lista_item_id (quando veio da lista), variante, unidade [un|kg], quantidade numeric(10,3),
               preco_unitario_centavos, preco_cheio_centavos, da_lista (nulo = desconhecido),
               total_centavos, criado_em
saldo_ajuste   id, em (timestamp), saldo_centavos
importacao     id, arquivo, criada_em
```

O histórico de `lista_item` (quando cada item entrou e saiu da lista) não é usado na v1; ele é a base da sugestão por padrão de recompra da v3.

## Importação de histórico (CSV)

Para semear o app com as compras dos últimos meses. **O arquivo não entra no repo** (o repo é público): fica fora dele ou em `.data/`, que já é ignorado.

Colunas, uma linha por item comprado:

| coluna | obrigatória | formato |
| --- | --- | --- |
| `data` | sim | `AAAA-MM-DD` |
| `mercado` | sim | nome; criado se não existir |
| `item` | sim | nome genérico; casado pelo nome normalizado |
| `categoria` | sim | nome de uma categoria existente |
| `unidade` | sim | `un` ou `kg` |
| `quantidade` | sim | número (vírgula ou ponto) |
| `preco_unitario` | sim | R$ por un ou por kg |
| `variante` | não | texto |
| `preco_cheio` | não | R$ |
| `da_lista` | não | `sim`, `não` ou vazio |
| `total_nota` | não | R$, repetido nas linhas da mesma compra |
| `compra` | não | identificador para separar duas compras no mesmo dia e mercado |

Modelo com dados fictícios: [importacao-modelo.csv](importacao-modelo.csv). Planilhas exportam CSV com vírgula como separador decimal entre aspas, como no modelo; o importador também aceita `;` como separador de colunas (padrão do Excel em pt-BR).

Linhas com o mesmo `data` + `mercado` (+ `compra`) formam uma compra. Fluxo: enviar o arquivo em Configurações → prévia (compras, itens e mercados novos, erros por linha) → confirmar. Cada importação pode ser desfeita inteira. Compras com data anterior ao último ajuste de saldo não mexem no saldo.

## Fora da v1

- **v1.1**: NFC-e de SC. Primeiro um spike: confirmar que a página de consulta da SEFAZ-SC (a URL do QR code) pode ser lida pelo servidor, sem captcha. Depois: ler o QR com a câmera (o PWA precisa de HTTPS, que o ingress do Tailscale fornece), guardar a chave e conferir o total.
- **v2**: importar os itens da NFC-e e casar com os itens do app (as descrições da nota são abreviadas); ordem de corredores por mercado; assistente "encaixar no budget"; tamanho da embalagem para comparação exata; evolução de preço e inflação da cesta.
- **Dia preferencial de compra** (a priorizar): definir o dia da semana em que a casa costuma ir ao mercado e cortar os períodos de budget a partir dele (ex.: sábado a sexta), em vez de segunda a domingo. Muda `periodoDe` e as contagens de dias `d` e `D`.
- **v3**: sugestão de itens pelo padrão de recompra; foto da etiqueta e código de barras; outros estabelecimentos pagos com VR (padaria, açougue, sacolão); modo offline.

## Decisões técnicas

- **Postgres desacoplado**: o app só conhece `DATABASE_URL`. A base do deploy exige um Secret `grocery-ops-db`; o overlay do cluster usa o componente opcional [postgres-cnpg](../deploy/components/postgres-cnpg/kustomization.yaml), que cria o `Cluster` e aponta para o secret gerado pelo CNPG. O e2e usa um Postgres simples (overlay `ci`), sem operador.
- **Observabilidade**: OpenTelemetry com traces e métricas por OTLP (SDK em `otel/`, ligado por `OTEL_EXPORTER_OTLP_ENDPOINT`) e logs em JSON no stdout com `trace_id`, lidos pelo coletor do cluster. No homelab o destino é o `otel-agent` (ADR 008 do repo central). O e2e confere que traces e métricas chegam a um coletor.
- **Migrações**: SQL versionado em [server/db/migracoes.ts](../server/db/migracoes.ts), aplicado na subida com advisory lock. O driver é o `postgres` (porsager), sem ORM.
- **Desenvolvimento local**: `make db` sobe um Postgres em container; `make dev` e `make run` apontam para ele.
- **Busca de nomes parecidos**: roda no cliente sobre a lista completa de itens ([shared/utils/busca.ts](../shared/utils/busca.ts)), sem extensão no Postgres.
- **API**: rotas REST em `server/api` por recurso (`lista`, `itens`, `compras`, `mercados`, `categorias`, `saldo`, `gastos`, `importacao`). Estimativas e saldo saem do servidor; a projeção do budget ([shared/utils/budget.ts](../shared/utils/budget.ts)) roda nos dois lados, para o mercado atualizar a cada item.
