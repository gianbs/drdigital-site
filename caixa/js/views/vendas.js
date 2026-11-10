// Vendas parceladas: quanto já entrou de cada uma e o que falta.

import { store } from '../store.js';
import { esc, brl, dataBR, prazoTexto, sum } from '../util.js';
import { icon } from '../icons.js';
import { segmentado, vazio, selo } from '../ui.js';
import { infoVenda } from '../calc.js';
import { medidor } from '../charts.js';
import { ehFuncionario } from '../sync.js';

let filtro = 'abertas';

function cartaoVenda(v, i) {
  const cli = store.get(v.clienteId);
  const st = i.status === 'atraso' ? selo('Em atraso', 'critico', 'alert') : i.status === 'emdia' ? selo('Em dia', 'bom', 'checkCircle') : selo('Quitada', 'neutro', 'check');
  const prox = i.proxima ? `Próxima: ${brl(i.proxima.valor)} em ${dataBR(i.proxima.vencimento)} (${prazoTexto(i.proxima.vencimento)})` : `Venda de ${dataBR(v.data)}`;
  return `<div class="linha linha-toque linha-alta" data-acao="abrir-venda" data-id="${v.id}" role="button" tabindex="0">
    <div class="linha-txt">
      <b>${esc(cli?.nome || 'Cliente removido')}</b>
      <small>${esc(v.descricao)}</small>
      ${medidor(i.total ? i.pago / i.total : 0, { tipo: i.status === 'atraso' ? 'critico' : i.status === 'quitado' ? 'bom' : '', rotulo: 'Recebido' })}
      <small class="${i.status === 'atraso' ? 'txt-perigo' : ''}">${esc(prox)}</small>
    </div>
    <div class="linha-fim">
      <span class="valor">${brl(i.pago)}</span>
      <small class="estado">de ${brl(i.total)}</small>
      ${st}
    </div>
    ${icon('chevR', 'seta')}
  </div>`;
}

export default {
  titulo: 'Vendas parceladas',
  render() {
    const todas = store.all('vendas').map((v) => ({ v, i: infoVenda(v) }));
    const ordem = { atraso: 0, emdia: 1, quitado: 2 };
    const lista = todas
      .filter((x) => (filtro === 'todas' ? true : filtro === 'abertas' ? x.i.status !== 'quitado' : x.i.status === 'quitado'))
      .sort((a, b) => ordem[a.i.status] - ordem[b.i.status] || (a.i.proxima?.vencimento || '9').localeCompare(b.i.proxima?.vencimento || '9') || b.v.data.localeCompare(a.v.data));
    const abertas = todas.filter((x) => x.i.status !== 'quitado');
    return `
      <div class="barra-filtros">
        ${segmentado('filtro', [['abertas', 'Em aberto'], ['quitadas', 'Quitadas'], ['todas', 'Todas']], filtro, 'data-muda="filtro"')}
        <button class="btn so-largo" data-acao="nova-venda">${icon('plus')}Nova venda</button>
      </div>
      <div class="tiles tiles-3" ${ehFuncionario() ? 'hidden' : ''}>
        <div class="tile"><span class="tile-rotulo">Vendas em aberto</span><b class="tile-valor">${abertas.length}</b><span class="tile-sub">${todas.length} no total</span></div>
        <div class="tile"><span class="tile-rotulo">Falta receber</span><b class="tile-valor">${brl(sum(abertas, (x) => x.i.aberto))}</b><span class="tile-sub">de ${brl(sum(abertas, (x) => x.i.total))} vendidos</span></div>
        <div class="tile ${sum(abertas, (x) => x.i.atrasado) ? 'critico' : ''}"><span class="tile-rotulo">Parcelas em atraso</span><b class="tile-valor">${brl(sum(abertas, (x) => x.i.atrasado))}</b><span class="tile-sub">${abertas.filter((x) => x.i.status === 'atraso').length} vendas com atraso</span></div>
      </div>
      ${lista.length
        ? `<section class="grupo"><div class="lista">${lista.map((x) => cartaoVenda(x.v, x.i)).join('')}</div></section>`
        : vazio('vendas', filtro === 'quitadas' ? 'Nenhuma venda quitada' : 'Nenhuma venda parcelada', 'Registre vendas com ou sem entrada e acompanhe cada parcela.', `<button class="btn" data-acao="nova-venda">${icon('plus')}Nova venda parcelada</button>`)}`;
  },
  mudou(nome, valor) {
    if (nome === 'filtro') filtro = valor;
  },
};
