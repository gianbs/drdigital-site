// Painel: como está o mês, o caixa e os clientes.

import { store, config } from '../store.js';
import { esc, brl, brlCurto, pct, ymAtual, ymAdd, mesNome, mesSo, mesCurto, dataBR, dataCurta, hoje, addDias } from '../util.js';
import { icon } from '../icons.js';
import { trocaMes, selo, vazio } from '../ui.js';
import { resumoMes, saude, serieMeses, porCategoria, saldos, totaisAbertos, painelClientes, abertos, projecao, infoFixo, totalFixosMes, ehRD } from '../calc.js';
import { colunasDuplas, linhaSaldo, barrasH, medidor, legenda } from '../charts.js';
import { linhaEntrada, avatar, cartao, tile } from './comum.js';

let ym = ymAtual();

const ICONE_NIVEL = { bom: 'checkCircle', atencao: 'info', alerta: 'warn', critico: 'alert', neutro: 'minus' };

function heroi(r) {
  const s = saude(r);
  const ant = resumoMes(ymAdd(ym, -1));
  const dif = r.lucro - ant.lucro;
  const temAnt = ym < ymAtual() && (ant.recebido || ant.pago);
  const futuro = ym >= ymAtual() && (r.aReceber || r.aPagar);
  return `<section class="cartao heroi nivel-${s.nivel}">
    <div class="heroi-topo"><span class="rotulo">Resultado de ${esc(mesNome(ym))}</span>${selo(s.titulo, s.nivel, ICONE_NIVEL[s.nivel])}</div>
    <div class="heroi-num">${brl(r.lucro)}</div>
    <p class="heroi-txt">${esc(s.texto)}${temAnt ? ` ${dif >= 0 ? `${brl(dif)} a mais` : `${brl(-dif)} a menos`} que em ${esc(mesSo(ymAdd(ym, -1)))}.` : ''}</p>
    <div class="heroi-linha">
      <div><span><i class="p1"></i>Receitas recebidas</span><b>${brl(r.recebido)}</b></div>
      <div><span><i class="p2"></i>Despesas pagas</span><b>${brl(r.pago)}</b></div>
      <div><span>Margem</span><b>${r.margem === null ? '–' : pct(r.margem)}</b></div>
    </div>
    ${futuro ? `<p class="heroi-prev">${icon('clock')}<span>Ainda neste mês: <b>${brl(r.aReceber)}</b> a receber e <b>${brl(r.aPagar)}</b> a pagar. Se tudo se confirmar, o mês fecha em <b>${brl(r.previsto)}</b>.</span></p>` : ''}
  </section>`;
}

function tiles(r) {
  const sd = saldos();
  const rec = totaisAbertos('receita');
  const pag = totaisAbertos('despesa');
  const meta = config().metaMensal || 0;
  return `<div class="tiles">
    ${tile({
      rotulo: 'Saldo em caixa', icone: 'wallet', valor: brl(sd.total), tipo: sd.total < 0 ? 'critico' : '', rota: '#/ajustes',
      sub: sd.porConta.map((c) => `${esc(c.conta.nome.split(' ')[0])} ${brlCurto(c.saldo)}`).join(' · '),
    })}
    ${tile({
      rotulo: 'A receber', icone: 'inflow', valor: brl(rec.total), rota: '#/contas',
      sub: rec.atrasado > 0 ? `<span class="txt-perigo">${icon('alert')}${brl(rec.atrasado)} em atraso</span>` : rec.total > 0 ? `<span class="ok">${icon('check')}Nada em atraso</span>` : 'Nenhuma parcela em aberto',
    })}
    ${tile({
      rotulo: 'A pagar em 30 dias', icone: 'outflow', valor: brl(pag.atrasado + pag.em30), rota: '#/contas/pagar',
      sub: pag.atrasado > 0 ? `<span class="txt-perigo">${icon('alert')}${brl(pag.atrasado)} atrasado</span>` : pag.em7 > 0 ? `${brl(pag.em7)} nos próximos 7 dias` : 'Nada para esta semana',
    })}
    ${tile({
      rotulo: `Vendido em ${mesSo(ym)}`, icone: 'target', valor: brl(r.vendido), rota: '#/ajustes',
      extra: meta ? medidor(r.vendido / meta, { tipo: r.vendido >= meta ? 'bom' : '', rotulo: 'Meta do mês' }) : '',
      sub: meta ? (r.vendido >= meta ? `<span class="ok">${icon('check')}Meta de ${brlCurto(meta)} batida</span>` : `${pct(r.vendido / meta)} da meta de ${brlCurto(meta)}`) : 'Defina uma meta mensal',
    })}
  </div>`;
}

