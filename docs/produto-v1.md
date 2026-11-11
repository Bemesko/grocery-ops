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
| Preparar a ida | seleção "nesta ida"; estimativa por mercado lado a lado; budget restante | comparação por tamanho de embalagem (R$/kg, R$/L) | assistente "encaixar no budget" | |
| No mercado | lista por corredor; registrar preço com 1 toque se não mudou; R$/kg + peso; ↑↓; item fora da lista; total vs budget; transbordo | | ordem de corredores por mercado | foto da etiqueta; código de barras; offline |
| Fechar a compra | total da nota; resumo da compra | leitura do QR da NFC-e (SC), conferência do total e casamento dos itens da nota com os anotados; compra só pela nota | | outros estabelecimentos pagos com VR |
| Analisar | gasto do mês; itens que mais pesaram; gasto por categoria; histórico de preço do item; importação de histórico (CSV) | | evolução de preço; inflação da cesta | |

## Telas da v1

### Lista (anotar)

- Campo único "adicionar item" no topo. Ao digitar, sugere itens já registrados (inclusive os que só aparecem em compras), com busca sem acento e sem diferenciar maiúsculas. Se o texto é parecido com um item existente, a sugestão aparece primeiro ("Tapioca" para "tapioka"), para manter os dados consistentes.
- Item novo: escolher a categoria em chips (uma vez; depois é lembrada).
- Quantidade opcional ("2", "1 kg"). Item que já está na lista não duplica: o app destaca o existente.
- Um toque marca/desmarca prioritário: um "!" num círculo, laranja quando ligado, e uma barra laranja na borda esquerda da linha. Prioritários aparecem primeiro dentro de cada categoria.
- Arrastar um item para o lado: para a direita, **comprado** (sai da lista sem registrar preço, ex.: comprado na padaria); para a esquerda, **tirar da lista**. O aviso que aparece permite desfazer. Os dois também ficam como botões ao tocar no item.
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
- Histórico de compras: lista de compras finalizadas, com detalhe e edição (corrigir preço ou quantidade depois). "Excluir compra" apaga uma compra finalizada, com os itens e a nota dela; a lista não muda e não dá para desfazer (a compra em andamento se cancela).
- Nota fiscal: ver "Nota fiscal (NFC-e)".

### Nota fiscal (NFC-e)

- **Ler a nota**: pela câmera (QR) ou colando o link, ao finalizar a compra (preenche o total da nota) e no detalhe de qualquer compra. Em Compras, "Adicionar pela nota fiscal" cria uma compra finalizada só com a nota (ex.: uma parada rápida num mercadinho), no mercado do CNPJ da nota; CNPJ novo pergunta o mercado (um existente ou um novo com o nome do emitente).
- **Conferência**: cada linha da nota aparece com o item anotado que o app achou para ela: "✓" (código do produto já confirmado neste mercado, ou nome bem parecido), "confira" (parecido) ou "não anotado". Dá para trocar o par, fazer a linha entrar na compra como um item (existente ou novo) ou deixá-la de fora. Itens anotados que não estão na nota podem sair da compra.
- **Ao confirmar**: vale a quantidade e o preço da nota. A página da SEFAZ só traz o desconto no total: se há desconto e o preço anotado é menor que o unitário da nota, o anotado fica e o da nota vira preço cheio. A embalagem lida da descrição (`500ML`, `5KG`) preenche a da linha e a habitual do item quando estão vazias. O total da nota é o "valor a pagar". O par código do produto → item fica guardado por mercado e casa sozinho na próxima nota.
- **Verificação da SEFAZ**: o QR impresso é o link nacional `.../nfce/consulta?p=<chave>|...`, e a SEFAZ-SC sempre o manda para uma verificação de segurança (Cloudflare Turnstile) que só um navegador de verdade passa. Depois dela, o navegador abre a página da nota (`NFCe_Detalhes.aspx?rq=...`), e esse link o servidor lê. Por isso, ao ler o QR o app não consulta a SEFAZ: guarda a chave (que já dá o CNPJ do mercado e evita nota duplicada) e mostra o passo a passo:
  1. "Abrir a nota": abre o link do QR no navegador, onde a pessoa passa a verificação.
  2. Com os itens na tela, devolver o link ao app: no Android, Compartilhar → Grocery Ops (com o app instalado); no iPhone, copiar o link e tocar em "Colar link da nota". O app avisa se o link colado ainda é o do QR.
