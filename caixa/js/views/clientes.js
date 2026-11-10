// Clientes: lista com situação de pagamento e ficha de cada um.

import { store } from '../store.js';
import { esc, brl, dataBR, semAcento, linkWhats, soDigitos } from '../util.js';
import { icon } from '../icons.js';
import { segmentado, vazio, selo, grupo } from '../ui.js';
import { situacaoClientes, entradas, dataEfetiva } from '../calc.js';
import { linhaEntrada, avatar } from './comum.js';

let filtro = 'todos';
let busca = '';

const SELO = {
  atraso: () => selo('Em atraso', 'critico', 'alert'),
  emdia: () => selo('Em dia', 'bom', 'checkCircle'),
  quitado: () => selo('Quitado', 'neutro', 'check'),
  novo: () => selo('Sem compras', 'neutro'),
};

function lista() {
  const q = semAcento(busca.trim());
  const ordem = { atraso: 0, emdia: 1, quitado: 2, novo: 3 };
  const todos = [...situacaoClientes().values()]
    .filter((s) => (filtro === 'todos' ? true : s.status === filtro))
    .filter((s) => !q || semAcento([s.cliente.nome, s.cliente.telefone, s.cliente.doc].join(' ')).includes(q))
    .sort((a, b) => (filtro === 'todos' && !q ? 0 : ordem[a.status] - ordem[b.status]) || a.cliente.nome.localeCompare(b.cliente.nome, 'pt-BR'));
  if (!todos.length) {
    return store.all('clientes').length
      ? vazio('search', 'Nenhum cliente aqui', q ? `Nada encontrado para “${busca.trim()}”.` : 'Nenhum cliente nessa situação.')
      : vazio('clientes', 'Nenhum cliente', 'Cadastre seus clientes para registrar vendas e acompanhar pagamentos.', `<button class="btn" data-acao="novo-cliente">${icon('plus')}Novo cliente</button>`);
  }
  return `<section class="grupo"><div class="lista">${todos.map((s) => `
    <a class="linha linha-toque" href="#/clientes/${s.cliente.id}">
      ${avatar(s.cliente.nome, s.status === 'atraso' ? 'critico' : '')}
      <div class="linha-txt"><b>${esc(s.cliente.nome)}</b>
        <small class="${s.status === 'atraso' ? 'txt-perigo' : ''}">${s.status === 'atraso' ? `${brl(s.atrasado)} em atraso há ${s.diasAtraso} ${s.diasAtraso === 1 ? 'dia' : 'dias'}`
          : s.aberto > 0 ? `${brl(s.aberto)} a vencer · próxima em ${dataBR(s.proxima.vencimento)}`
          : s.total > 0 ? `${brl(s.total)} em compras` : esc(s.cliente.telefone || 'Sem compras ainda')}</small>
      </div>
      ${SELO[s.status]()}
      ${icon('chevR', 'seta')}
    </a>`).join('')}</div></section>`;
}

