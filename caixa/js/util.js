// Funções de apoio: dinheiro, datas e HTML.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const sum = (arr, fn = (x) => x) => round2(arr.reduce((t, x) => t + (Number(fn(x)) || 0), 0));

// ---------- Dinheiro ----------
const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const brl = (v) => fmtBRL.format(round2(v)).replace(/ /g, ' ');
export const num = (v) => fmtNum.format(round2(v));

/** Valor curto para eixos e cartões pequenos: R$ 1,2 mil / R$ 3,4 mi */
export function brlCurto(v) {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e4) return `${s}R$ ${(a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `${s}R$ ${a.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

/** "1.234,56" -> 1234.56 */
export function parseMoney(str) {
  if (typeof str === 'number') return round2(str);
  const s = String(str || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return round2(parseFloat(s) || 0);
}

export const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

// ---------- Datas (sempre no fuso do aparelho, formato AAAA-MM-DD) ----------
const p2 = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const hoje = () => iso(new Date());
export const parseISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
};
export const ymDe = (isoDate) => (isoDate || '').slice(0, 7);
export const ymAtual = () => hoje().slice(0, 7);

export function addDias(isoDate, n) {
  const d = parseISO(isoDate);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export const diasNoMes = (y, m) => new Date(y, m, 0).getDate(); // m: 1..12

/** Soma meses mantendo o dia (31 vira o último dia do mês quando preciso). */
export function addMeses(isoDate, n, diaFixo) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const dia = Math.min(diaFixo || d, diasNoMes(ny, nm));
  return `${ny}-${p2(nm)}-${p2(dia)}`;
}

export function ymAdd(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${p2((total % 12) + 1)}`;
}

export function ymDiff(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/** Data de um dia do mês (AAAA-MM), ajustando para meses curtos. */
export function dataNoMes(ym, dia) {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${p2(Math.min(dia, diasNoMes(y, m)))}`;
}

export const diasEntre = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_C = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export const mesNome = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MESES[m - 1]} de ${y}`;
};
export const mesCurto = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MESES_C[m - 1]}/${String(y).slice(2)}`;
};
export const mesSo = (ym) => MESES_C[Number(ym.split('-')[1]) - 1];
export const dataBR = (s) => (s ? s.split('-').reverse().join('/') : '');
export const dataCurta = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  const ano = y === new Date().getFullYear() ? '' : ` ${y}`;
  return `${d} ${MESES_C[m - 1]}${ano}`;
};

/** "Hoje", "Ontem", "Amanhã" ou "terça-feira, 10 de novembro" */
export function dataExtenso(s) {
  const h = hoje();
  if (s === h) return 'Hoje';
  if (s === addDias(h, -1)) return 'Ontem';
  if (s === addDias(h, 1)) return 'Amanhã';
  const d = parseISO(s);
  const ano = d.getFullYear() === new Date().getFullYear() ? '' : ` de ${d.getFullYear()}`;
  return `${SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}${ano}`;
}

/** Texto de prazo: "vence hoje", "vence em 3 dias", "atrasado há 5 dias" */
export function prazoTexto(venc) {
  const n = diasEntre(hoje(), venc);
  if (n === 0) return 'vence hoje';
  if (n === 1) return 'vence amanhã';
  if (n > 1) return `vence em ${n} dias`;
  if (n === -1) return 'atrasado há 1 dia';
  return `atrasado há ${-n} dias`;
}

export const iniciais = (nome) =>
  String(nome || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

export const soDigitos = (s) => String(s || '').replace(/\D/g, '');

/** Link do WhatsApp com mensagem pronta (número brasileiro). */
export function linkWhats(telefone, texto) {
  let n = soDigitos(telefone);
  if (!n) return '';
  if (n.length <= 11) n = '55' + n;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto || '')}`;
}

export const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function baixar(nome, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1500);
}
