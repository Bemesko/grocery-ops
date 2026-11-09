<template>
  <main class="pagina enxoval-pagina">
    <header class="cabecalho">
      <div>
        <p class="eyebrow">Teste de comparação</p>
        <h1>Enxoval do bebê</h1>
      </div>
      <span class="badge">v1 · comparativo</span>
    </header>

    <section class="resumo-grid">
      <article class="card destaque">
        <span>Total planejado</span>
        <strong>{{ formatarDinheiro(totalPlanejado) }}</strong>
        <small>Orçamento total do enxoval</small>
      </article>
      <article class="card">
        <span>Gasto atual</span>
        <strong>{{ formatarDinheiro(totalGasto) }}</strong>
        <small>{{ percentualGasto }} do total</small>
      </article>
      <article class="card">
        <span>Restante</span>
        <strong>{{ formatarDinheiro(totalRestante) }}</strong>
        <small>Disponível para comprar</small>
      </article>
      <article class="card">
        <span>Melhor custo</span>
        <strong>{{ melhorCategoria }}</strong>
        <small>{{ melhorCategoriaDesc }}</small>
      </article>
    </section>

    <section class="card painel">
      <div class="titulo-linha">
        <h2>Resumo do orçamento</h2>
        <button type="button" class="chip">Atualizar</button>
      </div>

      <div class="lista-categorias">
        <div v-for="categoria in categorias" :key="categoria.id" class="linha-categoria">
          <div class="coluna-nome">
            <h3>{{ categoria.nome }}</h3>
            <p>{{ categoria.meta }}</p>
          </div>
          <div class="coluna-valor">
            <span class="planejado">{{ formatarDinheiro(categoria.planejado) }}</span>
            <span class="gasto">{{ formatarDinheiro(categoria.gasto) }}</span>
          </div>
          <div class="coluna-status" :class="categoria.statusClasse">
            {{ categoria.status }}
          </div>
        </div>
      </div>
    </section>

    <section class="cards-comparacao">
      <article class="card">
        <div class="titulo-linha compacta">
          <h2>Comparativo por loja</h2>
          <span class="mini-badge">melhor preço</span>
        </div>

        <div class="lojas">
          <div v-for="loja in lojas" :key="loja.nome" class="item-loja" :class="{ destaqueItem: loja.melhor }">
            <div class="nome-loja">
              <strong>{{ loja.nome }}</strong>
              <small>{{ loja.tipo }}</small>
            </div>
            <div class="valor-loja">
              <span>{{ formatarDinheiro(loja.total) }}</span>
              <small>Frete {{ formatarDinheiro(loja.frete) }}</small>
            </div>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="titulo-linha compacta">
          <h2>Itens prioritários</h2>
          <span class="mini-badge">a acompanhar</span>
        </div>

        <ul class="lista-itens">
          <li v-for="item in itensPrioritarios" :key="item.nome">
            <div>
              <strong>{{ item.nome }}</strong>
              <small>{{ item.detalhe }}</small>
            </div>
            <span>{{ formatarDinheiro(item.valor) }}</span>
          </li>
        </ul>
      </article>
    </section>

    <section class="card painel">
      <div class="titulo-linha">
        <h2>Observações de compra</h2>
      </div>

      <div class="observacoes">
        <div>
          <span class="ponto verde"></span>
          <p>Fazer comparação por tamanho e quantidade para não comprar pacote maior sem necessidade.</p>
        </div>
        <div>
          <span class="ponto amarelo"></span>
          <p>Priorizar fraldas e itens de higiene antes de móveis e conforto, porque são de uso diário.</p>
        </div>
        <div>
          <span class="ponto rosa"></span>
          <p>Revisar se carrinho e cadeirinha têm garantia, manual e peso/idade compatíveis com o bebê.</p>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
const categorias = [
  {
    id: 1,
    nome: 'Fraldas e penicos',
    meta: 'estoque e reposição',
    planejado: 100,
    gasto: 0,
    status: 'A acompanhar',
    statusClasse: 'amarelo',
  },
  {
    id: 2,
    nome: 'Roupas básicas',
    meta: 'bodies, mijões e macacões',
    planejado: 300,
    gasto: 201,
    status: 'Em progresso',
    statusClasse: 'azul',
  },
  {
    id: 3,
    nome: 'Móveis',
    meta: 'berço, cômoda e itens de quarto',
    planejado: 1500,
    gasto: 0,
    status: 'Planejado',
    statusClasse: 'cinza',
  },
  {
    id: 4,
    nome: 'Carrinho e conforto',
    meta: 'carrinho, bebê conforto e acessórios',
    planejado: 1200,
    gasto: 0,
    status: 'Planejado',
    statusClasse: 'cinza',
  },
  {
    id: 5,
    nome: 'Mala da maternidade',
    meta: 'higiene e primeiros cuidados',
    planejado: 400,
    gasto: 0,
    status: 'Planejado',
    statusClasse: 'cinza',
  },
  {
    id: 6,
    nome: 'Reserva extra',
    meta: 'custo de parto e imprevistos',
    planejado: 1500,
    gasto: 0,
    status: 'Guardado',
    statusClasse: 'verde',
  },
]

const lojas = [
  { nome: 'Shopee', tipo: 'ofertas', total: 1560, frete: 68, melhor: true },
  { nome: 'Mercado Livre', tipo: 'kit e parcelamento', total: 1745, frete: 92, melhor: false },
  { nome: 'Amazon Brasil', tipo: 'premium/variedade', total: 1810, frete: 81, melhor: false },
]