- **Compartilhar → Grocery Ops** (`/compartilhar`): se uma compra já espera a nota (o QR foi lido nela), a nota entra direto; senão o app pergunta em qual compra ela entra (a em andamento e as finalizadas dos últimos 14 dias sem nota, as do mesmo mercado primeiro) ou cria uma compra só pela nota.
- **Quando a nota não pode ser lida**: a SEFAZ também limita consultas por IP. O app faz uma consulta por leitura do link da página, nunca repete sozinho e guarda o que leu (reabrir a conferência não consulta de novo); "Tentar de novo" e "Abrir a nota" ficam na compra, e o total continua podendo ser digitado.
- **Privacidade**: a página da nota traz CPF, nome e endereço do consumidor. Esse bloco é cortado antes da leitura e nada dele é guardado, logado ou enviado nos traces (o link da nota também não vai para logs e traces, porque abre a nota inteira).

### Gastos (analisar)

Por mês (o ciclo do VR) ou por trimestre civil (T4 = out–dez), escolhidos num alternador:

- total gasto e número de compras; no trimestre, média por mês e barras mês a mês (tocar abre o mês);
- **semana a semana** (só no mês): budget × gasto de cada semana do ciclo, com o acumulado do mês num gráfico (gasto acumulado × budget acumulado). O budget de cada semana é reconstruído a partir do saldo (ver "Budget"); sem ajuste de saldo no mês, só o gasto;
- itens que mais pesaram: top 10 por valor, com % do total;
- gasto por categoria, em barras; tocar numa categoria abre a distribuição de todos os itens dela no período;
- % do gasto fora da lista (só compras em que isso é conhecido).

Detalhe do item: último preço em cada mercado e as últimas compras, com a embalagem, o preço por kg/L/un e a marca de reduflação.

### Configurações

- Mercados: nome e tipo (atacado/varejo). Criados pela interface; nomes não ficam no repo.
- Categorias: nome e ordem (arrastar). Seed inicial, na ordem dos corredores: Hortifruti, Padaria, Frios e laticínios, Congelados, Açougue e peixaria, Mercearia, Limpeza, Utilidades do lar, Higiene pessoal, Pet, Bebidas, Outros.
- Saldo do VR: "ajustar saldo" (valor de agora) e histórico de ajustes. No dia 1, o ajuste registra a recarga.
- Saldo do VR também define o **dia de ir ao mercado** (padrão: sexta), usado no budget semanal.
- Itens (tela própria, `/itens`): todos por categoria, com busca; seleção para mudar a categoria de vários de uma vez e para juntar vários num só (escolhendo o nome que fica); "possíveis duplicados" por nome parecido, com "são diferentes" para dispensar o par; apagar itens nunca usados. No detalhe do item: renomear, categoria, unidade e embalagem habitual.
- Importar histórico (CSV).
- **Ocultar valores**: o olho no canto do cabeçalho de todas as telas troca todo valor em R$ (saldo, budget, preços, totais, estimativas, referências) por `R$ •••••`. Percentuais, quantidades, barras e o formato do gráfico continuam; na folha de preço, o que se digita continua visível. A escolha fica no aparelho (cada celular decide o seu).

## Regras de cálculo

Datas e semanas em `America/Sao_Paulo` (o container roda em UTC).

### Budget

- **Ciclo**: do dia 1 ao último dia do mês (o VR recarrega no dia 1).
- **Semana**: de segunda a domingo. Uma compra feita na segunda ou na terça conta para a semana corrente; de quarta a domingo, para a semana seguinte. As compras da semana W são, então, as feitas de quarta (W − 5) a terça (W + 1).
- **Dia preferencial** `P` (configurável, padrão sexta): o dia em que a casa costuma ir ao mercado. A semana pertence ao ciclo do mês em que cai o dia `P` da sua janela de compras.
- **Dinheiro do mês da compra**: se a semana de uma compra é de outro ciclo, a compra conta no próprio mês (o dinheiro é o dele). No fim do mês, vai para a última semana do ciclo.
- **Ida atrasada**: os dias do começo do mês cuja semana teve a ida no mês anterior (ex.: nov/2026 com sexta, de domingo 1/11 a terça 3/11, semana de 2/11 com ida em 30/10). Se há compra (finalizada ou em andamento) nesses dias, a ida do mês anterior atrasou: esses dias viram uma **semana a mais** no início do ciclo, com budget próprio (novembro passa de 4 para 5 semanas). Sem compra neles, não existe essa semana e os dias entram na primeira semana do mês.
- **Saldo atual** `S` = último ajuste − compras finalizadas depois dele.
- `G` = todas as compras finalizadas da semana atual, inclusive as feitas antes do último ajuste.
- `S0 = S + G`: o saldo no início da semana. O saldo pode ser ajustado em qualquer dia e os budgets são recalculados na hora; como `G` continua contando o que a semana já gastou, o ajuste não devolve esse dinheiro à semana atual.
- `N` = semanas do ciclo a partir da atual, inclusive.
- **Budget da semana** `B = S0 / N`. O que sobra se redistribui sozinho, porque cada semana recalcula a partir do saldo.
- **Restante** = `B − G − carrinho`.
- **Transbordo**: se `G + carrinho > B` e `N > 1`, as próximas semanas ficam com `(S0 − G − carrinho) / (N − 1)`. Na última semana do ciclo, mostrar quanto do saldo passa para o próximo ciclo. Se `carrinho > S`, avisar que falta saldo no VR.
- **Semana a semana (Gastos)**: com `Sf` = saldo depois do que o ciclo já gastou (último ajuste do mês − compras finalizadas depois dele), o budget da semana i é `(Sf + gasto da semana i em diante) / (semanas de i até o fim)`. As semanas futuras dividem `Sf` igualmente; enquanto a semana atual não tem compra, o budget dela fica reservado.

