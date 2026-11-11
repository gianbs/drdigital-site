# Controle de Caixa · Dr Digital Gráfica

Aplicativo web de controle de caixa. Funciona no celular, no tablet e no computador, pode ser instalado na tela de início e continua funcionando sem internet. Feito só com HTML, CSS e JavaScript, sem nada para instalar ou compilar.

## O que ele faz

- **Resumo (painel):** resultado do mês com aviso de saúde do lucro (saudável, razoável, apertado, prejuízo), margem, saldo em caixa, total a receber e a pagar, meta de vendas, clientes em dia e em atraso, gráfico dos últimos 6 meses, despesas por categoria, próximos vencimentos e compromissos dos próximos 90 dias.
- **Lançamentos:** receitas e despesas por mês, com busca, categoria, forma de pagamento e conta.
- **Vendas parceladas:** com ou sem entrada, parcelas mensais, quinzenais ou semanais, recebimento parcial (o restante continua em aberto).
- **A receber e a pagar:** contas separadas em atrasadas, de hoje, da semana e do mês.
- **Clientes:** ficha com histórico, total em aberto, situação (em dia / em atraso) e cobrança pronta pelo WhatsApp.
- **Gastos fixos:** aluguel, salários, internet etc. entram sozinhos nas contas de cada mês. Os parcelados mostram a parcela atual, quanto falta e **quando acabam**. Também aceita receitas recorrentes (contratos mensais).
- **Contas:** caixa em dinheiro, banco/Pix, saldo inicial e transferências entre contas (sangria/depósito).
- **Relatórios:** resultado mês a mês, receitas e despesas por categoria, melhores clientes, formas de recebimento.
- **Exportar para planilha:** arquivo `.xlsx` com 9 abas (resumo mensal, resumo diário, lançamentos, a receber, a pagar, clientes, vendas parceladas, fixos e contas), além de CSV e backup.

## Onde os dados ficam

| Modo | Quando | Onde ficam os dados |
|---|---|---|
| **Local** | `config.js` vazio (padrão) | Só no navegador daquele aparelho |
| **Nuvem** | `config.js` preenchido | No seu projeto Supabase, com login. Aparecem em qualquer aparelho |

Para usar em mais de um aparelho é preciso ligar a nuvem (abaixo). É gratuito para este volume de uso.

## Ligar a nuvem (uns 10 minutos, uma vez só)

1. Crie uma conta em https://supabase.com e um projeto novo (região *South America (São Paulo)*).
2. No projeto, abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Abra **Authentication → Users → Add user → Create new user**. Informe seu e-mail, uma senha forte e marque **Auto Confirm User**. Esse será o login do app.
4. Em **Authentication → Sign In / Providers → Email**, desative **Allow new users to sign up** (assim ninguém mais cria conta).
5. Em **Project Settings → API**, copie a **Project URL** e a chave pública (**anon** ou **publishable**). Nunca use a chave `service_role`/`secret`.
6. Cole os dois valores em `config.js`:

```js
window.CAIXA_CONFIG = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseKey: 'SUA-CHAVE-PUBLICA',
};
```

7. Publique a alteração. Ao abrir o app aparece a tela de login.

A chave pública pode ficar no repositório: ela sozinha não dá acesso a nada. Quem protege os dados é o login e as regras do banco criadas pelo `schema.sql` (cada usuário só lê e grava os próprios registros).

Se você já tinha lançado coisas no modo local, no primeiro login o app pergunta se quer enviar esses dados para a conta.

## Acesso de funcionário (limitado)

O funcionário entra com e-mail e senha próprios e trabalha no mesmo caixa, mas só com vendas e recebimentos.

| | Dono | Funcionário |
|---|---|---|
| Lançar receitas, vendas parceladas e clientes | sim | sim |
| Receber parcelas e cobrar pelo WhatsApp | sim | sim |
| Resumo, relatórios, saldos e exportação | sim | não |
| Despesas, gastos fixos e contas a pagar | sim | não |
| Excluir lançamentos, vendas e clientes | sim | não |
| Ajustes (contas, categorias, metas, backup) | sim | não |

A restrição é feita no banco: as despesas, os fixos e as transferências nem chegam ao aparelho do funcionário, então não há como calcular lucro ou saldo por lá. Ele enxerga as receitas e as parcelas uma a uma, porque precisa delas para receber.

Para criar:

1. Rode `supabase/funcionarios.sql` no **SQL Editor** (uma vez só).
2. Crie o usuário em **Authentication → Users → Add user**, com **Auto Confirm User** marcado.
3. Vincule o funcionário ao dono, no SQL Editor, trocando os e-mails:

```sql
insert into public.caixa_membros (user_id, dono_id)
select f.id, d.id from auth.users f, auth.users d
where f.email = 'EMAIL-DO-FUNCIONARIO' and d.email = 'EMAIL-DO-DONO'
on conflict (user_id) do update set dono_id = excluded.dono_id;
```

Para tirar o acesso, apague o usuário em **Authentication → Users**.

## Publicar

O app é uma pasta de arquivos estáticos. Dentro deste repositório ele fica em `caixa/`, então com o GitHub Pages ligado na branch `main` o endereço é:

`https://gianbs.github.io/drdigital-site/caixa/`

A página tem `noindex`, então não aparece no Google.

### Instalar como aplicativo

- **iPhone / iPad (Safari):** Compartilhar → *Adicionar à Tela de Início*.
- **Android (Chrome):** menu ⋮ → *Instalar app*.
- **Computador (Chrome / Edge):** ícone de instalar na barra de endereço.

## Arquivos

- `index.html`: página única do app
- `config.js`: liga a nuvem (URL e chave do Supabase)
- `css/app.css`: visual. As cores da marca e do sistema ficam no topo, em `:root`
- `js/store.js`: banco de dados no aparelho (IndexedDB)
- `js/sync.js`: login e sincronização com a nuvem
- `js/calc.js`: contas do painel (lucro, parcelas, fixos, clientes em dia)
- `js/ops.js`: operações (pagar, criar venda parcelada, excluir)
- `js/forms.js`: formulários
- `js/views/`: uma tela por arquivo
- `js/xlsx.js` e `js/exportar.js`: geração da planilha
- `js/demo.js`: dados de exemplo
- `supabase/schema.sql`: tabela e regras de segurança
- `supabase/funcionarios.sql`: acesso limitado para funcionários
- `vendor/supabase.js`: biblioteca oficial do Supabase (licença MIT)
- `sw.js` e `manifest.webmanifest`: instalação e uso sem internet

## Sobre o visual

A interface segue as diretrizes de interface da Apple (Human Interface Guidelines): listas agrupadas, folhas modais, controles segmentados, barra de abas flutuante no iPhone e barra lateral em telas grandes, com modo claro e escuro.

Os kits oficiais da Apple (Figma/Sketch), a fonte San Francisco e os SF Symbols são licenciados para criar protótipos de apps das plataformas Apple, e não podem ser embutidos em um site. Por isso:

- a fonte é a **do sistema** (`-apple-system`): em iPhone, iPad e Mac o app aparece em San Francisco sem embutir nada; em Android e Windows usa a fonte nativa de cada um;
- os ícones são do **Lucide** (licença ISC), no mesmo estilo de traço.

## Testar no computador

```bash
python3 -m http.server 8000
```

Depois abra http://localhost:8000 dentro da pasta `caixa/`. Em **Ajustes → Dados** há a opção *Carregar dados de exemplo*.
