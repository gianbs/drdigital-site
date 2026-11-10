// Contas a receber e a pagar, organizadas por prazo.

import { esc, brl, sum } from '../util.js';
import { icon } from '../icons.js';
import { segmentado, vazio } from '../ui.js';
import { abertos, totaisAbertos, faixas } from '../calc.js';
import { linhaEntrada } from './comum.js';
import { ehFuncionario } from '../sync.js';

let aba = 'receita';

export default {
  titulo: 'Contas',
  tituloDe: () => (ehFuncionario() ? 'A receber' : 'Contas'),
  render(param) {
    const f = ehFuncionario();
    if (param === 'pagar') aba = 'despesa';
    if (param === 'receber' || f) aba = 'receita';
    const rec = aba === 'receita';
    const lista = abertos(aba);
    const t = totaisAbertos(aba);
    const grupos = faixas(lista);
    return `
      ${f ? '' : `<div class="barra-filtros">${segmentado('aba', [['receita', 'A receber'], ['despesa', 'A pagar']], aba, 'data-muda="aba"')}</div>`}
      <div class="tiles tiles-3" ${f ? 'hidden' : ''}>
        <div class="tile"><span class="tile-rotulo">${rec ? 'Total a receber' : 'A pagar em 30 dias'}</span><b class="tile-valor">${brl(rec ? t.total : t.atrasado + t.em30)}</b><span class="tile-sub">${lista.filter((e) => !e.virtual).length} lançamentos em aberto</span></div>
        <div class="tile ${t.atrasado ? 'critico' : ''}"><span class="tile-rotulo">${t.atrasado ? icon('alert') : icon('checkCircle')}Em atraso</span><b class="tile-valor">${brl(t.atrasado)}</b><span class="tile-sub">${t.qtdAtrasado ? `${t.qtdAtrasado} ${t.qtdAtrasado === 1 ? 'conta vencida' : 'contas vencidas'}` : 'Tudo em dia'}</span></div>
        <div class="tile"><span class="tile-rotulo">${icon('calendar')}Próximos 7 dias</span><b class="tile-valor">${brl(t.em7)}</b><span class="tile-sub">${rec ? 'previsto para entrar' : 'previsto para sair'}</span></div>
      </div>
      ${grupos.length ? grupos.map((g) => {
        const itens = g.itens.slice(0, 60);
        return `<section class="grupo">
          <h3 class="grupo-titulo dia ${g.id === 'atrasadas' ? 'txt-perigo' : ''}"><span>${esc(g.titulo)}</span><span>${brl(sum(g.itens, (e) => e.valor))}</span></h3>
          <div class="lista">${itens.map((e) => linhaEntrada(e, { botao: true, data: true })).join('')}</div>
          ${g.itens.length > itens.length ? `<p class="grupo-rodape">E mais ${g.itens.length - itens.length} depois disso.</p>` : ''}
        </section>`;
      }).join('') : vazio('checkCircle', rec ? 'Nada a receber' : 'Nada a pagar', rec ? 'Vendas a prazo e parcelas aparecem aqui.' : 'Contas pendentes e gastos fixos aparecem aqui.',
        `<button class="btn" data-acao="${rec ? 'nova-venda' : 'nova-despesa'}">${icon('plus')}${rec ? 'Nova venda parcelada' : 'Nova despesa'}</button>`)}`;
  },
  mudou(nome, valor) {
    if (nome === 'aba') {
      aba = valor;
      if (location.hash !== '#/contas') history.replaceState(null, '', '#/contas');
    }
  },
};