Exemplo (novembro/2026, sexta): as idas são nos dias 6, 13, 20 e 27; a de sexta 27 vale para a semana de 30/11 e sai do saldo de novembro; uma compra no domingo dia 1 é uma ida atrasada (a de 30/10): vira a semana de 2/11 e novembro fica com 5 semanas. No domingo dia 8, com R$ 660 de saldo depois da ida de sexta 6, as próximas 3 semanas ficam com `660 / 3 = R$ 220` cada.

### Estimativas

A comparação ignora marca. O tamanho da embalagem entra quando é conhecido (ver "Embalagem e reduflação").

- **Preço de referência** de um item num mercado: o preço unitário (R$/un ou R$/kg) da compra mais recente desse item nesse mercado.
- **Embalagens diferentes**: se o item tem embalagem habitual e a referência é de outro tamanho comparável (ex.: 800 g × 1 kg), o preço de referência é levado para a embalagem habitual pelo preço por kg/L/un.
- **Quantidade estimada**: a da lista; senão a da última compra do item (útil para kg); senão 1.
- **Estimativa no mercado M**: soma dos itens com referência em M, com a cobertura (`11/12`).
- **Comparação justa**: a mesma soma restrita aos itens com referência em todos os mercados comparados.
- **"Faltam ≈" no modo mercado**: referência no mercado atual; sem ela, a do outro mercado; itens sem nenhuma referência ficam fora e são contados.

### ↑↓ do preço

Compara o preço unitário com a compra anterior do mesmo item no mesmo mercado: `+8% (R$ 4,59 → R$ 4,99)`. Sem histórico no mercado, compara com o outro e diz qual ("vs Atacado"). Variação abaixo de 1% aparece como "=". Com embalagens de tamanhos diferentes, compara o preço por kg/L/un e diz isso no selo (`▲ 12%/kg`).

### Embalagem e reduflação

- Itens por unidade podem ter o tamanho da embalagem: `800 g`, `1 kg`, `900 ml`, `1,5 L`, `12 un`. É opcional em toda compra.
- Na folha do mercado o campo vem preenchido com a embalagem da última compra do item naquele mercado, senão com a habitual. A primeira embalagem registrada vira a habitual do item; ela pode ser mudada no detalhe do item.
- **Preço por conteúdo**: preço da embalagem ÷ conteúdo em kg, L ou un (g e ml ÷ 1000).
- **Reduflação**: comparada com a compra anterior (mesmo item, mesma marca/variante quando as duas têm), a embalagem encolheu e o preço por conteúdo subiu 1% ou mais. Selo `📉 1 kg → 800 g · +25%/kg` na folha, no carrinho, no resumo da compra e no histórico do item. Se o preço caiu na mesma proporção do conteúdo, não é reduflação.

### Valores

Dinheiro em centavos (inteiro) no banco e na API. Quantidade com 3 casas (peso em kg). Total do item = `round(quantidade × preço_unitário)`.

## Modelo de dados (Postgres)

