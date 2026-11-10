// Dados de exemplo de uma gráfica, para conhecer o app. Podem ser apagados em Ajustes.

import { store, semear } from './store.js';
import { hoje, ymAtual, ymAdd, addDias, addMeses, dataNoMes, uid, round2 } from './util.js';
import { salvarLancamento, criarVenda, pagar } from './ops.js';
import { idOcorrencia } from './calc.js';

// Sorteio com semente fixa: o exemplo sai sempre igual.
let semente = 20231201;
const rnd = () => ((semente = (semente * 1664525 + 1013904223) >>> 0) / 4294967296);
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const um = (l) => l[Math.floor(rnd() * l.length)];

export function carregarExemplo() {
  semente = 20231201;
  const h = hoje();
  const mes = ymAtual();
  store.lote(() => {
    semear();
    const cx = 'conta-caixa';
    const bc = 'conta-banco';
    store.put('contas', { ...store.get(cx), id: cx, saldoInicial: 350 });
    store.put('contas', { ...store.get(bc), id: bc, saldoInicial: 4200 });
    store.put('config', { ...store.get('config'), id: 'config', metaMensal: 18000, margemAlvo: 20 });

    const nomes = [
      ['Padaria Pão Quente', '88996010101'], ['Mercadinho São José', '88996020202'], ['Clínica Sorriso', '88996030303'],
      ['Auto Peças Acopiara', '88996040404'], ['Escola Pequeno Príncipe', '88996050505'], ['Farmácia Popular', '88996060606'],
      ['Maria das Graças Silva', '88996070707'], ['João Batista Lima', '88996080808'], ['Igreja Matriz', '88996090909'],
      ['Restaurante Sabor Caseiro', '88996101010'], ['Academia Corpo Ativo', '88996111111'], ['Pedro Henrique Alves', '88996121212'],
    ];
    const cli = nomes.map(([nome, telefone]) => store.put('clientes', { id: uid(), nome, telefone, criadoEm: new Date().toISOString() }).id);

    // Gastos fixos (com dois parcelamentos)
    const ini = ymAdd(mes, -5);
    const fixos = [
      { descricao: 'Aluguel do ponto', valor: 1200, categoria: 'Aluguel', dia: 5 },
      { descricao: 'Energia', valor: 520, categoria: 'Energia', dia: 12, fornecedor: 'Enel' },
      { descricao: 'Internet', valor: 119.9, categoria: 'Internet e telefone', dia: 15 },
      { descricao: 'Salário da atendente', valor: 1518, categoria: 'Salários', dia: 5 },
      { descricao: 'Pró-labore', valor: 2500, categoria: 'Pró-labore', dia: 10 },
      { descricao: 'DAS do Simples', valor: 86, categoria: 'Impostos', dia: 20 },
      { descricao: 'Parcela da impressora laser', valor: 689, categoria: 'Equipamentos', dia: 18, parcelado: true, parcelas: 12, parcelaInicial: 4, fornecedor: 'Banco do Nordeste' },
      { descricao: 'Financiamento da plotter', valor: 940, categoria: 'Equipamentos', dia: 25, parcelado: true, parcelas: 24, parcelaInicial: 9, fornecedor: 'Sicredi' },
    ].map((f) => store.put('fixos', { id: uid(), tipo: 'despesa', inicio: ini, parcelado: false, parcelas: 0, parcelaInicial: 1, fim: '', forma: 'Boleto', contaId: bc, ativo: true, ...f }));

    // Meses anteriores: fixos pagos + vendas à vista + compras
    const servicos = [
      ['Panfletos 1.000 un.', 'Panfletos', 180, 420], ['Cartões de visita 500 un.', 'Cartões de visita', 80, 160], ['Banner 1x1,5 m', 'Banners e lonas', 90, 220],
      ['Carimbo automático Nykon', 'Carimbos', 55, 120], ['Impressões A3 coloridas', 'Impressão digital', 40, 260], ['Adesivos recortados', 'Adesivos', 60, 340],
      ['Blocos de pedido 10 un.', 'Blocos e talões', 150, 380], ['Criação de logomarca', 'Criação de arte', 150, 450], ['Cardápios plastificados', 'Impressão digital', 120, 300],
      ['Convites personalizados', 'Impressão digital', 90, 280], ['Lona para fachada', 'Banners e lonas', 280, 900], ['Encadernação e plastificação', 'Acabamento', 20, 90],
    ];
    const compras = [
      ['Resmas de papel couché', 'Papel e insumos', 380, 920, 'Suzano Distribuidora'], ['Toner e tinta', 'Tinta e toner', 260, 780, 'Print Supply'],
      ['Lona e vinil adesivo', 'Papel e insumos', 300, 850, 'Vinil Sul'], ['Corte e vinco terceirizado', 'Terceirização', 120, 420, 'Gráfica Parceira'],
      ['Frete de material', 'Frete e transporte', 45, 160, 'Transportadora'], ['Manutenção da guilhotina', 'Manutenção de máquinas', 150, 480, 'Assistência Técnica'],
      ['Impulsionamento no Instagram', 'Marketing', 50, 150, 'Meta'], ['Taxa da maquininha', 'Taxas de cartão', 35, 110, ''],
    ];
    const formas = ['Pix', 'Pix', 'Pix', 'Dinheiro', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito'];

    for (let m = -5; m <= 0; m++) {
      const ym = ymAdd(mes, m);
      const ultimoDia = m === 0 ? Number(h.slice(8)) : 28;
      for (const f of fixos) {
        const venc = dataNoMes(ym, f.dia);
        if (venc <= h && !(m === 0 && f.dia > Number(h.slice(8)) - 2)) pagar(idOcorrencia(f.id, ym), { pagoEm: venc, contaId: bc, forma: 'Boleto' });
      }
      const nVendas = Math.round((66 + m * 3 + entre(0, 10)) * (ultimoDia / 28));
      for (let i = 0; i < nVendas; i++) {
        const [desc, cat, a, b] = um(servicos);
        const dia = dataNoMes(ym, entre(1, ultimoDia));
        const forma = um(formas);
        salvarLancamento({
          id: uid(), tipo: 'receita', descricao: desc, categoria: cat, valor: round2(entre(a, b) + um([0, 0, 0.5, 0.9])), vencimento: dia, pago: true, pagoEm: dia,
          clienteId: rnd() < 0.55 ? um(cli) : '', forma, contaId: forma === 'Dinheiro' ? cx : bc,
        });
      }
      const nCompras = Math.round((7 + entre(0, 3)) * (ultimoDia / 28));
      for (let i = 0; i < nCompras; i++) {
        const [desc, cat, a, b, forn] = um(compras);
        const dia = dataNoMes(ym, entre(1, ultimoDia));
        salvarLancamento({ id: uid(), tipo: 'despesa', descricao: desc, categoria: cat, valor: round2(entre(a, b)), vencimento: dia, pago: true, pagoEm: dia, fornecedor: forn, forma: um(['Pix', 'Boleto', 'Dinheiro']), contaId: rnd() < 0.2 ? cx : bc });
      }
    }

    // Vendas parceladas: em dia, quitada e em atraso
    const venda = (c, descricao, categoria, total, diasAtras, entradaValor, nParcelas, pagas, intervalo = 'mensal') => {
      const data = addDias(h, -diasAtras);
      const id = criarVenda({ clienteId: cli[c], descricao, categoria, total, data, entradaValor, entradaPaga: true, entradaForma: 'Pix', contaId: bc, nParcelas, primeira: addMeses(data, 1), intervalo, forma: 'Pix' });
      store.all('lancamentos').filter((l) => l.vendaId === id && !l.entrada).sort((a, b) => a.parcelaN - b.parcelaN).slice(0, pagas)
        .forEach((l) => pagar(l.id, { pagoEm: l.vencimento > h ? h : l.vencimento, contaId: bc, forma: 'Pix' }));
    };
    venda(4, 'Agendas e material escolar 2027', 'Impressão offset', 4800, 75, 1200, 6, 2);
    venda(2, 'Fachada em lona + adesivos', 'Banners e lonas', 2600, 40, 800, 3, 1);
    venda(9, 'Cardápios e comandas', 'Impressão digital', 1350, 100, 0, 3, 3);
    venda(3, 'Talões de nota e blocos', 'Blocos e talões', 1980, 95, 480, 5, 1);
    venda(10, 'Banners e panfletos da inauguração', 'Banners e lonas', 3200, 68, 1000, 4, 0);
    venda(7, 'Convites de casamento', 'Impressão digital', 900, 20, 300, 2, 0);
    venda(0, 'Sacos de papel personalizados', 'Impressão offset', 2400, 12, 0, 4, 0);

    // Contas avulsas em aberto
    salvarLancamento({ id: uid(), tipo: 'despesa', descricao: 'Papel offset 75 g (10 caixas)', categoria: 'Papel e insumos', valor: 1460, vencimento: addDias(h, 6), pago: false, fornecedor: 'Suzano Distribuidora', forma: 'Boleto', contaId: bc });
    salvarLancamento({ id: uid(), tipo: 'despesa', descricao: 'Conserto da plotter', categoria: 'Manutenção de máquinas', valor: 380, vencimento: addDias(h, -3), pago: false, fornecedor: 'Assistência Técnica', forma: 'Pix', contaId: bc });
    salvarLancamento({ id: uid(), tipo: 'receita', descricao: 'Folders da campanha', categoria: 'Panfletos', valor: 640, vencimento: addDias(h, 4), pago: false, clienteId: cli[5], forma: 'Pix', contaId: bc });
    salvarLancamento({ id: uid(), tipo: 'transferencia', descricao: 'Caixa (dinheiro) → Conta bancária / Pix', valor: 1500, vencimento: addDias(h, -8), pago: true, pagoEm: addDias(h, -8), contaId: cx, contaDestinoId: bc });
  });
}
