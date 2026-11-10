// Aba "Mais" (iPhone): atalhos para as telas que não cabem na barra de abas.

import { store } from '../store.js';
import { esc, brl, sum } from '../util.js';
import { icon } from '../icons.js';
import { infoVenda, totalFixosMes } from '../calc.js';
import { estado, nuvemLigada } from '../sync.js';

const item = (rota, icone, titulo, sub) =>
  `<a class="linha linha-toque" href="${rota}"><span class="bolha marca">${icon(icone)}</span><div class="linha-txt"><b>${esc(titulo)}</b><small>${esc(sub)}</small></div>${icon('chevR', 'seta')}</a>`;

export default {
  titulo: 'Mais',
  render() {
    const vendas = store.all('vendas').map((v) => infoVenda(v)).filter((i) => i.status !== 'quitado');
    const nuvem = !nuvemLigada ? 'Modo local, só neste aparelho' : { ok: 'Sincronizado', sincronizando: 'Sincronizando…', offline: 'Sem internet', erro: 'Erro ao sincronizar' }[estado.status] || '';
    return `
      <section class="grupo"><div class="lista">
        ${item('#/vendas', 'vendas', 'Vendas parceladas', vendas.length ? `${vendas.length} em aberto · falta receber ${brl(sum(vendas, (i) => i.aberto))}` : 'Com ou sem entrada')}
        ${item('#/fixos', 'fixos', 'Gastos fixos', `${brl(totalFixosMes('despesa'))} neste mês`)}
        ${item('#/relatorios', 'relatorios', 'Relatórios', 'Resultado do ano e exportação para planilha')}
      </div></section>
      <section class="grupo"><div class="lista">
        ${item('#/ajustes', 'ajustes', 'Ajustes', nuvem)}
      </div></section>`;
  },
};