```text
categoria      id, nome (único), ordem
mercado        id, nome (único), tipo [atacado|varejo], cnpj (único, aprendido da nota), criado_em
item           id, nome, nome_normalizado (único: minúsculo, sem acento, espaços colapsados),
               categoria_id, unidade [un|kg], embalagem_qtd, embalagem_unidade [g|kg|ml|l|un] (habitual),
               criado_em
lista_item     id, item_id, quantidade (texto livre, opcional), prioritario, nesta_ida,
               status [aberto|comprado|removido], criado_em, resolvido_em
               -- único: um lista_item aberto por item
compra         id, mercado_id, status [em_andamento|finalizada|cancelada],
               data (dia da compra), iniciada_em, finalizada_em,
               total_nota_centavos, chave_nfce (único), nfce_url, nfce_emitente, nfce_emitida_em,
               desconto_nota_centavos, nfce_conferida_em, origem [app|importacao|nfce], importacao_id
compra_item    id, compra_id, item_id, lista_item_id (quando veio da lista), variante, unidade [un|kg], quantidade numeric(10,3),
               preco_unitario_centavos, preco_cheio_centavos, da_lista (nulo = desconhecido),
               total_centavos, embalagem_qtd, embalagem_unidade, criado_em
nfce_item      id, compra_id, ordem, codigo (do produto na loja), descricao, quantidade, unidade (da nota),
               unitario_centavos, total_centavos, compra_item_id (par confirmado)
item_codigo    mercado_id, codigo, item_id  -- pares confirmados, por mercado
saldo_ajuste   id, em (timestamp), saldo_centavos
configuracao   chave, valor (jsonb)  -- dia_preferido: 0 = segunda … 6 = domingo
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
| `embalagem` | não | tamanho da embalagem de itens por unidade: `800 g`, `1 L`, `12 un` |

Modelo com dados fictícios: [importacao-modelo.csv](importacao-modelo.csv). Planilhas exportam CSV com vírgula como separador decimal entre aspas, como no modelo; o importador também aceita `;` como separador de colunas (padrão do Excel em pt-BR).

Linhas com o mesmo `data` + `mercado` (+ `compra`) formam uma compra. Fluxo: enviar o arquivo em Configurações → prévia (compras, itens e mercados novos, erros por linha) → confirmar. Cada importação pode ser desfeita inteira. Compras com data anterior ao último ajuste de saldo não mexem no saldo.

## Fora da v1

- **v1.1** (feita): NFC-e de SC, ver "Nota fiscal (NFC-e)". O spike (nov/2026) mostrou que a página do QR (`NFCe_Detalhes.aspx?rq=…`) abre no servidor com um GET simples, no layout nacional do DANFE NFC-e; algumas notas caem numa verificação Cloudflare Turnstile (`SecurityVerify.aspx`), e a consulta pela chave de acesso (`/nfce/consulta`) também cai nela para essas notas; o XML exige login no SAT; a consulta pública limita requisições por IP.
- **v2**: ordem de corredores por mercado; assistente "encaixar no budget"; evolução de preço e inflação da cesta (por kg/L quando houver embalagem).
- **v3**: sugestão de itens pelo padrão de recompra; foto da etiqueta e código de barras; outros estabelecimentos pagos com VR (padaria, açougue, sacolão); modo offline.

## Decisões técnicas

- **Postgres desacoplado**: o app só conhece `DATABASE_URL`. A base do deploy exige um Secret `grocery-ops-db`; o overlay do cluster usa o componente opcional [postgres-cnpg](../deploy/components/postgres-cnpg/kustomization.yaml), que cria o `Cluster` e aponta para o secret gerado pelo CNPG. O e2e usa um Postgres simples (overlay `ci`), sem operador.
- **Observabilidade**: OpenTelemetry com traces e métricas por OTLP (SDK em `otel/`, ligado por `OTEL_EXPORTER_OTLP_ENDPOINT`) e logs em JSON no stdout com `trace_id`, lidos pelo coletor do cluster. No homelab o destino é o `otel-agent` (ADR 008 do repo central). O e2e confere que traces e métricas chegam a um coletor.
- **Migrações**: SQL versionado em [server/db/migracoes.ts](../server/db/migracoes.ts), aplicado na subida com advisory lock. O driver é o `postgres` (porsager), sem ORM.
- **Desenvolvimento local**: `make db` sobe um Postgres em container; `make dev` e `make run` apontam para ele.
- **Busca de nomes parecidos**: roda no cliente sobre a lista completa de itens ([shared/utils/busca.ts](../shared/utils/busca.ts)), sem extensão no Postgres.
- **API**: rotas REST em `server/api` por recurso (`lista`, `itens`, `compras`, `mercados`, `categorias`, `saldo`, `gastos`, `importacao`). Estimativas e saldo saem do servidor; a projeção do budget ([shared/utils/budget.ts](../shared/utils/budget.ts)) roda nos dois lados, para o mercado atualizar a cada item.
