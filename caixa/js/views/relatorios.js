// Relatórios do ano e exportação.

import { esc, brl, pct, ymAtual, ymAdd, mesSo, mesNome, sum, hoje, parseISO } from '../util.js';
import { icon } from '../icons.js';
import { vazio, trocaMes } from '../ui.js';
import { resumoMes, resumoDias, porCategoria, porForma, porCliente } from '../calc.js';
import { barrasH, colunasDuplas, legenda } from '../charts.js';
import { cartao, avatar } from './comum.js';

let ano = Number(ymAtual().slice(0, 4));
let mesDias = ymAtual();

const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Resumo de cada dia do mês escolhido: o que entrou, o que saiu e o resultado. */
function diaADia() {
  const dias = resumoDias(mesDias).slice().reverse();
  const rec = sum(dias, (d) => d.recebido);
  const pag = sum(dias, (d) => d.pago);
  const melhor = dias.slice().sort((a, b) => b.recebido - a.recebido)[0];
  const corpo = dias.length ? `
    <p class="frase"><b>${dias.length}</b> ${dias.length === 1 ? 'dia' : 'dias'} com movimento. Média de <b>${brl(rec / dias.length)}</b> recebidos por dia${melhor ? `; o melhor foi <b>${Number(melhor.data.slice(8))}/${melhor.data.slice(5, 7)}</b>, com ${brl(melhor.recebido)}` : ''}.</p>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Dia</th><th>Receitas</th><th>Despesas</th><th>Resultado</th><th>Lançamentos</th></tr></thead>
      <tbody>${dias.map((d) => `<tr><td>${d.data === hoje() ? 'Hoje' : `${d.data.slice(8)}/${d.data.slice(5, 7)}`} <span class="fraco">${SEM[parseISO(d.data).getDay()]}</span></td><td>${brl(d.recebido)}</td><td>${brl(d.pago)}</td><td class="${d.lucro < 0 ? 'txt-perigo' : ''}">${brl(d.lucro)}</td><td>${d.qtd}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td>${brl(rec)}</td><td>${brl(pag)}</td><td>${brl(rec - pag)}</td><td>${sum(dias, (d) => d.qtd)}</td></tr></tfoot>
    </table></div>` : `<p class="fraco">Nenhum recebimento ou pagamento em ${esc(mesNome(mesDias))}.</p>`;
  return cartao('Dia a dia', corpo, { sub: 'O que foi recebido e pago em cada dia', acao: trocaMes(mesNome(mesDias), { acaoAntes: 'dias-antes', acaoDepois: 'dias-depois', acaoHoje: 'dias-hoje' }), classe: 'cartao-dias' });
}

const meses = () => Array.from({ length: 12 }, (_, i) => resumoMes(`${ano}-${String(i + 1).padStart(2, '0')}`));

export default {
  titulo: 'Relatórios',
  render() {
    const ms = meses();
    const rec = sum(ms, (m) => m.recebido);
    const pag = sum(ms, (m) => m.pago);
    const lucro = rec - pag;
    const comMov = ms.filter((m) => m.recebido || m.pago);
    const melhor = comMov.slice().sort((a, b) => b.lucro - a.lucro)[0];
    const A = String(ano);
    const cli = porCliente(A).slice(0, 6);
    return `
      <div class="barra-filtros">
        <div class="troca-mes">
          <button type="button" class="btn-ic" data-acao="ano-antes" aria-label="Ano anterior">${icon('chevL')}</button>
          <span class="troca-rotulo">${ano}</span>
          <button type="button" class="btn-ic" data-acao="ano-depois" aria-label="Próximo ano">${icon('chevR')}</button>
        </div>
        <button class="btn" data-acao="exportar-excel">${icon('sheet')}Exportar para planilha</button>
      </div>
      <div class="tiles">
        <div class="tile"><span class="tile-rotulo"><i class="p1"></i>Receitas recebidas</span><b class="tile-valor">${brl(rec)}</b><span class="tile-sub">em ${ano}</span></div>
        <div class="tile"><span class="tile-rotulo"><i class="p2"></i>Despesas pagas</span><b class="tile-valor">${brl(pag)}</b><span class="tile-sub">em ${ano}</span></div>
        <div class="tile ${lucro < 0 ? 'critico' : ''}"><span class="tile-rotulo">Resultado do ano</span><b class="tile-valor">${brl(lucro)}</b><span class="tile-sub">Margem ${rec ? pct(lucro / rec) : '–'}</span></div>
        <div class="tile"><span class="tile-rotulo">Melhor mês</span><b class="tile-valor">${melhor ? esc(mesSo(melhor.ym)) : '–'}</b><span class="tile-sub">${melhor ? `Resultado de ${brl(melhor.lucro)}` : 'Sem movimento'}</span></div>
      </div>
      ${diaADia()}
      ${!comMov.length ? vazio('relatorios', `Sem movimento em ${ano}`, 'Os relatórios aparecem quando houver receitas ou despesas pagas no ano.') : `
      <div class="painel painel-rel">
        ${cartao('Mês a mês', `${legenda([[1, 'Receitas recebidas'], [2, 'Despesas pagas']])}<div class="grafico" data-grafico="ano"></div>
          <div class="tabela-rolagem"><table class="tabela">
            <thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th><th>Margem</th></tr></thead>
            <tbody>${ms.map((m) => `<tr class="${m.recebido || m.pago ? '' : 'apagado'}"><td>${esc(mesSo(m.ym))}</td><td>${brl(m.recebido)}</td><td>${brl(m.pago)}</td><td class="${m.lucro < 0 ? 'txt-perigo' : ''}">${brl(m.lucro)}</td><td>${m.margem === null ? '–' : pct(m.margem)}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td>Total</td><td>${brl(rec)}</td><td>${brl(pag)}</td><td>${brl(lucro)}</td><td>${rec ? pct(lucro / rec) : '–'}</td></tr></tfoot>
          </table></div>`, { sub: `Regime de caixa: conta o que foi recebido e pago em ${ano}`, classe: 'area-larga' })}
        ${cartao('Receitas por categoria', barrasH(porCategoria('receita', A), { serie: 1, max: 8 }) || '<p class="fraco">Sem receitas.</p>', { sub: 'O que mais vende' })}
        ${cartao('Despesas por categoria', barrasH(porCategoria('despesa', A), { serie: 2, max: 8 }) || '<p class="fraco">Sem despesas.</p>', { sub: 'Onde o dinheiro é gasto' })}
        ${cartao('Melhores clientes', cli.length ? `<div class="lista lista-interna">${cli.map((c, i) => `
          <a class="linha linha-toque" href="#/clientes/${c.cliente.id}">${avatar(c.cliente.nome)}
            <div class="linha-txt"><b>${esc(c.cliente.nome)}</b><small>${i + 1}º em compras no ano</small></div><span class="valor">${brl(c.valor)}</span></a>`).join('')}</div>` : '<p class="fraco">Nenhuma venda com cliente identificado.</p>', { sub: `Total vendido em ${ano}` })}
        ${cartao('Formas de recebimento', barrasH(porForma('receita', A), { serie: 1, max: 7 }) || '<p class="fraco">Sem recebimentos.</p>', { sub: 'Como os clientes pagam' })}
      </div>`}
      <section class="grupo"><h3 class="grupo-titulo">Exportar</h3><div class="lista">
        <button type="button" class="linha linha-botao" data-acao="exportar-excel">${icon('sheet')}<span>Planilha Excel completa (.xlsx)</span></button>
        <button type="button" class="linha linha-botao" data-acao="exportar-csv">${icon('download')}<span>Só os lançamentos (.csv)</span></button>
      </div><p class="grupo-rodape">A planilha traz abas de resumo mensal, lançamentos, contas a receber e a pagar, clientes, vendas parceladas, gastos fixos e saldos. Abre no Excel, no Google Planilhas e no Numbers.</p></section>`;
  },
  montar(el) {
    const g = el.querySelector('[data-grafico="ano"]');
    if (g) colunasDuplas(g, meses().map((m) => ({ rotulo: mesSo(m.ym), titulo: mesNome(m.ym), a: m.recebido, b: m.pago })));
  },
  acoes: {
    'ano-antes': () => ano--,
    'ano-depois': () => ano++,
    'dias-antes': () => (mesDias = ymAdd(mesDias, -1)),
    'dias-depois': () => (mesDias = ymAdd(mesDias, 1)),
    'dias-hoje': () => (mesDias = ymAtual()),
  },
};
