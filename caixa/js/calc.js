// Regras de negócio: junta lançamentos, parcelas e gastos fixos e calcula os números do painel.

import { store, config } from './store.js';
import { sum, round2, hoje, ymDe, ymAtual, ymAdd, ymDiff, dataNoMes, addDias, addMeses, diasEntre, brl, pct } from './util.js';

let memo = { v: -1, dia: '', mapa: new Map() };
function lembrar(chave, fn) {
  if (memo.v !== store.versao || memo.dia !== hoje()) memo = { v: store.versao, dia: hoje(), mapa: new Map() };
  if (!memo.mapa.has(chave)) memo.mapa.set(chave, fn());
  return memo.mapa.get(chave);
}

// ---------- Gastos fixos / recorrentes ----------

/** Mês (AAAA-MM) em que o fixo termina, ou '' se não tem fim. */
export function fimDoFixo(f) {
  if (f.parcelado) return ymAdd(f.inicio, Math.max(0, (f.parcelas || 1) - (f.parcelaInicial || 1)));
  return f.fim || '';
}
export const parcelaDoFixo = (f, ym) => (f.parcelaInicial || 1) + ymDiff(f.inicio, ym);
export const idOcorrencia = (fixoId, ym) => `fx-${fixoId}-${ym}`;

function ocorrencia(f, ym) {
  return {
    id: idOcorrencia(f.id, ym),
    virtual: true,
    tipo: f.tipo || 'despesa',
    descricao: f.descricao,
    valor: f.valor,
    vencimento: dataNoMes(ym, f.dia || 1),
    pago: false,
    pagoEm: '',
    categoria: f.categoria || '',
    clienteId: f.clienteId || '',
    fornecedor: f.fornecedor || '',
    forma: f.forma || '',
    contaId: f.contaId || '',
    obs: '',
    fixoId: f.id,
    competencia: ym,
    parcelaN: f.parcelado ? parcelaDoFixo(f, ym) : 0,
    parcelaTotal: f.parcelado ? f.parcelas : 0,
  };
}

/**
 * Todas as movimentações: lançamentos reais + ocorrências futuras/pendentes dos fixos
 * (que só viram lançamento de verdade quando são pagas ou editadas).
 */
export function entradas(ateYm) {
  const minimo = ymAdd(ymAtual(), 3);
  const ate = !ateYm || ateYm < minimo ? minimo : ateYm;
  return lembrar('entradas:' + ate, () => {
    const reais = store.all('lancamentos');
    const feitos = new Set();
    for (const l of reais) if (l.fixoId) feitos.add(l.fixoId + '|' + l.competencia);
    const lista = reais.filter((l) => !l.ignorado);
    for (const f of store.all('fixos')) {
      if (f.ativo === false || !f.inicio) continue;
      const fim = fimDoFixo(f);
      const ultimo = fim && fim < ate ? fim : ate;
      for (let ym = f.inicio, i = 0; ym <= ultimo && i < 600; ym = ymAdd(ym, 1), i++) {
        if (!feitos.has(f.id + '|' + ym)) lista.push(ocorrencia(f, ym));
      }
    }
    return lista;
  });
}

export const buscarEntrada = (id) => entradas(ymAdd(ymAtual(), 24)).find((e) => e.id === id) || null;

export const ehRD = (e) => e.tipo === 'receita' || e.tipo === 'despesa';
export const atrasado = (e) => !e.pago && e.vencimento < hoje();
export const dataEfetiva = (e) => (e.pago ? e.pagoEm || e.vencimento : e.vencimento);

/** Data em que a venda aconteceu (para medir faturamento e meta). */
export function dataVenda(e) {
  if (e.vendaId) {
    const v = store.get(e.vendaId);
    if (v) return v.data;
  }
  return e.vencimento;
}

// ---------- Resumo do mês ----------

