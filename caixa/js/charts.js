// Gráficos em SVG desenhados à mão (sem biblioteca). Cores vêm das variáveis --serie-N do CSS.

import { esc, brl, brlCurto, dataCurta, pct } from './util.js';

/** Escolhe um teto "redondo" e as linhas de grade do eixo. */
function escala(min, max, linhas = 4) {
  if (max <= min) max = min + 1;
  const bruto = (max - min) / linhas;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) || bruto;
  const lo = Math.floor(min / passo) * passo;
  const hi = Math.ceil(max / passo) * passo;
  const marcas = [];
  for (let v = lo; v <= hi + passo / 2; v += passo) marcas.push(Math.round(v * 100) / 100);
  return { lo, hi, marcas };
}

/** Coluna com topo arredondado e base reta. */
function coluna(x, y, w, h, r = 4) {
  if (h <= 0.5) return '';
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}a${r},${r} 0 0 1 ${r},-${r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${y + h}Z`;
}

/**
 * Colunas lado a lado (Receitas x Despesas por mês).
 * dados: [{ rotulo, a, b }]
 */
export function colunasDuplas(el, dados, { nomes = ['Receitas', 'Despesas'], altura = 220 } = {}) {
  const W = Math.max(280, el.clientWidth);
  const H = altura;
  const m = { t: 12, r: 8, b: 26, l: 52 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const { hi, marcas } = escala(0, Math.max(1, ...dados.flatMap((d) => [d.a, d.b])));
  const y = (v) => m.t + ih - (v / hi) * ih;
  const banda = iw / dados.length;
  const bw = Math.max(6, Math.min(24, (banda - 14) / 2));
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(nomes.join(' e '))} por mês">`;
  for (const v of marcas) {
    s += `<line class="g-grade" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="g-eixo" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${esc(brlCurto(v))}</text>`;
  }
  dados.forEach((d, i) => {
    const cx = m.l + banda * i + banda / 2;
    const dica = `<b>${esc(d.titulo || d.rotulo)}</b><span><i class="p1"></i>${esc(nomes[0])}<em>${brl(d.a)}</em></span><span><i class="p2"></i>${esc(nomes[1])}<em>${brl(d.b)}</em></span><span class="tot">Resultado<em>${brl(d.a - d.b)}</em></span>`;
    s += `<g class="g-banda" tabindex="0" data-dica="${esc(dica)}">
      <rect class="g-alvo" x="${m.l + banda * i}" y="${m.t}" width="${banda}" height="${ih + m.b}" rx="6"/>
      <path class="g-s1" d="${coluna(cx - bw - 1, y(d.a), bw, y(0) - y(d.a))}"/>
      <path class="g-s2" d="${coluna(cx + 1, y(d.b), bw, y(0) - y(d.b))}"/>
      <text class="g-eixo ${d.destaque ? 'forte' : ''}" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(d.rotulo)}</text>
    </g>`;
  });
  s += `<line class="g-base" x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}"/></svg>`;
  el.innerHTML = s;
}