function clientes() {
  const p = painelClientes();
  if (!store.all('clientes').length) {
    return cartao('Pagamentos dos clientes', vazio('users', 'Nenhum cliente ainda', 'Cadastre clientes e vendas parceladas para acompanhar quem está em dia.', `<button class="btn" data-acao="novo-cliente">Cadastrar cliente</button>`));
  }
  if (!p.comParcelas) {
    return cartao('Pagamentos dos clientes', `<p class="destaque-ok">${icon('checkCircle')}<span>Nenhum cliente com parcela em aberto.</span></p>`);
  }
  const fr = p.emDia.length / p.comParcelas;
  const corpo = `
    <p class="frase"><b>${p.emDia.length} de ${p.comParcelas}</b> ${p.comParcelas === 1 ? 'cliente com parcelas está' : 'clientes com parcelas estão'} em dia.</p>
    <div class="fatias" role="img" aria-label="${p.emDia.length} em dia e ${p.emAtraso.length} em atraso">
      ${p.emDia.length ? `<i class="bom" style="flex:${p.emDia.length}"></i>` : ''}${p.emAtraso.length ? `<i class="critico" style="flex:${p.emAtraso.length}"></i>` : ''}
    </div>
    <div class="duas">
      <div><span class="ok">${icon('checkCircle')}Em dia</span><b>${p.emDia.length}</b><small>${brl(p.valorEmDia)} a vencer</small></div>
      <div><span class="txt-perigo">${icon('alert')}Em atraso</span><b>${p.emAtraso.length}</b><small>${brl(p.valorAtrasado)} vencidos</small></div>
    </div>
    ${p.emAtraso.length ? `<div class="lista lista-interna">${p.emAtraso.slice(0, 4).map((s) => `
      <div class="linha linha-toque" data-acao="ir" data-rota="#/clientes/${s.cliente.id}" role="button" tabindex="0">
        ${avatar(s.cliente.nome, 'critico')}
        <div class="linha-txt"><b>${esc(s.cliente.nome)}</b><small class="txt-perigo">${brl(s.atrasado)} · há ${s.diasAtraso} ${s.diasAtraso === 1 ? 'dia' : 'dias'}</small></div>
        <button type="button" class="btn-pilula" data-acao="cobrar" data-id="${s.cliente.id}">${icon('message')}Cobrar</button>
      </div>`).join('')}</div>` : ''}`;
  return cartao('Pagamentos dos clientes', corpo, { acao: `<a class="link" href="#/clientes">Ver todos</a>`, classe: fr < 1 ? '' : 'tudo-ok' });
}

function vencimentos() {
  const lim = addDias(hoje(), 15);
  const lista = [...abertos('receita'), ...abertos('despesa')].filter((e) => e.vencimento <= lim)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 7);
  const corpo = lista.length
    ? `<div class="lista lista-interna">${lista.map((e) => linhaEntrada(e, { botao: true })).join('')}</div>`
    : `<p class="destaque-ok">${icon('checkCircle')}<span>Nada vencendo nos próximos 15 dias.</span></p>`;
  return cartao('Próximos vencimentos', corpo, { sub: 'Contas a receber e a pagar até 15 dias', acao: `<a class="link" href="#/contas">Ver todas</a>` });
}

