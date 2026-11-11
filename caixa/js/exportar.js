// Exportação: planilha Excel completa, CSV de lançamentos e backup.

import { store, config } from './store.js';
import { hoje, ymAtual, ymAdd, ymDe, mesCurto, baixar, diasEntre, round2, semAcento } from './util.js';
import { entradas, resumoMes, resumoDias, saldos, situacaoClientes, infoVenda, infoFixo, abertos, nomeCliente, nomeConta, dataEfetiva } from './calc.js';
import { criarXlsx } from './xlsx.js';

const SIT = { atraso: 'Em atraso', emdia: 'Em dia', quitado: 'Quitado', novo: 'Sem compras' };
const parcela = (e) => (e.entrada ? 'Entrada' : e.parcelaTotal ? `${e.parcelaN}/${e.parcelaTotal}` : '');
const situacao = (e) => (e.pago ? (e.tipo === 'receita' ? 'Recebido' : 'Pago') : e.vencimento < hoje() ? 'Atrasado' : 'Pendente');

function linhasLancamentos() {
  return store.all('lancamentos').filter((e) => !e.ignorado)
    .sort((a, b) => dataEfetiva(a).localeCompare(dataEfetiva(b)))
    .map((e) => [
      dataEfetiva(e),
      e.tipo === 'receita' ? 'Receita' : e.tipo === 'despesa' ? 'Despesa' : 'Transferência',
      e.descricao,
      e.categoria || '',
      e.tipo === 'receita' ? nomeCliente(e.clienteId) : e.fornecedor || '',
      e.tipo === 'receita' ? e.valor : '',
      e.tipo === 'despesa' ? e.valor : '',
      e.tipo === 'transferencia' ? e.valor : '',
      e.tipo === 'transferencia' ? 'Transferência' : situacao(e),
      e.vencimento,
      e.pagoEm || '',
      e.forma || '',
      e.tipo === 'transferencia' ? `${nomeConta(e.contaId)} → ${nomeConta(e.contaDestinoId)}` : nomeConta(e.contaId),
      parcela(e),
      e.obs || '',
    ]);
}

const COL_LANC = [
  { titulo: 'Data', tipo: 'data', largura: 12 }, { titulo: 'Tipo', largura: 12 }, { titulo: 'Descrição', largura: 36 },
  { titulo: 'Categoria', largura: 22 }, { titulo: 'Cliente / Fornecedor', largura: 28 }, { titulo: 'Entrada', tipo: 'moeda', largura: 14 },
  { titulo: 'Saída', tipo: 'moeda', largura: 14 }, { titulo: 'Transferência', tipo: 'moeda', largura: 14 }, { titulo: 'Situação', largura: 12 },
  { titulo: 'Vencimento', tipo: 'data', largura: 12 }, { titulo: 'Pago em', tipo: 'data', largura: 12 }, { titulo: 'Forma', largura: 18 },
  { titulo: 'Conta', largura: 24 }, { titulo: 'Parcela', largura: 10 }, { titulo: 'Observação', largura: 30 },
];

