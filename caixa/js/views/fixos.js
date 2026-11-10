// Gastos fixos e receitas recorrentes, com parcelamentos e data de término.

import { store } from '../store.js';
import { esc, brl, mesCurto, mesNome, ymAtual, sum, dataBR } from '../util.js';
import { icon } from '../icons.js';
import { segmentado, vazio, selo } from '../ui.js';
import { infoFixo, atrasado, nomeCliente } from '../calc.js';
import { medidor } from '../charts.js';

let tipo = 'despesa';

function linha(f, i) {
  const desp = tipo === 'despesa';
  const m = i.doMes;
  let estado = '';
  if (i.encerrado) estado = selo(f.ativo === false ? 'Pausado' : 'Encerrado', 'neutro');
  else if (!m) estado = selo(f.inicio > ymAtual() ? `Começa em ${mesCurto(f.inicio)}` : 'Sem cobrança este mês', 'neutro');
  else if (m.ignorado) estado = selo('Pulado este mês', 'neutro');
  else if (m.pago) estado = selo(desp ? 'Pago este mês' : 'Recebido este mês', 'bom', 'checkCircle');
  else if (atrasado(m)) estado = selo('Atrasado', 'critico', 'alert');
  else estado = selo(`Vence dia ${Number(m.vencimento.slice(8))}`, 'atencao', 'clock');
  const quem = desp ? f.fornecedor : nomeCliente(f.clienteId);
  const det = f.parcelado
    ? `Parcela ${i.atual} de ${i.total} · acaba em ${mesNome(i.fim)}`
    : i.fim ? `Todo mês até ${mesNome(i.fim)}` : 'Todo mês, sem data para acabar';
  return `<div class="linha linha-toque linha-alta" data-acao="editar-fixo" data-id="${f.id}" role="button" tabindex="0">
    <span class="bolha ${f.parcelado ? 'marca' : 'neutra'}">${icon(f.parcelado ? 'card' : 'repeat')}</span>
    <div class="linha-txt">
      <b>${esc(f.descricao)}</b>
      <small>${esc([quem, f.categoria].filter(Boolean).join(' · ') || 'Sem categoria')}</small>
      <small>${esc(det)}</small>
      ${f.parcelado ? `${medidor(i.quitadas / i.total, { rotulo: 'Parcelas pagas' })}<small>${i.restantes ? `Faltam ${i.restantes} ${i.restantes === 1 ? 'parcela' : 'parcelas'} (${brl(i.valorRestante)})` : 'Todas as parcelas pagas'}</small>` : ''}
    </div>
    <div class="linha-fim">
      <span class="valor">${brl(f.valor)}</span>
      <small class="estado">por mês</small>
      ${estado}
      ${m && !m.pago && !m.ignorado && !i.encerrado ? `<button type="button" class="btn-pilula" data-acao="pagar" data-id="${esc(m.id)}">${desp ? 'Pagar' : 'Receber'}</button>` : ''}
    </div>
  </div>`;
}

export default {
  titulo: 'Gastos fixos',
  render() {
    const desp = tipo === 'despesa';
    const todos = store.all('fixos').filter((f) => (f.tipo || 'despesa') === tipo).map((f) => ({ f, i: infoFixo(f) }));
    const ativos = todos.filter((x) => !x.i.encerrado).sort((a, b) => (a.f.dia || 0) - (b.f.dia || 0));
    const fim = todos.filter((x) => x.i.encerrado);
    const doMes = ativos.map((x) => x.i.doMes).filter((m) => m && !m.ignorado);
    const total = sum(doMes, (m) => m.valor);
    const pago = sum(doMes.filter((m) => m.pago), (m) => m.valor);
    const parc = ativos.filter((x) => x.f.parcelado);
    const proxFim = parc.slice().sort((a, b) => a.i.fim.localeCompare(b.i.fim))[0];
    return `
      <div class="barra-filtros">
        ${segmentado('tipo', [['despesa', 'Gastos fixos'], ['receita', 'Receitas recorrentes']], tipo, 'data-muda="tipo"')}
        <button class="btn so-largo" data-acao="novo-fixo" data-tipo="${tipo}">${icon('plus')}Novo</button>
      </div>
      <div class="tiles tiles-3">
        <div class="tile"><span class="tile-rotulo">${desp ? 'Compromisso deste mês' : 'Previsto neste mês'}</span><b class="tile-valor">${brl(total)}</b>
          ${medidor(total ? pago / total : 0, { tipo: 'bom', rotulo: desp ? 'Pago' : 'Recebido' })}
          <span class="tile-sub">${brl(pago)} ${desp ? 'já pagos' : 'já recebidos'}</span></div>
        <div class="tile"><span class="tile-rotulo">Parcelamentos</span><b class="tile-valor">${parc.length}</b><span class="tile-sub">${parc.length ? `${brl(sum(parc, (x) => x.i.valorRestante))} ainda a ${desp ? 'pagar' : 'receber'}` : 'Nenhum em andamento'}</span></div>
        <div class="tile"><span class="tile-rotulo">Próximo a acabar</span><b class="tile-valor">${proxFim ? esc(mesCurto(proxFim.i.fim)) : '–'}</b><span class="tile-sub">${proxFim ? `${esc(proxFim.f.descricao)}: libera ${brl(proxFim.f.valor)}/mês` : 'Sem parcelamentos'}</span></div>
      </div>
      ${ativos.length ? `<section class="grupo"><div class="lista">${ativos.map((x) => linha(x.f, x.i)).join('')}</div></section>`
        : vazio('fixos', desp ? 'Nenhum gasto fixo' : 'Nenhuma receita recorrente',
          desp ? 'Cadastre aluguel, energia, internet, salários e parcelamentos. Eles entram sozinhos nas contas a pagar de cada mês.' : 'Cadastre contratos mensais de clientes. Eles entram sozinhos nas contas a receber.',
          `<button class="btn" data-acao="novo-fixo" data-tipo="${tipo}">${icon('plus')}${desp ? 'Novo gasto fixo' : 'Nova receita recorrente'}</button>`)}
      ${fim.length ? `<section class="grupo"><h3 class="grupo-titulo">Encerrados e pausados</h3><div class="lista">${fim.map((x) => linha(x.f, x.i)).join('')}</div></section>` : ''}`;
  },
  mudou(nome, valor) {
    if (nome === 'tipo') tipo = valor;
  },
};