export function resumoMes(ym) {
  return lembrar('resumo:' + ym, () => {
    const es = entradas(ym).filter(ehRD);
    const rec = es.filter((e) => e.tipo === 'receita');
    const desp = es.filter((e) => e.tipo === 'despesa');
    const recebido = sum(rec.filter((e) => e.pago && ymDe(e.pagoEm) === ym), (e) => e.valor);
    const pago = sum(desp.filter((e) => e.pago && ymDe(e.pagoEm) === ym), (e) => e.valor);
    const aReceber = sum(rec.filter((e) => !e.pago && ymDe(e.vencimento) === ym), (e) => e.valor);
    const aPagar = sum(desp.filter((e) => !e.pago && ymDe(e.vencimento) === ym), (e) => e.valor);
    const vendido = sum(rec.filter((e) => ymDe(dataVenda(e)) === ym), (e) => e.valor);
    const lucro = round2(recebido - pago);
    return {
      ym, recebido, pago, lucro, aReceber, aPagar, vendido,
      margem: recebido > 0 ? lucro / recebido : null,
      previsto: round2(lucro + aReceber - aPagar),
      qtdRecebimentos: rec.filter((e) => e.pago && ymDe(e.pagoEm) === ym).length,
    };
  });
}

/** Diz, em palavras, se o lucro do mês está bom. */
export function saude(r) {
  const alvo = (config().margemAlvo || 0) / 100;
  if (!r.recebido && !r.pago) return { nivel: 'neutro', titulo: 'Sem movimento', texto: 'Nenhum recebimento ou pagamento registrado neste mês.' };
  if (r.lucro < 0) return { nivel: 'critico', titulo: 'Prejuízo', texto: `As despesas passaram das receitas em ${brl(-r.lucro)}.` };
  if (!r.recebido) return { nivel: 'neutro', titulo: 'Sem receitas', texto: 'Ainda não entrou dinheiro neste mês.' };
  const m = pct(r.margem);
  if (r.margem >= alvo) return { nivel: 'bom', titulo: 'Lucro saudável', texto: `Margem de ${m}, acima da sua meta de ${pct(alvo)}.` };
  if (r.margem >= alvo / 2) return { nivel: 'atencao', titulo: 'Lucro razoável', texto: `Margem de ${m}, abaixo da meta de ${pct(alvo)}.` };
  return { nivel: 'alerta', titulo: 'Lucro apertado', texto: `Margem de só ${m}. A meta é ${pct(alvo)}.` };
}

export function serieMeses(n, ateYm = ymAtual()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(resumoMes(ymAdd(ateYm, -i)));
  return out;
}

function agrupar(lista, chave) {
  const m = new Map();
  for (const e of lista) m.set(chave(e), round2((m.get(chave(e)) || 0) + e.valor));
  return [...m].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
}

/** Pagos/recebidos em um período (ym "AAAA-MM" ou ano "AAAA"), agrupados. */
export function porCategoria(tipo, periodo) {
  const es = entradas().filter((e) => e.tipo === tipo && e.pago && (e.pagoEm || '').startsWith(periodo));
  return agrupar(es, (e) => e.categoria || 'Sem categoria');
}
export function porForma(tipo, periodo) {
  const es = entradas().filter((e) => e.tipo === tipo && e.pago && (e.pagoEm || '').startsWith(periodo));
  return agrupar(es, (e) => e.forma || 'Não informada');
}
export function porCliente(periodo) {
  const es = entradas().filter((e) => e.tipo === 'receita' && e.clienteId && dataVenda(e).startsWith(periodo));
  return agrupar(es, (e) => e.clienteId).map((x) => ({ ...x, cliente: store.get(x.nome) })).filter((x) => x.cliente);
}

// ---------- Saldos ----------

export function saldos() {
  return lembrar('saldos', () => {
    const contas = store.all('contas');
    const mapa = new Map(contas.map((c) => [c.id, round2(c.saldoInicial || 0)]));
    const padrao = contas[0]?.id;
    const mexe = (id, v) => {
      const k = mapa.has(id) ? id : padrao;
      if (k) mapa.set(k, round2(mapa.get(k) + v));
    };
    for (const l of store.all('lancamentos')) {
      if (!l.pago || l.ignorado) continue;
      if (l.tipo === 'receita') mexe(l.contaId, l.valor);
      else if (l.tipo === 'despesa') mexe(l.contaId, -l.valor);
      else if (l.tipo === 'transferencia') {
        mexe(l.contaId, -l.valor);
        mexe(l.contaDestinoId, l.valor);
      }
    }
    const porConta = contas.map((c) => ({ conta: c, saldo: mapa.get(c.id) }));
    return { porConta, total: sum(porConta, (x) => x.saldo) };
  });
}

