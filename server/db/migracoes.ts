// Migrações do schema, aplicadas em ordem na subida (server/utils/db.ts) e registradas na
// tabela `migracao`. Nunca edite uma migração já publicada: crie a próxima.
export const migracoes: { id: string; sql: string }[] = [
  {
    id: '001_inicial',
    sql: /* sql */ `
      create table categoria (
        id serial primary key,
        nome text not null unique,
        ordem int not null
      );

      create table mercado (
        id serial primary key,
        nome text not null unique,
        tipo text not null default 'varejo' check (tipo in ('atacado', 'varejo')),
        criado_em timestamptz not null default now()
      );

      create table item (
        id serial primary key,
        nome text not null,
        nome_normalizado text not null unique,
        categoria_id int not null references categoria (id),
        unidade text not null default 'un' check (unidade in ('un', 'kg')),
        criado_em timestamptz not null default now()
      );

      -- O histórico (comprado/removido) alimenta a sugestão por padrão de recompra (v3).
      create table lista_item (
        id serial primary key,
        item_id int not null references item (id) on delete cascade,
        quantidade text,
        prioritario boolean not null default false,
        nesta_ida boolean not null default false,
        status text not null default 'aberto' check (status in ('aberto', 'comprado', 'removido')),
        criado_em timestamptz not null default now(),
        resolvido_em timestamptz
      );
      create unique index lista_item_um_aberto on lista_item (item_id) where status = 'aberto';

      create table importacao (
        id serial primary key,
        arquivo text not null,
        criada_em timestamptz not null default now()
      );

      create table compra (
        id serial primary key,
        mercado_id int not null references mercado (id),
        status text not null default 'em_andamento'
          check (status in ('em_andamento', 'finalizada', 'cancelada')),
        data date not null,
        iniciada_em timestamptz not null default now(),
        finalizada_em timestamptz,
        total_nota_centavos int,
        chave_nfce text unique,
        origem text not null default 'app' check (origem in ('app', 'importacao', 'nfce')),
        importacao_id int references importacao (id) on delete cascade
      );
      create unique index compra_uma_em_andamento on compra (status) where status = 'em_andamento';
      create index compra_data on compra (data) where status = 'finalizada';

      create table compra_item (
        id serial primary key,
        compra_id int not null references compra (id) on delete cascade,
        item_id int not null references item (id),
        lista_item_id int references lista_item (id) on delete set null,
        variante text,
        unidade text not null check (unidade in ('un', 'kg')),
        quantidade numeric(10, 3) not null check (quantidade > 0),
        preco_unitario_centavos int not null check (preco_unitario_centavos >= 0),
        preco_cheio_centavos int check (preco_cheio_centavos >= 0),
        da_lista boolean,
        total_centavos int not null,
        criado_em timestamptz not null default now()
      );
      create index compra_item_compra on compra_item (compra_id);
      create index compra_item_item on compra_item (item_id);

      create table saldo_ajuste (
        id serial primary key,
        em timestamptz not null default now(),
        saldo_centavos int not null
      );

      insert into categoria (nome, ordem) values
        ('Hortifruti', 1),
        ('Padaria', 2),
        ('Frios e laticínios', 3),
        ('Congelados', 4),
        ('Açougue e peixaria', 5),
        ('Mercearia', 6),
        ('Limpeza', 7),
        ('Utilidades do lar', 8),
        ('Higiene pessoal', 9),
        ('Pet', 10),
        ('Bebidas', 11),
        ('Outros', 12);
    `,
  },
  {
    // Dia preferencial de ir ao mercado (budget semanal) e tamanho da embalagem
    // (comparação por kg/L e reduflação).
    id: '002_dia_preferido_e_embalagem',
    sql: /* sql */ `
      create table configuracao (
        chave text primary key,
        valor jsonb not null
      );
      insert into configuracao (chave, valor) values ('dia_preferido', '4');

      alter table item
        add column embalagem_qtd numeric(10, 3) check (embalagem_qtd > 0),
        add column embalagem_unidade text check (embalagem_unidade in ('g', 'kg', 'ml', 'l', 'un')),
        add constraint item_embalagem_completa check ((embalagem_qtd is null) = (embalagem_unidade is null));

      alter table compra_item
        add column embalagem_qtd numeric(10, 3) check (embalagem_qtd > 0),
        add column embalagem_unidade text check (embalagem_unidade in ('g', 'kg', 'ml', 'l', 'un')),
        add constraint compra_item_embalagem_completa
          check ((embalagem_qtd is null) = (embalagem_unidade is null));
    `,
  },
  {
    // NFC-e: leitura da nota pelo QR e conferência com o que foi anotado. Nada do bloco
    // "Consumidor" da nota (CPF, nome, endereço) é guardado.
    id: '003_nfce',
    sql: /* sql */ `
      alter table mercado add column cnpj text unique check (cnpj ~ '^[0-9]{14}$');

      alter table compra
        add column nfce_url text,
        add column nfce_emitente text,
        add column nfce_emitida_em timestamptz,
        add column desconto_nota_centavos int check (desconto_nota_centavos >= 0),
        add column nfce_conferida_em timestamptz;

      -- Linhas da nota como vieram; compra_item_id é o par confirmado na conferência.
      create table nfce_item (
        id serial primary key,
        compra_id int not null references compra (id) on delete cascade,
        ordem int not null,
        codigo text,
        descricao text not null,
        quantidade numeric(10, 3) not null check (quantidade > 0),
        unidade text not null,
        unitario_centavos int not null check (unitario_centavos >= 0),
        total_centavos int not null check (total_centavos >= 0),
        compra_item_id int references compra_item (id) on delete set null,
        unique (compra_id, ordem)
      );

      -- Código do produto na loja → item do app, aprendido nas conferências confirmadas.
      create table item_codigo (
        mercado_id int not null references mercado (id) on delete cascade,
        codigo text not null,
        item_id int not null references item (id) on delete cascade,
        primary key (mercado_id, codigo)
      );
    `,
  },
]
