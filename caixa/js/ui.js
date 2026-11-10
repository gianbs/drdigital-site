// Componentes de interface no padrão das diretrizes da Apple (HIG):
// folhas (sheets), alertas, menus de ações, listas agrupadas, controles segmentados, avisos.

import { $, $$, esc, parseMoney, num } from './util.js';
import { icon } from './icons.js';

const camadas = () => $('#camadas');
const abertas = [];

function travar() {
  document.documentElement.classList.toggle('travado', abertas.length > 0);
}

function fecharCamada(c) {
  const i = abertas.indexOf(c);
  if (i < 0) return;
  abertas.splice(i, 1);
  c.el.classList.add('saindo');
  setTimeout(() => c.el.remove(), 260);
  travar();
  c.aoFechar?.();
  c.foco?.focus?.();
}

function novaCamada(html, classe) {
  const el = document.createElement('div');
  el.className = 'camada ' + classe;
  el.innerHTML = html;
  camadas().appendChild(el);
  const c = { el, foco: document.activeElement };
  c.fechar = () => fecharCamada(c);
  abertas.push(c);
  travar();
  requestAnimationFrame(() => el.classList.add('aberta'));
  return c;
}

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && abertas.length) {
    ev.preventDefault();
    const topo = abertas[abertas.length - 1];
    topo.cancelar ? topo.cancelar() : topo.fechar();
  }
});

export const temCamadaAberta = () => abertas.length > 0;
export const fecharTodas = () => [...abertas].forEach(fecharCamada);

/**
 * Folha modal: sobe de baixo no iPhone, vira janela centralizada em telas grandes.
 * acao(folha) roda no botão principal; devolva false para manter aberta.
 */
export function abrirFolha({ titulo, corpo, acao, textoAcao = 'Salvar', textoCancelar = 'Cancelar', aoMontar, aoFechar, larga = false }) {
  const c = novaCamada(
    `<div class="fundo" data-fechar></div>
     <div class="folha ${larga ? 'larga' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
       <div class="folha-pega" aria-hidden="true"></div>
       <header class="folha-barra">
         <button type="button" class="btn-texto" data-fechar>${acao ? esc(textoCancelar) : 'Fechar'}</button>
         <h2>${esc(titulo)}</h2>
         ${acao ? `<button type="button" class="btn-texto forte" data-ok>${esc(textoAcao)}</button>` : '<span class="folha-vago"></span>'}
       </header>
       <form class="folha-corpo" novalidate autocomplete="off">${corpo}</form>
     </div>`,
    'camada-folha'
  );
  c.aoFechar = aoFechar;
  c.form = $('.folha-corpo', c.el);
  c.corpo = c.form;
  const ok = async () => {
    if (!acao) return;
    const r = await acao(c);
    if (r !== false) c.fechar();
  };
  c.el.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-fechar]')) c.fechar();
    else if (ev.target.closest('[data-ok]')) ok();
  });
  c.form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    ok();
  });
  aoMontar?.(c);
  const primeiro = $('[autofocus]', c.form);
  if (primeiro && matchMedia('(min-width: 900px)').matches) setTimeout(() => primeiro.focus(), 60);
  return c;
}

/** Alerta de confirmação no estilo iOS. Devolve uma Promise<boolean>. */
export function confirmar({ titulo, mensagem = '', ok = 'Excluir', cancelar = 'Cancelar', destrutivo = true }) {
  return new Promise((resolve) => {
    const c = novaCamada(
      `<div class="fundo"></div>
       <div class="alerta" role="alertdialog" aria-modal="true" aria-label="${esc(titulo)}">
         <div class="alerta-texto"><h2>${esc(titulo)}</h2>${mensagem ? `<p>${esc(mensagem)}</p>` : ''}</div>
         <div class="alerta-botoes">
           <button type="button" data-r="0">${esc(cancelar)}</button>
           <button type="button" data-r="1" class="${destrutivo ? 'perigo' : 'forte'}">${esc(ok)}</button>
         </div>
       </div>`,
      'camada-alerta'
    );
    c.cancelar = () => {
      c.fechar();
      resolve(false);
    };
    c.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-r]');
      if (!b) return;
      c.fechar();
      resolve(b.dataset.r === '1');
    });
    setTimeout(() => $('[data-r="0"]', c.el)?.focus(), 50);
  });
}