// ---------- Contas a receber e a pagar ----------

export function abertos(tipo) {
  return lembrar('abertos:' + tipo, () =>
    entradas()
      .filter((e) => e.tipo === tipo && !e.pago)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  );
}

export function totaisAbertos(tipo) {
  const h = hoje();
  const lista = abertos(tipo);
  const lim30 = addDias(h, 30);
  // Fixos sem fim geram ocorrências indefinidamente: no total "em aberto" entram só os próximos 30 dias deles.
  const conta = lista.filter((e) => !e.virtual || e.vencimento <= lim30);
  return {
    total: sum(conta, (e) => e.valor),
    atrasado: sum(lista.filter((e) => e.vencimento < h), (e) => e.valor),
    qtdAtrasado: lista.filter((e) => e.vencimento < h).length,
    em7: sum(lista.filter((e) => e.vencimento >= h && e.vencimento <= addDias(h, 7)), (e) => e.valor),
    em30: sum(lista.filter((e) => e.vencimento >= h && e.vencimento <= lim30), (e) => e.valor),
  };
}

/** Separa as contas em aberto em faixas de prazo. */
export function faixas(lista) {
  const h = hoje();
  const fimMes = dataNoMes(ymAtual(), 31);
  const d7 = addDias(h, 7);
  const g = [
    { id: 'atrasadas', titulo: 'Atrasadas', itens: [] },
    { id: 'hoje', titulo: 'Vencem hoje', itens: [] },
    { id: 'semana', titulo: 'Próximos 7 dias', itens: [] },
    { id: 'mes', titulo: 'Ainda neste mês', itens: [] },
    { id: 'depois', titulo: 'Depois', itens: [] },
  ];
  for (const e of lista) {
    const v = e.vencimento;
    (v < h ? g[0] : v === h ? g[1] : v <= d7 ? g[2] : v <= fimMes ? g[3] : g[4]).itens.push(e);
  }
  return g.filter((x) => x.itens.length);
}

// ---------- Clientes ----------

export function situacaoClientes() {
  return lembrar('clientes', () => {
    const h = hoje();
    const mapa = new Map();
    for (const c of store.all('clientes')) {
      mapa.set(c.id, { cliente: c, total: 0, recebido: 0, aberto: 0, atrasado: 0, diasAtraso: 0, nAbertas: 0, proxima: null, ultima: '', status: 'novo' });
    }
    for (const e of entradas()) {
      if (e.tipo !== 'receita' || !mapa.has(e.clienteId)) continue;
      if (e.virtual && e.vencimento > addDias(h, 30)) continue;
      const s = mapa.get(e.clienteId);
      s.total = round2(s.total + e.valor);
      const dv = dataVenda(e);
      if (dv > s.ultima && dv <= h) s.ultima = dv;
      if (e.pago) s.recebido = round2(s.recebido + e.valor);
      else {
        s.aberto = round2(s.aberto + e.valor);
        s.nAbertas++;
        if (!s.proxima || e.vencimento < s.proxima.vencimento) s.proxima = e;
        if (e.vencimento < h) {
          s.atrasado = round2(s.atrasado + e.valor);
          s.diasAtraso = Math.max(s.diasAtraso, diasEntre(e.vencimento, h));
        }
      }
    }
    for (const s of mapa.values()) {
      s.status = s.atrasado > 0 ? 'atraso' : s.aberto > 0 ? 'emdia' : s.total > 0 ? 'quitado' : 'novo';
    }
    return mapa;
  });
}

export function painelClientes() {
  const lista = [...situacaoClientes().values()];
  const emAtraso = lista.filter((s) => s.status === 'atraso').sort((a, b) => b.atrasado - a.atrasado);
  const emDia = lista.filter((s) => s.status === 'emdia');
  return {
    emAtraso, emDia,
    comParcelas: emAtraso.length + emDia.length,
    valorAtrasado: sum(emAtraso, (s) => s.atrasado),
    valorEmDia: sum(emDia, (s) => s.aberto) + sum(emAtraso, (s) => s.aberto - s.atrasado),
  };
}

// ---------- Vendas parceladas ----------