const itensPrioritarios = [
  { nome: 'Fralda tamanho RN', detalhe: 'caixa com 30 a 60 unidades', valor: 82 },
  { nome: 'Body manga curta', detalhe: '3 a 5 peças / tamanho P', valor: 118 },
  { nome: 'Mijão', detalhe: '3 a 5 peças / tamanho P', valor: 94 },
  { nome: 'Cadeirinha ISOFIX', detalhe: '0 a 12 anos / segurança', valor: 840 },
  { nome: 'Carrinho reversível', detalhe: 'com moisés e assento', valor: 1280 },
]

const formatarDinheiro = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)

const totalPlanejado = computed(() =>
  categorias.reduce((soma, categoria) => soma + categoria.planejado, 0),
)

const totalGasto = computed(() =>
  categorias.reduce((soma, categoria) => soma + categoria.gasto, 0),
)

const totalRestante = computed(() => totalPlanejado.value - totalGasto.value)
const percentualGasto = computed(() => {
  if (!totalPlanejado.value) return '0%'
  return `${Math.round((totalGasto.value / totalPlanejado.value) * 100)}%`
})

const melhorCategoria = computed(() => {
  const maiorCusto = [...categorias].sort((a, b) => b.planejado - a.planejado)[0]
  return maiorCusto ? maiorCusto.nome : 'N/A'
})

const melhorCategoriaDesc = computed(() => {
  const melhor = [...categorias].sort((a, b) => b.planejado - a.planejado)[0]
  return melhor ? `${formatarDinheiro(melhor.planejado)} planejados` : 'sem dado'
})
</script>

<style scoped>
.pagina {
  padding: 1rem 1rem 5rem;
  max-width: 1080px;
  margin: 0 auto;
}

.cabecalho {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--texto-suave);
}

h1, h2, h3, p {
  margin: 0;
}

h1 {
  margin-top: 0.25rem;
  font-size: clamp(1.8rem, 3vw, 2.5rem);
}

.badge,
.mini-badge,
.chip {
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  font-size: 0.76rem;
  font-weight: 700;
  background: rgba(255, 136, 86, 0.12);
  color: var(--primaria);
}

.resumo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.card {
  background: var(--superficie);
  border: 1px solid var(--borda);
  border-radius: 1rem;
  padding: 1rem;
  box-shadow: var(--sombra, 0 8px 20px rgba(0, 0, 0, 0.04));
}

.card.destaque {
  background: linear-gradient(135deg, rgba(255, 136, 86, 0.12), rgba(255, 136, 86, 0.03));
}

.card span {
  display: block;
  color: var(--texto-suave);
  font-size: 0.8rem;
  margin-bottom: 0.3rem;
}

.card strong {
  display: block;
  font-size: clamp(1.4rem, 3vw, 2rem);
  margin-bottom: 0.15rem;
}

.card small {
  color: var(--texto-suave);
}

.painel {
  margin-top: 1rem;
}

.titulo-linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.compacta {
  margin-bottom: 0.75rem;
}

.lista-categorias {
  display: grid;
  gap: 0.8rem;
}

.linha-categoria {
  display: grid;
  grid-template-columns: minmax(160px, 1.5fr) 170px 120px;
  gap: 0.8rem;
  align-items: center;
  padding: 0.7rem 0.8rem;
  border-radius: 0.9rem;
  background: rgba(148, 163, 184, 0.05);
}

.coluna-nome p {
  font-size: 0.8rem;
  color: var(--texto-suave);
  margin-top: 0.2rem;
}

.coluna-valor {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  text-align: right;
}

.planejado {
  font-weight: 700;
}

.gasto {
  color: var(--texto-suave);
}

.coluna-status {
  justify-self: end;
  border-radius: 999px;
  padding: 0.35rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 700;
}

.coluna-status.verde { background: rgba(34, 197, 94, 0.12); color: #15803d; }
.coluna-status.amarelo { background: rgba(245, 158, 11, 0.12); color: #b45309; }
.coluna-status.azul { background: rgba(59, 130, 246, 0.12); color: #1d4ed8; }
.coluna-status.cinza { background: rgba(148, 163, 184, 0.12); color: var(--texto-suave); }

.cards-comparacao {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 1rem;
  margin-top: 1rem;
}

.lojas {
  display: grid;
  gap: 0.75rem;
}

.item-loja {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--borda);
  border-radius: 0.8rem;
  background: rgba(15, 23, 42, 0.02);
}

.destaqueItem {
  border-color: rgba(255, 136, 86, 0.6);
  background: rgba(255, 136, 86, 0.06);
}

.nome-loja {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.nome-loja small,
.valor-loja small {
  color: var(--texto-suave);
}

.valor-loja {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-weight: 700;
}

.lista-itens {
  display: grid;
  gap: 0.7rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.lista-itens li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0.8rem;
  border-radius: 0.8rem;
  background: rgba(148, 163, 184, 0.05);
}

.lista-itens li div {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.lista-itens small {
  color: var(--texto-suave);
}

.observacoes {
  display: grid;
  gap: 0.8rem;
}

.observacoes > div {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
}

.ponto {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  margin-top: 0.25rem;
}

.ponto.verde { background: #22c55e; }
.ponto.amarelo { background: #f59e0b; }
.ponto.rosa { background: #f472b6; }

@media (max-width: 760px) {
  .cards-comparacao {
    grid-template-columns: 1fr;
  }

  .linha-categoria {
    grid-template-columns: 1fr;
  }

  .coluna-status {
    justify-self: start;
  }

  .cabecalho {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