/** Menu de ações (action sheet). itens: [{ rotulo, icone, fn, perigo, sub }] */
export function menuAcoes(itens, titulo = '') {
  const c = novaCamada(
    `<div class="fundo" data-fechar></div>
     <div class="acoes" role="menu" aria-label="${esc(titulo || 'Ações')}">
       <div class="acoes-grupo">
         ${titulo ? `<div class="acoes-titulo">${esc(titulo)}</div>` : ''}
         ${itens.map((it, i) => `<button type="button" role="menuitem" data-i="${i}" class="${it.perigo ? 'perigo' : ''}">
             ${it.icone ? `<span class="acoes-ic">${icon(it.icone)}</span>` : ''}
             <span class="acoes-txt"><b>${esc(it.rotulo)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>
           </button>`).join('')}
       </div>
       <div class="acoes-grupo"><button type="button" class="cancelar" data-fechar>Cancelar</button></div>
     </div>`,
    'camada-acoes'
  );
  c.el.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-fechar]')) return c.fechar();
    const b = ev.target.closest('[data-i]');
    if (b) {
      c.fechar();
      itens[Number(b.dataset.i)].fn?.();
    }
  });
  return c;
}

let avisoTimer;
export function aviso(texto, { acao, rotulo = 'Desfazer', tipo = '' } = {}) {
  const box = $('#avisos');
  clearTimeout(avisoTimer);
  box.innerHTML = `<div class="aviso ${tipo}" role="status"><span>${esc(texto)}</span>${acao ? `<button type="button">${esc(rotulo)}</button>` : ''}</div>`;
  if (acao) $('button', box).onclick = () => {
    box.innerHTML = '';
    acao();
  };
  avisoTimer = setTimeout(() => (box.innerHTML = ''), acao ? 6000 : 3200);
}

// ---------- Listas agrupadas e campos de formulário ----------

export const grupo = (titulo, linhas, rodape = '') =>
  `<section class="grupo">${titulo ? `<h3 class="grupo-titulo">${esc(titulo)}</h3>` : ''}<div class="lista">${linhas}</div>${rodape ? `<p class="grupo-rodape">${rodape}</p>` : ''}</section>`;

export function campo({ rotulo, nome, tipo = 'text', valor = '', opcoes = [], dica = '', attrs = '', vazio }) {
  const id = `f-${nome}`;
  let ctl;
  if (tipo === 'select') {
    const ops = opcoes.map((o) => {
      const [v, t] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}" ${String(v) === String(valor) ? 'selected' : ''}>${esc(t)}</option>`;
    }).join('');
    ctl = `<span class="sel"><select id="${id}" name="${nome}" ${attrs}>${vazio !== undefined ? `<option value="">${esc(vazio)}</option>` : ''}${ops}</select>${icon('chevD')}</span>`;
  } else if (tipo === 'toggle') {
    ctl = `<input id="${id}" class="chave" type="checkbox" role="switch" name="${nome}" ${valor ? 'checked' : ''} ${attrs}>`;
  } else if (tipo === 'dinheiro') {
    ctl = `<span class="din"><i>R$</i><input id="${id}" name="${nome}" inputmode="numeric" data-dinheiro value="${valor ? num(valor) : ''}" placeholder="0,00" ${attrs}></span>`;
  } else if (tipo === 'textarea') {
    return `<label class="linha campo campo-area" for="${id}"><span class="campo-rotulo">${esc(rotulo)}</span><textarea id="${id}" name="${nome}" rows="2" placeholder="${esc(dica)}" ${attrs}>${esc(valor)}</textarea></label>`;
  } else {
    const modo = tipo === 'number' ? 'inputmode="numeric"' : '';
    ctl = `<input id="${id}" type="${tipo}" name="${nome}" value="${esc(valor)}" placeholder="${esc(dica)}" ${modo} ${attrs}>`;
  }
  return `<label class="linha campo" for="${id}"><span class="campo-rotulo">${esc(rotulo)}</span>${ctl}</label>`;
}