export function infoVenda(v) {
  const h = hoje();
  const parcelas = store.all('lancamentos').filter((l) => l.vendaId === v.id)
    .sort((a, b) => (a.parcelaN || 0) - (b.parcelaN || 0) || a.vencimento.localeCompare(b.vencimento));
  const pagas = parcelas.filter((p) => p.pago);
  const abertas = parcelas.filter((p) => !p.pago);
  const atrasadas = abertas.filter((p) => p.vencimento < h);
  return {
    parcelas,
    total: sum(parcelas, (p) => p.valor),
    pago: sum(pagas, (p) => p.valor),
    aberto: sum(abertas, (p) => p.valor),
    atrasado: sum(atrasadas, (p) => p.valor),
    proxima: abertas.slice().sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0] || null,
    nPagas: pagas.length,
    status: atrasadas.length ? 'atraso' : abertas.length ? 'emdia' : 'quitado',
  };
}

/** Calcula as parcelas de uma venda (a última absorve os centavos). */
export function gerarParcelas({ total, entrada = 0, n = 1, primeira, intervalo = 'mensal' }) {
  const restante = round2(total - entrada);
  if (restante <= 0 || n < 1) return [];
  const base = Math.floor((restante * 100) / n) / 100;
  const dia = Number(primeira.slice(8, 10));
  const out = [];
  for (let i = 0; i < n; i++) {
    const venc = intervalo === 'semanal' ? addDias(primeira, 7 * i)
      : intervalo === 'quinzenal' ? addDias(primeira, 15 * i)
      : addMeses(primeira, i, dia);
    out.push({ n: i + 1, valor: i === n - 1 ? round2(restante - base * (n - 1)) : base, vencimento: venc });
  }
  return out;
}

// ---------- Fixos ----------

export function infoFixo(f) {
  const ym = ymAtual();
  const fim = fimDoFixo(f);
  const doFixo = store.all('lancamentos').filter((l) => l.fixoId === f.id);
  const pagas = doFixo.filter((l) => l.pago && !l.ignorado).length;
  const encerrado = f.ativo === false || (fim && fim < ym);
  const info = { fim, encerrado, doMes: null, pagas };
  if (!encerrado && f.inicio <= ym) info.doMes = entradas().find((e) => e.fixoId === f.id && e.competencia === ym) || doFixo.find((l) => l.competencia === ym) || null;
  if (f.parcelado) {
    const total = f.parcelas || 1;
    const jaPagasAntes = (f.parcelaInicial || 1) - 1;
    info.total = total;
    info.quitadas = Math.min(total, jaPagasAntes + pagas);
    info.restantes = total - info.quitadas;
    info.valorRestante = round2(info.restantes * f.valor);
    info.atual = Math.min(total, Math.max(1, parcelaDoFixo(f, ym)));
  }
  return info;
}

export function totalFixosMes(tipo = 'despesa', ym = ymAtual()) {
  return sum(entradas(ym).filter((e) => e.fixoId && e.tipo === tipo && e.competencia === ym), (e) => e.valor);
}

// ---------- Projeção de caixa ----------

export function projecao(dias = 90) {
  return lembrar('proj:' + dias, () => {
    const h = hoje();
    const fim = addDias(h, dias);
    const delta = new Map();
    for (const e of entradas(ymDe(fim))) {
      if (!ehRD(e) || e.pago || e.vencimento > fim) continue;
      const d = e.vencimento < h ? h : e.vencimento;
      delta.set(d, (delta.get(d) || 0) + (e.tipo === 'receita' ? e.valor : -e.valor));
    }
    let saldo = saldos().total;
    const pontos = [];
    for (let i = 0; i <= dias; i++) {
      const d = addDias(h, i);
      saldo = round2(saldo + (delta.get(d) || 0));
      pontos.push({ data: d, saldo });
    }
    const menor = pontos.reduce((a, b) => (b.saldo < a.saldo ? b : a), pontos[0]);
    return { pontos, menor, final: pontos[pontos.length - 1], inicial: saldos().total };
  });
}

export const nomeCliente = (id) => (id ? store.get(id)?.nome || 'Cliente removido' : '');
export const nomeConta = (id) => (id ? store.get(id)?.nome || '' : '');
