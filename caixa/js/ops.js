// Operações que alteram os dados (pagar, criar venda parcelada, excluir...).

import { store } from './store.js';
import { hoje, round2, uid } from './util.js';
import { gerarParcelas, buscarEntrada } from './calc.js';

const CAMPOS = ['tipo', 'descricao', 'valor', 'vencimento', 'pago', 'pagoEm', 'categoria', 'clienteId', 'fornecedor', 'forma',
  'contaId', 'contaDestinoId', 'obs', 'vendaId', 'parcelaN', 'parcelaTotal', 'entrada', 'fixoId', 'competencia', 'ignorado', 'criadoEm'];

function limpar(e) {
  const o = { id: e.id };
  for (const k of CAMPOS) if (e[k] !== undefined && e[k] !== '' && e[k] !== null && e[k] !== 0 && e[k] !== false) o[k] = e[k];
  o.valor = round2(e.valor);
  o.pago = !!e.pago;
  if (!o.criadoEm) o.criadoEm = new Date().toISOString();
  return o;
}

/** Grava um lançamento. Ocorrências de fixos viram lançamentos reais aqui. */
export function salvarLancamento(e) {
  return store.put('lancamentos', limpar(e));
}

export function pagar(id, { pagoEm = hoje(), contaId, forma, valor } = {}) {
  const e = buscarEntrada(id);
  if (!e) return null;
  return salvarLancamento({
    ...e,
    pago: true,
    pagoEm,
    contaId: contaId || e.contaId || store.all('contas')[0]?.id || '',
    forma: forma || e.forma || '',
    valor: valor ?? e.valor,
  });
}

export function desfazerPagamento(id) {
  const e = buscarEntrada(id) || store.get(id);
  if (!e) return;
  salvarLancamento({ ...e, pago: false, pagoEm: '' });
}

/** Exclui um lançamento. Se vier de um fixo, só "pula" aquele mês. */
export function excluirEntrada(id) {
  const e = buscarEntrada(id) || store.get(id);
  if (!e) return;
  if (e.fixoId && store.get(e.fixoId)) salvarLancamento({ ...e, pago: false, pagoEm: '', ignorado: true });
  else store.remove(id);
}

/**
 * Venda parcelada: cria a venda, a entrada (se houver) e uma conta a receber por parcela.
 * dados: { clienteId, descricao, categoria, total, data, entradaValor, entradaPaga, entradaForma,
 *          contaId, nParcelas, primeira, intervalo, forma, obs }
 */
export function criarVenda(dados) {
  const id = dados.id || uid();
  const entrada = round2(dados.entradaValor || 0);
  const parcelas = gerarParcelas({ total: dados.total, entrada, n: dados.nParcelas, primeira: dados.primeira, intervalo: dados.intervalo });
  store.lote(() => {
    store.put('vendas', {
      id,
      clienteId: dados.clienteId,
      descricao: dados.descricao,
      categoria: dados.categoria || '',
      total: round2(dados.total),
      data: dados.data,
      entradaValor: entrada,
      nParcelas: parcelas.length,
      intervalo: dados.intervalo || 'mensal',
      obs: dados.obs || '',
      criadoEm: new Date().toISOString(),
    });
    const base = { tipo: 'receita', categoria: dados.categoria, clienteId: dados.clienteId, vendaId: id, parcelaTotal: parcelas.length };
    if (entrada > 0) {
      salvarLancamento({
        ...base, id: uid(), descricao: dados.descricao, valor: entrada, vencimento: dados.data, entrada: true,
        pago: dados.entradaPaga !== false, pagoEm: dados.entradaPaga !== false ? dados.data : '',
        forma: dados.entradaForma || dados.forma, contaId: dados.contaId,
      });
    }
    for (const p of parcelas) {
      salvarLancamento({
        ...base, id: uid(), descricao: dados.descricao, valor: p.valor, vencimento: p.vencimento, parcelaN: p.n,
        pago: false, forma: dados.forma, contaId: dados.contaId,
      });
    }
  });
  return id;
}

export function excluirVenda(id) {
  store.lote(() => {
    for (const l of store.all('lancamentos')) if (l.vendaId === id) store.remove(l.id);
    store.remove(id);
  });
}

export function excluirFixo(id, { apagarHistorico = false } = {}) {
  store.lote(() => {
    for (const l of store.all('lancamentos')) {
      if (l.fixoId !== id) continue;
      if (apagarHistorico || l.ignorado || !l.pago) store.remove(l.id);
    }
    store.remove(id);
  });
}

export function excluirCliente(id) {
  store.remove(id);
}
