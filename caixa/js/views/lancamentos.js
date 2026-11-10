// Lançamentos: tudo que entrou e saiu, mês a mês.

import { esc, brl, ymAtual, ymAdd, ymDe, mesNome, dataExtenso, semAcento, sum } from '../util.js';
import { icon } from '../icons.js';
import { trocaMes, segmentado, vazio } from '../ui.js';
import { entradas, dataEfetiva, nomeCliente } from '../calc.js';
import { linhaEntrada } from './comum.js';

let ym = ymAtual();
let filtro = 'todos';
let busca = '';

function lista() {
  const q = semAcento(busca.trim());
  let es = entradas(ym);
  if (q) {
    es = es.filter((e) => !e.virtual && semAcento([e.descricao, e.categoria, e.fornecedor, nomeCliente(e.clienteId), e.forma, e.obs].join(' ')).includes(q));
  } else {
    es = es.filter((e) => ymDe(dataEfetiva(e)) === ym);
  }
  if (filtro !== 'todos') es = es.filter((e) => e.tipo === filtro);
  es = es.slice().sort((a, b) => dataEfetiva(b).localeCompare(dataEfetiva(a)) || (b.criadoEm || '').localeCompare(a.criadoEm || ''));

  if (!es.length) {
    return q
      ? vazio('search', 'Nada encontrado', `Nenhum lançamento com “${busca.trim()}”.`)
      : vazio('lancamentos', 'Sem lançamentos', `Nada registrado em ${mesNome(ym)}.`, `<button class="btn" data-acao="novo">${icon('plus')}Novo lançamento</button>`);
  }
  const dias = new Map();
  for (const e of es) {
    const d = dataEfetiva(e);
    if (!dias.has(d)) dias.set(d, []);
    dias.get(d).push(e);
  }
  const limite = 400;
  let n = 0;
  let html = q ? `<p class="grupo-rodape">${es.length} ${es.length === 1 ? 'resultado' : 'resultados'} em todos os meses</p>` : '';
  for (const [d, itens] of dias) {
    if (n > limite) break;
    n += itens.length;
    const saldo = sum(itens.filter((e) => e.pago), (e) => (e.tipo === 'receita' ? e.valor : e.tipo === 'despesa' ? -e.valor : 0));
    html += `<section class="grupo"><h3 class="grupo-titulo dia"><span>${esc(dataExtenso(d))}</span>${saldo ? `<span>${saldo > 0 ? '+ ' : '− '}${brl(Math.abs(saldo))}</span>` : ''}</h3>
      <div class="lista">${itens.map((e) => linhaEntrada(e, { data: !!q })).join('')}</div></section>`;
  }
  return html;
}

function resumo() {
  const es = entradas(ym).filter((e) => ymDe(dataEfetiva(e)) === ym);
  const ent = sum(es.filter((e) => e.tipo === 'receita' && e.pago), (e) => e.valor);
  const sai = sum(es.filter((e) => e.tipo === 'despesa' && e.pago), (e) => e.valor);
  const pend = es.filter((e) => !e.pago && e.tipo !== 'transferencia').length;
  return `<div class="faixa-resumo">
    <div><span>Entradas</span><b class="pos">${brl(ent)}</b></div>
    <div><span>Saídas</span><b>${brl(sai)}</b></div>
    <div><span>Resultado</span><b class="${ent - sai < 0 ? 'txt-perigo' : ''}">${brl(ent - sai)}</b></div>
    <div><span>Pendentes</span><b>${pend}</b></div>
  </div>`;
}

export default {
  titulo: 'Lançamentos',
  render() {
    return `
      <div class="barra-filtros">
        ${trocaMes(mesNome(ym))}
        ${segmentado('filtro', [['todos', 'Tudo'], ['receita', 'Receitas'], ['despesa', 'Despesas']], filtro, 'data-muda="filtro"')}
      </div>
      <label class="busca">${icon('search')}<input type="search" placeholder="Buscar por descrição, cliente, categoria…" value="${esc(busca)}" data-digita="busca" aria-label="Buscar lançamentos"></label>
      ${resumo()}
      <div id="lista-lanc">${lista()}</div>`;
  },
  acoes: {
    'mes-antes': () => (ym = ymAdd(ym, -1)),
    'mes-depois': () => (ym = ymAdd(ym, 1)),
    'mes-hoje': () => (ym = ymAtual()),
  },
  mudou(nome, valor) {
    if (nome === 'filtro') filtro = valor;
  },
  digitou(nome, valor, el) {
    busca = valor;
    el.querySelector('#lista-lanc').innerHTML = lista();
  },
};
