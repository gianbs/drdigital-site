// Blocos usados por várias telas.

import { esc, brl, dataBR, prazoTexto, iniciais } from '../util.js';
import { icon } from '../icons.js';
import { atrasado, nomeCliente } from '../calc.js';

/** Linha de um lançamento (receita, despesa ou transferência). */
export function linhaEntrada(e, { botao = false, data = false } = {}) {
  const rec = e.tipo === 'receita';
  const transf = e.tipo === 'transferencia';
  const parc = e.entrada ? 'Entrada' : e.parcelaTotal ? `${e.parcelaN}/${e.parcelaTotal}` : '';
  const quem = rec ? nomeCliente(e.clienteId) : e.fornecedor;
  const sub = [quem, e.categoria, parc && (e.entrada ? parc : `Parcela ${parc}`), e.fixoId && !e.parcelaTotal ? 'Fixo' : ''].filter(Boolean).join(' · ');
  const late = atrasado(e);
  let estado;
  if (transf) estado = dataBR(e.pagoEm);
  else if (e.pago) estado = `${icon('check')}${rec ? 'Recebido' : 'Pago'}${data ? ` ${dataBR(e.pagoEm)}` : ''}`;
  else estado = data ? `${dataBR(e.vencimento)} · ${prazoTexto(e.vencimento)}` : prazoTexto(e.vencimento);
  const comBotao = botao && !e.pago && !transf;
  const linhaEstado = `<small class="estado ${late ? 'txt-perigo' : e.pago ? 'ok' : ''}">${estado}</small>`;
  return `<div class="linha linha-toque" data-acao="editar-lanc" data-id="${esc(e.id)}" role="button" tabindex="0">
    <span class="bolha ${transf ? 'neutra' : rec ? 'entrada' : 'saida'}">${icon(transf ? 'transfer' : rec ? 'inflow' : 'outflow')}</span>
    <div class="linha-txt"><b>${esc(e.descricao)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}${comBotao ? linhaEstado : ''}</div>
    <div class="linha-fim">
      <span class="valor ${rec ? 'pos' : ''}">${transf ? '' : rec ? '+ ' : '− '}${brl(e.valor)}</span>
      ${comBotao ? `<button type="button" class="btn-pilula" data-acao="pagar" data-id="${esc(e.id)}">${rec ? 'Receber' : 'Pagar'}</button>` : linhaEstado}
    </div>
  </div>`;
}

export const avatar = (nome, tipo = '') => `<span class="avatar ${tipo}" aria-hidden="true">${esc(iniciais(nome))}</span>`;

export const cartao = (titulo, corpo, { sub = '', acao = '', classe = '' } = {}) =>
  `<section class="cartao ${classe}">
    <header class="cartao-topo"><div><h2>${esc(titulo)}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${acao}</header>
    ${corpo}
  </section>`;

export const tile = ({ rotulo, valor, sub = '', tipo = '', icone = '', rota = '', extra = '' }) =>
  `<${rota ? `a href="${rota}"` : 'div'} class="tile ${tipo}">
    <span class="tile-rotulo">${icone ? icon(icone) : ''}${esc(rotulo)}</span>
    <b class="tile-valor">${esc(valor)}</b>
    ${extra}
    ${sub ? `<span class="tile-sub">${sub}</span>` : ''}
  </${rota ? 'a' : 'div'}>`;