export function montarPlanilhas() {
  const h = hoje();
  const todos = store.all('lancamentos').filter((e) => !e.ignorado);
  const soma = (linhas, i) => round2(linhas.reduce((t, l) => t + (Number(l[i]) || 0), 0));

  // Resumo mês a mês: do primeiro lançamento até o mês atual (no mínimo 12 meses).
  const primeiro = todos.map((e) => ymDe(dataEfetiva(e))).sort()[0] || ymAtual();
  const inicio = primeiro < ymAdd(ymAtual(), -11) ? primeiro : ymAdd(ymAtual(), -11);
  const resumo = [];
  for (let ym = inicio; ym <= ymAtual(); ym = ymAdd(ym, 1)) {
    const r = resumoMes(ym);
    resumo.push([mesCurto(ym), r.recebido, r.pago, r.lucro, r.margem === null ? '' : round2(r.margem * 10000) / 10000, r.vendido]);
  }
  const tRec = soma(resumo, 1);
  const tPag = soma(resumo, 2);

  const lanc = linhasLancamentos();

  const receber = abertos('receita').filter((e) => !e.virtual || e.vencimento <= ymAdd(ymAtual(), 1) + '-31').map((e) => {
    const c = store.get(e.clienteId);
    return [c?.nome || '', e.descricao, parcela(e), e.vencimento, e.valor, e.vencimento < h ? 'Atrasado' : 'Em dia', e.vencimento < h ? diasEntre(e.vencimento, h) : 0, c?.telefone || ''];
  });
  const pagar = abertos('despesa').filter((e) => !e.virtual || e.vencimento <= ymAdd(ymAtual(), 1) + '-31').map((e) =>
    [e.descricao, e.fornecedor || '', e.categoria || '', parcela(e), e.vencimento, e.valor, e.vencimento < h ? 'Atrasado' : 'Em dia']);

  const clientes = [...situacaoClientes().values()].sort((a, b) => a.cliente.nome.localeCompare(b.cliente.nome, 'pt-BR')).map((s) =>
    [s.cliente.nome, s.cliente.telefone || '', s.cliente.doc || '', s.cliente.email || '', s.cliente.endereco || '', s.total, s.recebido, s.aberto, s.atrasado, SIT[s.status], s.ultima || '']);

  const vendas = store.all('vendas').sort((a, b) => a.data.localeCompare(b.data)).map((v) => {
    const i = infoVenda(v);
    return [v.data, nomeCliente(v.clienteId), v.descricao, i.total, v.entradaValor || 0, v.nParcelas, i.pago, i.aberto, i.atrasado, SIT[i.status].replace('Quitado', 'Quitada'), i.proxima?.vencimento || ''];
  });

  const fixos = store.all('fixos').map((f) => {
    const i = infoFixo(f);
    return [f.descricao, (f.tipo || 'despesa') === 'despesa' ? 'Gasto fixo' : 'Receita recorrente', f.categoria || '', f.valor, f.dia, mesCurto(f.inicio),
      f.parcelado ? 'Sim' : 'Não', f.parcelado ? i.atual : '', f.parcelado ? i.total : '', i.fim ? mesCurto(i.fim) : 'Sem término',
      f.parcelado ? i.valorRestante : '', i.encerrado ? (f.ativo === false ? 'Pausado' : 'Encerrado') : 'Ativo'];
  });

  const sd = saldos();
  const contas = sd.porConta.map((c) => [c.conta.nome, c.conta.saldoInicial || 0, c.saldo]);

  const tRec2 = round2(resumoDias().reduce((t, d) => t + d.recebido, 0));
  const tPag2 = round2(resumoDias().reduce((t, d) => t + d.pago, 0));

  return [
    { nome: 'Resumo mensal', colunas: [{ titulo: 'Mês', largura: 12 }, { titulo: 'Receitas recebidas', tipo: 'moeda', largura: 20 }, { titulo: 'Despesas pagas', tipo: 'moeda', largura: 18 },
        { titulo: 'Resultado', tipo: 'moeda', largura: 16 }, { titulo: 'Margem', tipo: 'pct', largura: 10 }, { titulo: 'Vendido no mês', tipo: 'moeda', largura: 18 }],
      linhas: resumo, total: ['Total', tRec, tPag, round2(tRec - tPag), tRec ? round2(((tRec - tPag) / tRec) * 10000) / 10000 : '', soma(resumo, 5)] },
    { nome: 'Resumo diário', colunas: [{ titulo: 'Dia', tipo: 'data', largura: 12 }, { titulo: 'Receitas recebidas', tipo: 'moeda', largura: 20 }, { titulo: 'Despesas pagas', tipo: 'moeda', largura: 18 },
        { titulo: 'Resultado', tipo: 'moeda', largura: 16 }, { titulo: 'Lançamentos', tipo: 'numero', largura: 14 }],
      linhas: resumoDias().map((d) => [d.data, d.recebido, d.pago, d.lucro, d.qtd]), total: ['Total', tRec2, tPag2, round2(tRec2 - tPag2)] },
    { nome: 'Lançamentos', colunas: COL_LANC, linhas: lanc, total: ['Total', '', '', '', '', soma(lanc.filter((l) => l[8] === 'Recebido'), 5), soma(lanc.filter((l) => l[8] === 'Pago'), 6)].concat(['', 'somente recebidos e pagos']) },
    { nome: 'A receber', colunas: [{ titulo: 'Cliente', largura: 28 }, { titulo: 'Descrição', largura: 36 }, { titulo: 'Parcela', largura: 10 }, { titulo: 'Vencimento', tipo: 'data', largura: 12 },
        { titulo: 'Valor', tipo: 'moeda', largura: 14 }, { titulo: 'Situação', largura: 12 }, { titulo: 'Dias de atraso', tipo: 'numero', largura: 14 }, { titulo: 'WhatsApp', largura: 18 }],
      linhas: receber, total: ['Total', '', '', '', soma(receber, 4)] },
    { nome: 'A pagar', colunas: [{ titulo: 'Descrição', largura: 36 }, { titulo: 'Fornecedor', largura: 24 }, { titulo: 'Categoria', largura: 22 }, { titulo: 'Parcela', largura: 10 },
        { titulo: 'Vencimento', tipo: 'data', largura: 12 }, { titulo: 'Valor', tipo: 'moeda', largura: 14 }, { titulo: 'Situação', largura: 12 }],
      linhas: pagar, total: ['Total', '', '', '', '', soma(pagar, 5)] },
    { nome: 'Clientes', colunas: [{ titulo: 'Nome', largura: 30 }, { titulo: 'WhatsApp', largura: 18 }, { titulo: 'CPF / CNPJ', largura: 18 }, { titulo: 'E-mail', largura: 26 }, { titulo: 'Endereço', largura: 30 },
        { titulo: 'Total em compras', tipo: 'moeda', largura: 18 }, { titulo: 'Já pagou', tipo: 'moeda', largura: 14 }, { titulo: 'Em aberto', tipo: 'moeda', largura: 14 },
        { titulo: 'Em atraso', tipo: 'moeda', largura: 14 }, { titulo: 'Situação', largura: 14 }, { titulo: 'Última compra', tipo: 'data', largura: 14 }],
      linhas: clientes, total: ['Total', '', '', '', '', soma(clientes, 5), soma(clientes, 6), soma(clientes, 7), soma(clientes, 8)] },
    { nome: 'Vendas parceladas', colunas: [{ titulo: 'Data', tipo: 'data', largura: 12 }, { titulo: 'Cliente', largura: 28 }, { titulo: 'Descrição', largura: 36 }, { titulo: 'Total', tipo: 'moeda', largura: 14 },
        { titulo: 'Entrada', tipo: 'moeda', largura: 14 }, { titulo: 'Parcelas', tipo: 'numero', largura: 10 }, { titulo: 'Recebido', tipo: 'moeda', largura: 14 }, { titulo: 'Em aberto', tipo: 'moeda', largura: 14 },
        { titulo: 'Em atraso', tipo: 'moeda', largura: 14 }, { titulo: 'Situação', largura: 12 }, { titulo: 'Próximo vencimento', tipo: 'data', largura: 18 }],
      linhas: vendas, total: ['Total', '', '', soma(vendas, 3), soma(vendas, 4), '', soma(vendas, 6), soma(vendas, 7), soma(vendas, 8)] },
    { nome: 'Fixos e parcelamentos', colunas: [{ titulo: 'Descrição', largura: 32 }, { titulo: 'Tipo', largura: 18 }, { titulo: 'Categoria', largura: 22 }, { titulo: 'Valor por mês', tipo: 'moeda', largura: 16 },
        { titulo: 'Dia do vencimento', tipo: 'numero', largura: 16 }, { titulo: 'Início', largura: 10 }, { titulo: 'Parcelado', largura: 10 }, { titulo: 'Parcela atual', tipo: 'numero', largura: 12 },
        { titulo: 'Total de parcelas', tipo: 'numero', largura: 16 }, { titulo: 'Termina em', largura: 14 }, { titulo: 'Falta pagar', tipo: 'moeda', largura: 16 }, { titulo: 'Situação', largura: 12 }],
      linhas: fixos },
    { nome: 'Contas', colunas: [{ titulo: 'Conta', largura: 28 }, { titulo: 'Saldo inicial', tipo: 'moeda', largura: 16 }, { titulo: 'Saldo atual', tipo: 'moeda', largura: 16 }],
      linhas: contas, total: ['Total', soma(contas, 1), sd.total] },
  ];
}

const slug = () => `${semAcento(config().empresa).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'empresa'}-${hoje()}`;

export function exportarExcel() {
  baixar(`caixa-${slug()}.xlsx`, criarXlsx(montarPlanilhas()));
}

export function exportarCSV() {
  const cel = (v) => {
    if (typeof v === 'number') return String(v).replace('.', ',');
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('/');
    return /[";\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? '');
  };
  const linhas = [COL_LANC.map((c) => c.titulo), ...linhasLancamentos()].map((l) => l.map(cel).join(';'));
  baixar(`lancamentos-${slug()}.csv`, new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
}

export function exportarBackup() {
  baixar(`backup-${slug()}.json`, new Blob([JSON.stringify(store.exportar())], { type: 'application/json' }));
}