/** Linha de saldo projetado. pontos: [{ data, saldo }] */
export function linhaSaldo(el, pontos, { altura = 200 } = {}) {
  const W = Math.max(280, el.clientWidth);
  const H = altura;
  const m = { t: 14, r: 14, b: 26, l: 56 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const vals = pontos.map((p) => p.saldo);
  const { lo, hi, marcas } = escala(Math.min(0, ...vals), Math.max(1, ...vals));
  const x = (i) => m.l + (i / (pontos.length - 1)) * iw;
  const y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
  const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.saldo).toFixed(1)}`).join('');
  const ult = pontos.length - 1;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Projeção do saldo em caixa">`;
  for (const v of marcas) {
    s += `<line class="${v === 0 ? 'g-base' : 'g-grade'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="g-eixo" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${esc(brlCurto(v))}</text>`;
  }
  const passo = Math.round(ult / 3);
  for (let i = 0; i <= ult; i += passo) {
    s += `<text class="g-eixo" x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i >= ult - 1 ? 'end' : 'middle'}">${i === 0 ? 'Hoje' : esc(dataCurta(pontos[i].data))}</text>`;
  }
  s += `<path class="g-area3" d="${caminho}L${x(ult)},${y(Math.max(lo, 0))}L${x(0)},${y(Math.max(lo, 0))}Z"/>
        <path class="g-linha3" d="${caminho}"/>
        <circle class="g-ponto3" cx="${x(ult)}" cy="${y(pontos[ult].saldo)}" r="5"/>
        <g class="g-mira" hidden><line y1="${m.t}" y2="${m.t + ih}"/><circle class="g-ponto3" r="5"/></g>
        <rect class="g-captura" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" tabindex="0" aria-label="Passe o dedo ou o mouse para ver o saldo em cada dia"/>
      </svg><div class="dica dica-fixa" hidden></div>`;
  el.innerHTML = s;
  const mira = el.querySelector('.g-mira');
  const dica = el.querySelector('.dica-fixa');
  const alvo = el.querySelector('.g-captura');
  const mostrar = (i) => {
    i = Math.max(0, Math.min(ult, i));
    const p = pontos[i];
    mira.hidden = false;
    mira.querySelector('line').setAttribute('x1', x(i));
    mira.querySelector('line').setAttribute('x2', x(i));
    mira.querySelector('circle').setAttribute('cx', x(i));
    mira.querySelector('circle').setAttribute('cy', y(p.saldo));
    dica.hidden = false;
    dica.innerHTML = `<b>${i === 0 ? 'Hoje' : esc(dataCurta(p.data))}</b><span><i class="p3"></i>Saldo previsto<em>${brl(p.saldo)}</em></span>`;
    const lw = dica.offsetWidth;
    dica.style.left = Math.max(0, Math.min(W - lw, x(i) - lw / 2)) + 'px';
    dica.style.top = Math.max(0, y(p.saldo) - dica.offsetHeight - 12) + 'px';
  };
  const esconder = () => {
    mira.hidden = true;
    dica.hidden = true;
  };
  let atual = ult;
  alvo.addEventListener('pointermove', (ev) => {
    const r = alvo.getBoundingClientRect();
    atual = Math.round(((ev.clientX - r.left) / r.width) * ult);
    mostrar(atual);
  });
  alvo.addEventListener('pointerleave', esconder);
  alvo.addEventListener('focus', () => mostrar(atual));
  alvo.addEventListener('blur', esconder);
  alvo.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowLeft') mostrar((atual = Math.max(0, atual - 1)));
    if (ev.key === 'ArrowRight') mostrar((atual = Math.min(ult, atual + 1)));
  });
}

/** Barras horizontais de uma só cor, com valor na ponta. itens: [{ nome, valor }] */
export function barrasH(itens, { serie = 2, max = 6 } = {}) {
  let lista = itens.filter((i) => i.valor > 0);
  if (lista.length > max) {
    const resto = lista.slice(max - 1);
    lista = [...lista.slice(0, max - 1), { nome: `Outras (${resto.length})`, valor: resto.reduce((t, i) => t + i.valor, 0) }];
  }
  if (!lista.length) return '';
  const total = lista.reduce((t, i) => t + i.valor, 0) || 1;
  const topo = Math.max(...lista.map((i) => i.valor), 1);
  return `<div class="barras">${lista.map((i) => `
    <div class="barra" tabindex="0" data-dica="${esc(`<b>${esc(i.nome)}</b><span>${brl(i.valor)}<em>${pct(i.valor / total)} do total</em></span>`)}">
      <div class="barra-topo"><span>${esc(i.nome)}</span><b>${brl(i.valor)}</b></div>
      <div class="barra-trilho"><i class="s${serie}" style="width:${Math.max(1.5, (i.valor / topo) * 100).toFixed(1)}%"></i></div>
    </div>`).join('')}</div>`;
}

/** Medidor de progresso (meta, parcelas pagas...). */
export function medidor(fracao, { tipo = '', rotulo = '' } = {}) {
  const f = Math.max(0, Math.min(1, fracao || 0));
  return `<div class="medidor ${tipo}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(f * 100)}" ${rotulo ? `aria-label="${esc(rotulo)}"` : ''}><i style="width:${(f * 100).toFixed(1)}%"></i></div>`;
}

export const legenda = (itens) => `<div class="legenda">${itens.map(([n, t]) => `<span><i class="p${n}"></i>${esc(t)}</span>`).join('')}</div>`;