function ficha(id) {
  const s = situacaoClientes().get(id);
  if (!s) return vazio('user', 'Cliente não encontrado', 'Ele pode ter sido excluído.', `<a class="btn" href="#/clientes">Voltar para clientes</a>`);
  const c = s.cliente;
  const es = entradas().filter((e) => e.clienteId === id && e.tipo === 'receita');
  const abertas = es.filter((e) => !e.pago).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const pagas = es.filter((e) => e.pago).sort((a, b) => dataEfetiva(b).localeCompare(dataEfetiva(a)));
  const vendas = store.all('vendas').filter((v) => v.clienteId === id).sort((a, b) => b.data.localeCompare(a.data));
  const tel = soDigitos(c.telefone);
  const info = [c.telefone, c.doc, c.email, c.endereco].filter(Boolean);
  return `
    <a class="voltar" href="#/clientes">${icon('chevL')}Clientes</a>
    <section class="cartao ficha">
      ${avatar(c.nome, s.status === 'atraso' ? 'critico grande' : 'grande')}
      <div class="ficha-txt"><h2>${esc(c.nome)}</h2>${SELO[s.status]()}${info.length ? `<p>${info.map(esc).join(' · ')}</p>` : ''}${c.obs ? `<p class="fraco">${esc(c.obs)}</p>` : ''}</div>
      <div class="ficha-botoes">
        ${tel ? `<a class="btn-redondo" href="${esc(linkWhats(c.telefone, ''))}" target="_blank" rel="noopener">${icon('message')}<span>WhatsApp</span></a><a class="btn-redondo" href="tel:+55${tel}">${icon('phone')}<span>Ligar</span></a>` : ''}
        <button class="btn-redondo" data-acao="nova-venda" data-cliente="${c.id}">${icon('layers')}<span>Vender</span></button>
        <button class="btn-redondo" data-acao="editar-cliente" data-id="${c.id}">${icon('edit')}<span>Editar</span></button>
      </div>
    </section>
    <div class="tiles">
      <div class="tile"><span class="tile-rotulo">Total em compras</span><b class="tile-valor">${brl(s.total)}</b><span class="tile-sub">${s.ultima ? `Última em ${dataBR(s.ultima)}` : 'Nenhuma compra'}</span></div>
      <div class="tile"><span class="tile-rotulo">Já pagou</span><b class="tile-valor">${brl(s.recebido)}</b><span class="tile-sub">${pagas.length} ${pagas.length === 1 ? 'pagamento' : 'pagamentos'}</span></div>
      <div class="tile"><span class="tile-rotulo">Em aberto</span><b class="tile-valor">${brl(s.aberto)}</b><span class="tile-sub">${s.nAbertas} ${s.nAbertas === 1 ? 'parcela' : 'parcelas'}</span></div>
      <div class="tile ${s.atrasado ? 'critico' : ''}"><span class="tile-rotulo">${s.atrasado ? icon('alert') : icon('checkCircle')}Em atraso</span><b class="tile-valor">${brl(s.atrasado)}</b><span class="tile-sub">${s.atrasado ? `há ${s.diasAtraso} ${s.diasAtraso === 1 ? 'dia' : 'dias'}` : 'Pagamentos em dia'}</span></div>
    </div>
    ${s.atrasado ? `<button class="btn largo" data-acao="cobrar" data-id="${c.id}">${icon('message')}Cobrar ${brl(s.atrasado)} pelo WhatsApp</button>` : ''}
    ${abertas.length ? grupo('Em aberto', abertas.map((e) => linhaEntrada(e, { botao: true, data: true })).join('')) : ''}
    ${vendas.length ? grupo('Vendas parceladas', vendas.map((v) => `
      <div class="linha linha-toque" data-acao="abrir-venda" data-id="${v.id}" role="button" tabindex="0">
        <div class="linha-txt"><b>${esc(v.descricao)}</b><small>${dataBR(v.data)} · ${v.entradaValor ? 'entrada + ' : ''}${v.nParcelas}x</small></div>
        <span class="valor">${brl(v.total)}</span>${icon('chevR', 'seta')}
      </div>`).join('')) : ''}
    ${pagas.length ? grupo('Pagamentos recebidos', pagas.slice(0, 50).map((e) => linhaEntrada(e, { data: true })).join('')) : ''}
    ${!es.length ? vazio('receipt', 'Sem compras ainda', 'Registre uma venda para este cliente.', `<button class="btn" data-acao="nova-venda" data-cliente="${c.id}">${icon('plus')}Nova venda parcelada</button>`) : ''}`;
}

export default {
  titulo: 'Clientes',
  tituloDe(param) {
    return param ? store.get(param)?.nome || 'Cliente' : 'Clientes';
  },
  render(param) {
    if (param) return ficha(param);
    const m = [...situacaoClientes().values()];
    const n = (st) => m.filter((s) => s.status === st).length;
    return `
      <div class="barra-filtros">
        ${segmentado('filtro', [['todos', `Todos ${m.length}`], ['atraso', `Em atraso ${n('atraso')}`], ['emdia', `Em dia ${n('emdia')}`]], filtro, 'data-muda="filtro"')}
        <button class="btn so-largo" data-acao="novo-cliente">${icon('plus')}Novo cliente</button>
      </div>
      <label class="busca">${icon('search')}<input type="search" placeholder="Buscar cliente" value="${esc(busca)}" data-digita="busca" aria-label="Buscar cliente"></label>
      <div id="lista-cli">${lista()}</div>`;
  },
  mudou(nome, valor) {
    if (nome === 'filtro') filtro = valor;
  },
  digitou(nome, valor, el) {
    busca = valor;
    el.querySelector('#lista-cli').innerHTML = lista();
  },
};