/** Controle segmentado. opcoes: [[valor, texto], ...] */
export function segmentado(nome, opcoes, valor, attrs = '') {
  return `<div class="seg" role="radiogroup" ${attrs}>${opcoes.map(([v, t]) =>
    `<label><input type="radio" name="${nome}" value="${esc(v)}" ${String(v) === String(valor) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>`;
}

/** Lê um formulário: dinheiro vira número, chaves viram true/false. */
export function lerForm(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'radio') {
      if (el.checked) o[el.name] = el.value;
    } else if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.dataset.dinheiro !== undefined) o[el.name] = parseMoney(el.value);
    else if (el.type === 'number') o[el.name] = Number(el.value) || 0;
    else o[el.name] = el.value.trim();
  }
  return o;
}

export function erroCampo(form, nome, texto) {
  const el = form.elements[nome];
  const alvo = el?.length && !el.tagName ? el[0] : el;
  aviso(texto, { tipo: 'erro' });
  alvo?.closest('.linha')?.classList.add('invalido');
  alvo?.focus?.();
  return false;
}

// Máscara de dinheiro: digita-se só números e os centavos entram sozinhos (1234 -> 12,34).
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset?.dinheiro === undefined) return;
  const d = el.value.replace(/\D/g, '').replace(/^0+/, '');
  el.value = d ? num(Number(d) / 100) : '';
  el.closest('.linha')?.classList.remove('invalido');
});
document.addEventListener('input', (ev) => ev.target.closest?.('.linha.invalido')?.classList.remove('invalido'));

// ---------- Dica flutuante dos gráficos ----------
let dica;
function mostrarDica(alvo, x, y) {
  if (!dica) {
    dica = document.createElement('div');
    dica.className = 'dica';
    dica.setAttribute('role', 'tooltip');
    document.body.appendChild(dica);
  }
  dica.innerHTML = alvo.dataset.dica;
  dica.hidden = false;
  const r = dica.getBoundingClientRect();
  const px = Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2));
  const py = y - r.height - 14 < 8 ? y + 18 : y - r.height - 14;
  dica.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`;
}
export const esconderDica = () => dica && (dica.hidden = true);
document.addEventListener('pointermove', (ev) => {
  const a = ev.target.closest?.('[data-dica]');
  a ? mostrarDica(a, ev.clientX, ev.clientY) : esconderDica();
});
document.addEventListener('pointerdown', (ev) => {
  const a = ev.target.closest?.('[data-dica]');
  a ? mostrarDica(a, ev.clientX, ev.clientY) : esconderDica();
});
document.addEventListener('focusin', (ev) => {
  const a = ev.target.closest?.('[data-dica]');
  if (!a) return esconderDica();
  const r = a.getBoundingClientRect();
  mostrarDica(a, r.left + r.width / 2, r.top);
});
addEventListener('scroll', esconderDica, true);

// ---------- Pequenos blocos reutilizados pelas telas ----------

export const selo = (texto, tipo = '', icone = '') => `<span class="selo ${tipo}">${icone ? icon(icone) : ''}${esc(texto)}</span>`;

export const vazio = (icone, titulo, texto, botao = '') =>
  `<div class="vazio"><div class="vazio-ic">${icon(icone)}</div><h3>${esc(titulo)}</h3><p>${esc(texto)}</p>${botao}</div>`;

export function trocaMes(rotulo, { acaoAntes = 'mes-antes', acaoDepois = 'mes-depois', acaoHoje = 'mes-hoje' } = {}) {
  return `<div class="troca-mes">
    <button type="button" class="btn-ic" data-acao="${acaoAntes}" aria-label="Mês anterior">${icon('chevL')}</button>
    <button type="button" class="troca-rotulo" data-acao="${acaoHoje}" title="Voltar para o mês atual">${esc(rotulo)}</button>
    <button type="button" class="btn-ic" data-acao="${acaoDepois}" aria-label="Próximo mês">${icon('chevR')}</button>
  </div>`;
}

export { $, $$ };