function fixos() {
  const lista = store.all('fixos').filter((f) => (f.tipo || 'despesa') === 'despesa').map((f) => ({ f, i: infoFixo(f) })).filter((x) => !x.i.encerrado);
  if (!lista.length) return '';
  const parc = lista.filter((x) => x.f.parcelado).sort((a, b) => a.i.fim.localeCompare(b.i.fim));
  const corpo = `
    <p class="frase"><b>${brl(totalFixosMes('despesa'))}</b> em gastos fixos neste mês${parc.length ? `, sendo ${parc.length} ${parc.length === 1 ? 'parcelamento' : 'parcelamentos'}` : ''}.</p>
    ${parc.length ? `<div class="lista lista-interna">${parc.slice(0, 4).map(({ f, i }) => `
      <div class="linha linha-toque linha-alta" data-acao="editar-fixo" data-id="${f.id}" role="button" tabindex="0">
        <div class="linha-txt"><b>${esc(f.descricao)}</b>
          <small>Parcela ${i.atual} de ${i.total} · acaba em ${esc(mesCurto(i.fim))}</small>
          ${medidor(i.quitadas / i.total, { rotulo: 'Parcelas pagas' })}
        </div>
        <div class="linha-fim"><span class="valor">${brl(f.valor)}</span><small class="estado">faltam ${brlCurto(i.valorRestante)}</small></div>
      </div>`).join('')}</div>` : ''}`;
  return cartao('Gastos fixos e parcelamentos', corpo, { acao: `<a class="link" href="#/fixos">Ver todos</a>` });
}

export default {
  titulo: 'Resumo',
  render() {
    const r = resumoMes(ym);
    const temDados = store.all('lancamentos').length || store.all('fixos').length;
    const cat = porCategoria('despesa', ym);
    const pj = projecao(90);
    const neg = pj.menor.saldo < 0;
    return `
      <div class="barra-filtros">${trocaMes(mesNome(ym))}</div>
      ${!temDados ? `<section class="cartao boas-vindas">
        <h2>Comece pelo primeiro lançamento</h2>
        <p>Registre uma receita, uma despesa ou uma venda parcelada. O painel se monta sozinho conforme você usa.</p>
        <div class="botoes"><button class="btn" data-acao="novo">${icon('plus')}Novo lançamento</button><button class="btn sec" data-acao="exemplo">Ver com dados de exemplo</button></div>
      </section>` : ''}
      <div class="painel painel-2">
        <div class="col">
          ${heroi(r)}
          ${clientes()}
          ${vencimentos()}
          ${fixos()}
        </div>
        <div class="col">
          ${tiles(r)}
          ${cartao('Receitas e despesas', `${legenda([[1, 'Receitas recebidas'], [2, 'Despesas pagas']])}<div class="grafico" data-grafico="meses"></div>`, { sub: 'Últimos 6 meses' })}
          ${cartao('Para onde vai o dinheiro', cat.length ? barrasH(cat, { serie: 2 }) : `<p class="fraco">Nenhuma despesa paga em ${esc(mesNome(ym))}.</p>`, { sub: `Despesas pagas em ${esc(mesNome(ym))}, por categoria` })}
          ${cartao('Compromissos dos próximos 90 dias', `
            <p class="frase">${neg
              ? `Só com o que já está lançado, o saldo ficaria negativo em <b>${esc(dataCurta(pj.menor.data))}</b>. Faltam <b>${brl(-pj.menor.saldo)}</b> em vendas novas para cobrir as contas até lá.`
              : `Só com o que já está lançado, o saldo em 90 dias seria de <b>${brl(pj.final.saldo)}</b>.`}</p>
            <div class="grafico" data-grafico="projecao"></div>`, { sub: 'Saldo de hoje, mais o que há a receber, menos o que há a pagar. Vendas futuras não entram.' })}
        </div>
      </div>`;
  },
  montar(el) {
    const g1 = el.querySelector('[data-grafico="meses"]');
    if (g1) colunasDuplas(g1, serieMeses(6, ym).map((m) => ({ rotulo: mesSo(m.ym), titulo: mesNome(m.ym), a: m.recebido, b: m.pago, destaque: m.ym === ym })));
    const g2 = el.querySelector('[data-grafico="projecao"]');
    if (g2) linhaSaldo(g2, projecao(90).pontos);
  },
  acoes: {
    'mes-antes': () => (ym = ymAdd(ym, -1)),
    'mes-depois': () => (ym = ymAdd(ym, 1)),
    'mes-hoje': () => (ym = ymAtual()),
  },
};
