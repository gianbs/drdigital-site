// Formulários (folhas) de cadastro e edição.

import { store, config } from './store.js';
import { $, $$, esc, brl, hoje, uid, round2, addMeses, ymAtual, ymAdd, mesCurto, mesNome, dataBR, dataCurta, prazoTexto, linkWhats, parseMoney } from './util.js';
import { abrirFolha, confirmar, menuAcoes, aviso, grupo, campo, segmentado, lerForm, erroCampo, selo } from './ui.js';
import { icon } from './icons.js';
import { buscarEntrada, gerarParcelas, infoVenda, fimDoFixo, parcelaDoFixo, atrasado, nomeCliente, situacaoClientes } from './calc.js';
import { salvarLancamento, pagar, desfazerPagamento, excluirEntrada, criarVenda, excluirVenda, excluirFixo, excluirCliente } from './ops.js';
import { medidor } from './charts.js';
import { ehFuncionario } from './sync.js';

const contasOps = () => store.all('contas').map((c) => [c.id, c.nome]);
const clientesOps = () => store.all('clientes').slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((c) => [c.id, c.nome]);
const categorias = (tipo) => (tipo === 'receita' ? config().categoriasReceita : config().categoriasDespesa);
const comAtual = (lista, atual) => (atual && !lista.includes(atual) ? [...lista, atual] : lista);

function campoCliente(valor, rotulo = 'Cliente', vazio = 'Sem cliente') {
  return campo({ rotulo, nome: 'clienteId', tipo: 'select', valor, vazio, opcoes: [...clientesOps(), ['__novo', '+ Novo cliente…']] });
}
/** Liga a opção "+ Novo cliente…" de um select de cliente. */
function ligarNovoCliente(form) {
  const sel = form.elements.clienteId;
  if (!sel) return;
  sel.addEventListener('change', () => {
    if (sel.value !== '__novo') return;
    sel.value = '';
    formCliente(null, (c) => {
      const o = new Option(c.nome, c.id, true, true);
      sel.add(o, sel.options[sel.options.length - 1]);
      sel.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
}

// Funcionário não exclui nada (o banco também recusa).
const botaoExcluir = (texto) => ehFuncionario() ? '' : `<section class="grupo"><div class="lista"><button type="button" class="linha linha-botao perigo" data-excluir>${icon('trash')}<span>${esc(texto)}</span></button></div></section>`;

// ---------- Receita / despesa ----------

export function formLancamento({ id, tipo = 'receita', preset = {} } = {}) {
  if (ehFuncionario()) tipo = 'receita';
  const orig = id ? buscarEntrada(id) : null;
  if (id && !orig) return;
  if (orig?.tipo === 'transferencia') return formTransferencia(orig);
  const contas = store.all('contas');
  let st = orig ? { ...orig } : {
    tipo, descricao: '', valor: 0, vencimento: hoje(), pago: true, pagoEm: hoje(), categoria: '', clienteId: '', fornecedor: '',
    forma: 'Pix', contaId: contas[1]?.id || contas[0]?.id || '', obs: '', ...preset,
  };
  const fixo = orig?.fixoId ? store.get(orig.fixoId) : null;
  const venda = orig?.vendaId ? store.get(orig.vendaId) : null;

  const html = () => {
    const rec = st.tipo === 'receita';
    const origem = venda
      ? `<p class="nota">${icon('layers')} ${st.entrada ? 'Entrada' : `Parcela ${st.parcelaN} de ${st.parcelaTotal}`} da venda “${esc(venda.descricao)}”.</p>`
      : fixo
      ? `<p class="nota">${icon('repeat')} Vem do fixo “${esc(fixo.descricao)}”. O que mudar aqui vale só para ${esc(mesNome(st.competencia))}.</p>`
      : '';
    return `
      ${!orig && !ehFuncionario() ? segmentado('tipo', [['receita', 'Receita'], ['despesa', 'Despesa']], st.tipo, 'data-refaz') : ''}
      ${origem}
      ${grupo('', campo({ rotulo: 'Descrição', nome: 'descricao', valor: st.descricao, dica: rec ? 'Ex.: 500 panfletos' : 'Ex.: Resma de papel A4', attrs: 'autofocus' })
        + campo({ rotulo: 'Valor', nome: 'valor', tipo: 'dinheiro', valor: st.valor }))}
      ${grupo('', campo({ rotulo: 'Categoria', nome: 'categoria', tipo: 'select', valor: st.categoria, vazio: 'Sem categoria', opcoes: comAtual(categorias(st.tipo), st.categoria) })
        + (rec ? campoCliente(st.clienteId) : campo({ rotulo: 'Fornecedor', nome: 'fornecedor', valor: st.fornecedor, dica: 'Opcional' }))
        + campo({ rotulo: st.pago ? 'Data' : 'Vencimento', nome: 'vencimento', tipo: 'date', valor: st.vencimento }))}
      ${grupo('Pagamento', campo({ rotulo: rec ? 'Já recebi' : 'Já paguei', nome: 'pago', tipo: 'toggle', valor: st.pago, attrs: 'data-refaz' })
        + (st.pago ? campo({ rotulo: rec ? 'Recebido em' : 'Pago em', nome: 'pagoEm', tipo: 'date', valor: st.pagoEm || hoje() }) : '')
        + campo({ rotulo: 'Conta', nome: 'contaId', tipo: 'select', valor: st.contaId, opcoes: contasOps() })
        + campo({ rotulo: 'Forma', nome: 'forma', tipo: 'select', valor: st.forma, vazio: 'Não informada', opcoes: comAtual(config().formas, st.forma) }),
        st.pago ? '' : rec ? 'Fica em “A receber” até você marcar como recebido.' : 'Fica em “A pagar” até você marcar como pago.')}
      ${grupo('', campo({ rotulo: 'Observação', nome: 'obs', tipo: 'textarea', valor: st.obs || '', dica: 'Opcional' }))}
      ${orig ? botaoExcluir(fixo ? 'Pular este mês' : 'Excluir lançamento') : ''}`;
  };

  const folha = abrirFolha({
    titulo: orig ? (st.tipo === 'receita' ? 'Editar receita' : 'Editar despesa') : ehFuncionario() ? 'Nova receita' : 'Novo lançamento',
    corpo: html(),
    acao: (f) => {
      const v = { ...st, ...lerForm(f.form) };
      if (!(v.valor > 0)) return erroCampo(f.form, 'valor', 'Informe o valor.');
      if (!v.vencimento) return erroCampo(f.form, 'vencimento', 'Informe a data.');
      if (!v.descricao) v.descricao = v.categoria || (v.tipo === 'receita' ? 'Receita' : 'Despesa');
      if (v.pago && !v.pagoEm) v.pagoEm = hoje();
      if (!v.pago) v.pagoEm = '';
      if (v.tipo === 'receita') v.fornecedor = '';
      else v.clienteId = '';
      salvarLancamento({ ...v, id: orig?.id || uid() });
      aviso(orig ? 'Alterações salvas' : v.tipo === 'receita' ? 'Receita registrada' : 'Despesa registrada');
    },
    aoMontar: (f) => {
      const ligar = () => {
        ligarNovoCliente(f.form);
        $('[data-excluir]', f.form)?.addEventListener('click', async () => {
          const ok = await confirmar(fixo
            ? { titulo: 'Pular este mês?', mensagem: `“${st.descricao}” não será cobrado em ${mesNome(st.competencia)}. Os outros meses continuam.`, ok: 'Pular' }
            : { titulo: 'Excluir lançamento?', mensagem: 'Essa ação não pode ser desfeita.' });
          if (!ok) return;
          excluirEntrada(orig.id);
          f.fechar();
          aviso(fixo ? 'Mês pulado' : 'Lançamento excluído');
        });
      };
      ligar();
      f.form.addEventListener('change', (ev) => {
        if (ev.target.name === 'vencimento' && !orig) {
          const futuro = ev.target.value > hoje();
          const chave = f.form.elements.pago;
          if (futuro === chave.checked) {
            st = { ...st, ...lerForm(f.form), pago: !futuro, pagoEm: futuro ? '' : ev.target.value };
            f.form.innerHTML = html();
            ligar();
            return;
          }
          if (f.form.elements.pagoEm) f.form.elements.pagoEm.value = ev.target.value;
        }
        if (!ev.target.closest('[data-refaz]')) return;
        const antes = st.tipo;
        st = { ...st, ...lerForm(f.form) };
        if (st.tipo !== antes) st.categoria = '';
        if (st.pago && !st.pagoEm) st.pagoEm = st.vencimento <= hoje() ? st.vencimento : hoje();
        f.form.innerHTML = html();
        ligar();
      });
    },
  });
  return folha;
}

// ---------- Receber / pagar uma conta em aberto ----------

export function formPagamento(id) {
  const e = buscarEntrada(id);
  if (!e) return;
  const rec = e.tipo === 'receita';
  const parc = e.entrada ? 'Entrada' : e.parcelaTotal ? `Parcela ${e.parcelaN} de ${e.parcelaTotal}` : '';
  const quem = rec ? nomeCliente(e.clienteId) : e.fornecedor;
  abrirFolha({
    titulo: rec ? 'Receber' : 'Pagar',
    textoAcao: rec ? 'Receber' : 'Pagar',
    corpo: `
      <div class="resumo-folha">
        <b>${esc(e.descricao)}</b>
        <span>${[quem, parc, `venc. ${dataBR(e.vencimento)}`].filter(Boolean).map(esc).join(' · ')}</span>
      </div>
      ${grupo('', campo({ rotulo: 'Valor', nome: 'valor', tipo: 'dinheiro', valor: e.valor })
        + campo({ rotulo: rec ? 'Recebido em' : 'Pago em', nome: 'pagoEm', tipo: 'date', valor: hoje() })
        + campo({ rotulo: 'Conta', nome: 'contaId', tipo: 'select', valor: e.contaId || store.all('contas')[0]?.id, opcoes: contasOps() })
        + campo({ rotulo: 'Forma', nome: 'forma', tipo: 'select', valor: e.forma || 'Pix', vazio: 'Não informada', opcoes: comAtual(config().formas, e.forma) }),
        `Se o valor for menor que ${brl(e.valor)}, o restante continua em aberto.`)}`,
    acao: (f) => {
      const v = lerForm(f.form);
      if (!(v.valor > 0)) return erroCampo(f.form, 'valor', 'Informe o valor.');
      if (!v.pagoEm) return erroCampo(f.form, 'pagoEm', 'Informe a data.');
      const resto = round2(e.valor - v.valor);
      store.lote(() => {
        pagar(id, v);
        if (resto > 0) {
          const { virtual, fixoId, competencia, ...base } = e;
          salvarLancamento({ ...base, id: uid(), valor: resto, pago: false, pagoEm: '', descricao: e.descricao.replace(/ \(restante\)$/, '') + ' (restante)', criadoEm: '' });
        }
      });
      aviso(resto > 0 ? `Recebimento parcial. Restam ${brl(resto)} em aberto.` : rec ? 'Recebimento registrado' : 'Pagamento registrado', { acao: resto > 0 ? null : () => desfazerPagamento(id) });
    },
  });
}

/** Marca como pago na hora (hoje, conta e forma já definidas), com opção de desfazer. */
export function pagarRapido(id) {
  const e = buscarEntrada(id);
  if (!e) return;
  if (e.pago) {
    desfazerPagamento(id);
    return aviso('Marcado como pendente');
  }
  formPagamento(id);
}

// ---------- Venda parcelada ----------

export function formVenda({ clienteId = '' } = {}) {
  const contas = store.all('contas');
  const h = hoje();
  abrirFolha({
    titulo: 'Venda parcelada',
    corpo: `
      ${grupo('', campoCliente(clienteId, 'Cliente', 'Escolher…')
        + campo({ rotulo: 'Descrição', nome: 'descricao', dica: 'Ex.: 2 banners + 1.000 panfletos' })
        + campo({ rotulo: 'Categoria', nome: 'categoria', tipo: 'select', vazio: 'Sem categoria', opcoes: categorias('receita') })
        + campo({ rotulo: 'Valor total', nome: 'total', tipo: 'dinheiro' })
        + campo({ rotulo: 'Data da venda', nome: 'data', tipo: 'date', valor: h }))}
      ${grupo('Entrada', campo({ rotulo: 'Com entrada', nome: 'temEntrada', tipo: 'toggle', valor: false })
        + `<div data-so-entrada hidden>${campo({ rotulo: 'Valor da entrada', nome: 'entradaValor', tipo: 'dinheiro' })
          + campo({ rotulo: 'Forma', nome: 'entradaForma', tipo: 'select', valor: 'Pix', opcoes: config().formas })
          + campo({ rotulo: 'Entrada já recebida', nome: 'entradaPaga', tipo: 'toggle', valor: true })}</div>`)}
      ${grupo('Parcelas', campo({ rotulo: 'Quantidade', nome: 'nParcelas', tipo: 'select', valor: 2, opcoes: Array.from({ length: 24 }, (_, i) => [i + 1, `${i + 1}x`]) })
        + campo({ rotulo: '1º vencimento', nome: 'primeira', tipo: 'date', valor: addMeses(h, 1) })
        + `<div class="linha campo"><span class="campo-rotulo">Intervalo</span>${segmentado('intervalo', [['mensal', 'Mensal'], ['quinzenal', '15 dias'], ['semanal', 'Semanal']], 'mensal')}</div>`
        + campo({ rotulo: 'Forma', nome: 'forma', tipo: 'select', valor: 'Pix', opcoes: config().formas })
        + campo({ rotulo: 'Conta', nome: 'contaId', tipo: 'select', valor: contas[1]?.id || contas[0]?.id, opcoes: contasOps() }))}
      <section class="grupo"><h3 class="grupo-titulo">Como fica</h3><div class="lista" data-previa></div></section>
      ${grupo('', campo({ rotulo: 'Observação', nome: 'obs', tipo: 'textarea', dica: 'Opcional' }))}`,
    acao: (f) => {
      const v = lerForm(f.form);
      if (!v.clienteId || v.clienteId === '__novo') return erroCampo(f.form, 'clienteId', 'Escolha o cliente.');
      if (!(v.total > 0)) return erroCampo(f.form, 'total', 'Informe o valor total.');
      if (!v.data) return erroCampo(f.form, 'data', 'Informe a data da venda.');
      if (!v.temEntrada) v.entradaValor = 0;
      if (v.entradaValor >= v.total) return erroCampo(f.form, 'entradaValor', 'A entrada precisa ser menor que o total.');
      if (!v.primeira) return erroCampo(f.form, 'primeira', 'Informe o primeiro vencimento.');
      v.nParcelas = Number(v.nParcelas);
      if (!v.descricao) v.descricao = v.categoria || 'Venda';
      const id = criarVenda(v);
      aviso('Venda registrada');
      setTimeout(() => detalheVenda(id), 280);
    },
    aoMontar: (f) => {
      ligarNovoCliente(f.form);
      const previa = () => {
        const v = lerForm(f.form);
        $('[data-so-entrada]', f.form).hidden = !v.temEntrada;
        const entrada = v.temEntrada ? v.entradaValor : 0;
        const ps = v.total > 0 && v.primeira && entrada < v.total
          ? gerarParcelas({ total: v.total, entrada, n: Number(v.nParcelas), primeira: v.primeira, intervalo: v.intervalo }) : [];
        const linhas = [];
        if (entrada > 0) linhas.push(`<div class="linha"><div class="linha-txt"><b>Entrada</b><small>${dataBR(v.data)}${v.entradaPaga ? ' · já recebida' : ''}</small></div><span class="valor">${brl(entrada)}</span></div>`);
        for (const p of ps) linhas.push(`<div class="linha"><div class="linha-txt"><b>Parcela ${p.n}/${ps.length}</b><small>${dataBR(p.vencimento)}</small></div><span class="valor">${brl(p.valor)}</span></div>`);
        $('[data-previa]', f.form).innerHTML = linhas.join('') || '<div class="linha fraco">Preencha o valor total para ver as parcelas.</div>';
      };
      f.form.addEventListener('input', previa);
      f.form.addEventListener('change', previa);
      previa();
    },
  });
}

export function linhaParcela(p, { mostrarCliente = false } = {}) {
  const rec = p.tipo === 'receita';
  const tit = p.entrada ? 'Entrada' : p.parcelaTotal ? `Parcela ${p.parcelaN}/${p.parcelaTotal}` : p.descricao;
  const sub = p.pago ? `${rec ? 'Recebido' : 'Pago'} em ${dataBR(p.pagoEm)}` : `${dataBR(p.vencimento)} · ${prazoTexto(p.vencimento)}`;
  return `<div class="linha linha-toque" data-acao="editar-lanc" data-id="${p.id}" role="button" tabindex="0">
    <div class="linha-txt"><b>${esc(mostrarCliente ? p.descricao : tit)}</b><small class="${atrasado(p) ? 'txt-perigo' : ''}">${esc(mostrarCliente ? `${tit !== p.descricao ? tit + ' · ' : ''}${sub}` : sub)}</small></div>
    <span class="valor">${brl(p.valor)}</span>
    ${p.pago
      ? `<button type="button" class="btn-ic ok" data-acao="desfazer-pag" data-id="${p.id}" aria-label="Desfazer recebimento" title="Desfazer">${icon('checkCircle')}</button>`
      : `<button type="button" class="btn-pilula" data-acao="pagar" data-id="${p.id}">${rec ? 'Receber' : 'Pagar'}</button>`}
  </div>`;
}

export function detalheVenda(id) {
  const html = () => {
    const v = store.get(id);
    if (!v) return '';
    const i = infoVenda(v);
    const cli = store.get(v.clienteId);
    const st = i.status === 'atraso' ? selo('Em atraso', 'critico', 'alert') : i.status === 'emdia' ? selo('Em dia', 'bom', 'checkCircle') : selo('Quitada', 'neutro', 'check');
    return `
      <div class="resumo-folha">
        <b>${esc(v.descricao)}</b>
        <span>${esc(cli?.nome || 'Cliente removido')} · venda em ${dataBR(v.data)}</span>
        <div class="resumo-num"><strong>${brl(i.pago)}</strong><span>de ${brl(i.total)} recebidos</span>${st}</div>
        ${medidor(i.total ? i.pago / i.total : 0, { tipo: i.status === 'atraso' ? 'critico' : 'bom', rotulo: 'Recebido' })}
      </div>
      ${grupo('Parcelas', i.parcelas.map((p) => linhaParcela(p)).join(''), i.aberto > 0 ? `Falta receber ${brl(i.aberto)}${i.atrasado > 0 ? `, sendo ${brl(i.atrasado)} em atraso` : ''}.` : 'Tudo recebido.')}
      ${cli && i.aberto > 0 ? `<section class="grupo"><div class="lista"><button type="button" class="linha linha-botao" data-acao="cobrar" data-id="${cli.id}">${icon('message')}<span>Cobrar pelo WhatsApp</span></button></div></section>` : ''}
      ${botaoExcluir('Excluir venda e parcelas')}`;
  };
  if (!store.get(id)) return;
  let parar;
  const f = abrirFolha({
    titulo: 'Venda',
    corpo: html(),
    aoFechar: () => parar?.(),
    aoMontar: (fo) => {
      fo.form.addEventListener('click', async (ev) => {
        if (!ev.target.closest('[data-excluir]')) return;
        if (!(await confirmar({ titulo: 'Excluir esta venda?', mensagem: 'As parcelas e os recebimentos dela também serão apagados.' }))) return;
        fo.fechar();
        excluirVenda(id);
        aviso('Venda excluída');
      });
    },
  });
  parar = store.on(() => {
    if (!store.get(id)) return f.fechar();
    f.form.innerHTML = html();
  });
}

// ---------- Cliente ----------

export function formCliente(id, aoSalvar) {
  const c = id ? store.get(id) : null;
  abrirFolha({
    titulo: c ? 'Editar cliente' : 'Novo cliente',
    corpo: `
      ${grupo('', campo({ rotulo: 'Nome', nome: 'nome', valor: c?.nome, dica: 'Nome ou empresa', attrs: 'autofocus' })
        + campo({ rotulo: 'WhatsApp', nome: 'telefone', tipo: 'tel', valor: c?.telefone, dica: '(88) 90000-0000' })
        + campo({ rotulo: 'CPF / CNPJ', nome: 'doc', valor: c?.doc, dica: 'Opcional' })
        + campo({ rotulo: 'E-mail', nome: 'email', tipo: 'email', valor: c?.email, dica: 'Opcional' })
        + campo({ rotulo: 'Endereço', nome: 'endereco', valor: c?.endereco, dica: 'Opcional' }))}
      ${grupo('', campo({ rotulo: 'Observação', nome: 'obs', tipo: 'textarea', valor: c?.obs || '', dica: 'Opcional' }))}
      ${c ? botaoExcluir('Excluir cliente') : ''}`,
    acao: (f) => {
      const v = lerForm(f.form);
      if (!v.nome) return erroCampo(f.form, 'nome', 'Informe o nome do cliente.');
      const salvo = store.put('clientes', { ...(c || { criadoEm: new Date().toISOString() }), ...v, id: c?.id || uid() });
      aviso(c ? 'Cliente atualizado' : 'Cliente cadastrado');
      aoSalvar?.(salvo);
    },
    aoMontar: (f) => {
      $('[data-excluir]', f.form)?.addEventListener('click', async () => {
        const s = situacaoClientes().get(c.id);
        const msg = s?.aberto > 0 ? `Ele ainda tem ${brl(s.aberto)} em aberto. Os lançamentos continuam no caixa, sem o nome do cliente.` : 'O histórico de lançamentos continua no caixa, sem o nome do cliente.';
        if (!(await confirmar({ titulo: `Excluir ${c.nome}?`, mensagem: msg }))) return;
        f.fechar();
        excluirCliente(c.id);
        if (location.hash.includes(c.id)) location.hash = '#/clientes';
        aviso('Cliente excluído');
      });
    },
  });
}

/** Abre o WhatsApp com a cobrança das parcelas em aberto do cliente. */
export function cobrar(clienteId) {
  const s = situacaoClientes().get(clienteId);
  if (!s) return;
  if (!s.cliente.telefone) {
    aviso('Cadastre o WhatsApp do cliente para cobrar.', { tipo: 'erro' });
    return formCliente(clienteId);
  }
  const h = hoje();
  const abertas = store.all('lancamentos').filter((l) => l.clienteId === clienteId && l.tipo === 'receita' && !l.pago && !l.ignorado)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const vencidas = abertas.filter((l) => l.vencimento < h);
  const lista = (vencidas.length ? vencidas : abertas.slice(0, 3)).map((l) => {
    const p = l.entrada ? 'entrada' : l.parcelaTotal ? `parcela ${l.parcelaN}/${l.parcelaTotal}` : '';
    return `• ${l.descricao}${p ? ` (${p})` : ''}: ${brl(l.valor)}, ${l.vencimento < h ? 'venceu' : 'vence'} em ${dataBR(l.vencimento)}`;
  });
  const total = vencidas.length ? s.atrasado : abertas.slice(0, 3).reduce((t, l) => t + l.valor, 0);
  const primeiro = s.cliente.nome.split(' ')[0];
  const texto = vencidas.length
    ? `Olá, ${primeiro}! Aqui é da ${config().empresa}. Tudo bem?\n\nConsta em aberto com a gente:\n${lista.join('\n')}\n\nTotal: ${brl(total)}\n\nConsegue acertar ou combinar uma data? Qualquer dúvida é só chamar. Obrigado!`
    : `Olá, ${primeiro}! Aqui é da ${config().empresa}. Passando para lembrar dos próximos vencimentos:\n${lista.join('\n')}\n\nQualquer dúvida é só chamar. Obrigado!`;
  window.open(linkWhats(s.cliente.telefone, texto), '_blank', 'noopener');
}

// ---------- Gasto fixo / receita recorrente ----------

export function formFixo({ id, tipo = 'despesa' } = {}) {
  if (ehFuncionario()) return;
  const orig = id ? store.get(id) : null;
  const atual = ymAtual();
  let st = orig ? { ...orig } : {
    tipo, descricao: '', valor: 0, categoria: '', dia: Math.min(28, Number(hoje().slice(8))), inicio: atual, parcelado: false,
    parcelas: 12, parcelaInicial: 1, fim: '', fornecedor: '', clienteId: '', forma: '', contaId: store.all('contas')[1]?.id || store.all('contas')[0]?.id || '', ativo: true,
  };
  const meses = (de, ate) => {
    const out = [];
    for (let i = de; i <= ate; i++) out.push([ymAdd(atual, i), mesCurto(ymAdd(atual, i))]);
    return out;
  };
  const comMes = (lista, ym) => (ym && !lista.some(([v]) => v === ym) ? [[ym, mesCurto(ym)], ...lista] : lista);

  const html = () => {
    const desp = st.tipo !== 'receita';
    const fim = fimDoFixo(st);
    const faltam = st.parcelado ? Math.max(0, st.parcelas - (st.parcelaInicial || 1) + 1) : 0;
    return `
      ${!orig ? segmentado('tipo', [['despesa', 'Gasto fixo'], ['receita', 'Receita recorrente']], st.tipo, 'data-refaz') : ''}
      ${grupo('', campo({ rotulo: 'Descrição', nome: 'descricao', valor: st.descricao, dica: desp ? 'Ex.: Aluguel, parcela da impressora' : 'Ex.: Contrato mensal de impressões', attrs: 'autofocus' })
        + campo({ rotulo: st.parcelado ? 'Valor da parcela' : 'Valor por mês', nome: 'valor', tipo: 'dinheiro', valor: st.valor })
        + campo({ rotulo: 'Categoria', nome: 'categoria', tipo: 'select', valor: st.categoria, vazio: 'Sem categoria', opcoes: comAtual(categorias(desp ? 'despesa' : 'receita'), st.categoria) })
        + (desp ? campo({ rotulo: 'Fornecedor', nome: 'fornecedor', valor: st.fornecedor, dica: 'Opcional' }) : campoCliente(st.clienteId)))}
      ${grupo('Quando vence', campo({ rotulo: 'Dia do vencimento', nome: 'dia', tipo: 'select', valor: st.dia, opcoes: Array.from({ length: 31 }, (_, i) => [i + 1, `Dia ${i + 1}`]) })
        + campo({ rotulo: orig ? 'Começou em' : st.parcelado ? 'Próxima parcela em' : 'Começa em', nome: 'inicio', tipo: 'select', valor: st.inicio, opcoes: comMes(meses(-12, 24), st.inicio), attrs: 'data-refaz' }))}
      ${grupo('Parcelamento', campo({ rotulo: 'É parcelado', nome: 'parcelado', tipo: 'toggle', valor: st.parcelado, attrs: 'data-refaz' })
        + (st.parcelado
          ? campo({ rotulo: 'Total de parcelas', nome: 'parcelas', tipo: 'number', valor: st.parcelas, attrs: 'min="1" max="360" data-refaz' })
            + campo({ rotulo: orig ? 'Começou na parcela nº' : 'Próxima é a nº', nome: 'parcelaInicial', tipo: 'number', valor: st.parcelaInicial || 1, attrs: 'min="1" max="360" data-refaz' })
          : campo({ rotulo: 'Termina em', nome: 'fim', tipo: 'select', valor: st.fim, vazio: 'Sem data para acabar', opcoes: comMes(meses(0, 60), st.fim) })),
        st.parcelado
          ? orig
            ? `<b>Acaba em ${esc(mesNome(fim))}.</b> ${fim < atual ? 'Já terminou.' : st.inicio > atual ? `Começa em ${esc(mesCurto(st.inicio))}.` : `Em ${esc(mesCurto(atual))} está na parcela ${parcelaDoFixo(st, atual)} de ${st.parcelas}.`}`
            : `<b>Acaba em ${esc(mesNome(fim))}.</b> ${faltam === 1 ? 'Falta 1 parcela' : `Faltam ${faltam} parcelas`}${st.valor ? ` (${brl(faltam * st.valor)})` : ''} a partir de ${esc(mesCurto(st.inicio))}.`
          : 'Use o parcelamento para financiamentos, compras parceladas e empréstimos: o app mostra quando acaba.')}
      ${grupo('Pagamento', campo({ rotulo: 'Conta', nome: 'contaId', tipo: 'select', valor: st.contaId, opcoes: contasOps() })
        + campo({ rotulo: 'Forma', nome: 'forma', tipo: 'select', valor: st.forma, vazio: 'Não informada', opcoes: comAtual(config().formas, st.forma) }))}
      ${orig ? grupo('', campo({ rotulo: 'Ativo', nome: 'ativo', tipo: 'toggle', valor: st.ativo !== false }), 'Desative para pausar as cobranças sem perder o histórico.') + botaoExcluir('Excluir') : ''}`;
  };

  abrirFolha({
    titulo: orig ? 'Editar fixo' : 'Novo fixo',
    corpo: html(),
    acao: (f) => {
      const v = { ...st, ...lerForm(f.form) };
      if (!v.descricao) return erroCampo(f.form, 'descricao', 'Informe a descrição.');
      if (!(v.valor > 0)) return erroCampo(f.form, 'valor', 'Informe o valor.');
      v.dia = Number(v.dia);
      if (v.parcelado) {
        v.parcelas = Math.max(1, Math.round(v.parcelas || 1));
        v.parcelaInicial = Math.max(1, Math.min(v.parcelas, Math.round(v.parcelaInicial || 1)));
        v.fim = '';
      } else {
        v.parcelas = 0;
        v.parcelaInicial = 1;
        if (v.fim && v.fim < v.inicio) return erroCampo(f.form, 'fim', 'O término não pode ser antes do início.');
      }
      if (!orig) v.ativo = true;
      store.put('fixos', { ...v, id: orig?.id || uid() });
      aviso(orig ? 'Alterações salvas' : 'Fixo cadastrado');
    },
    aoMontar: (f) => {
      const ligar = () => {
        ligarNovoCliente(f.form);
        $('[data-excluir]', f.form)?.addEventListener('click', async () => {
          if (!(await confirmar({ titulo: `Excluir “${orig.descricao}”?`, mensagem: 'Os meses já pagos continuam no caixa. As cobranças futuras deixam de aparecer.' }))) return;
          f.fechar();
          excluirFixo(orig.id);
          aviso('Fixo excluído');
        });
      };
      ligar();
      f.form.addEventListener('change', (ev) => {
        if (!ev.target.closest('[data-refaz]')) return;
        const antes = st.tipo;
        st = { ...st, ...lerForm(f.form) };
        if (st.tipo !== antes) st.categoria = '';
        st.parcelas = Math.max(1, Math.round(st.parcelas || 12));
        st.parcelaInicial = Math.max(1, Math.min(st.parcelas, Math.round(st.parcelaInicial || 1)));
        f.form.innerHTML = html();
        ligar();
      });
    },
  });
}

// ---------- Transferência e contas ----------

export function formTransferencia(orig) {
  if (ehFuncionario()) return;
  const contas = store.all('contas');
  if (contas.length < 2) return aviso('Cadastre pelo menos duas contas em Ajustes.', { tipo: 'erro' });
  abrirFolha({
    titulo: orig ? 'Editar transferência' : 'Transferência',
    corpo: `
      ${grupo('', campo({ rotulo: 'De', nome: 'contaId', tipo: 'select', valor: orig?.contaId || contas[0].id, opcoes: contasOps() })
        + campo({ rotulo: 'Para', nome: 'contaDestinoId', tipo: 'select', valor: orig?.contaDestinoId || contas[1].id, opcoes: contasOps() })
        + campo({ rotulo: 'Valor', nome: 'valor', tipo: 'dinheiro', valor: orig?.valor })
        + campo({ rotulo: 'Data', nome: 'pagoEm', tipo: 'date', valor: orig?.pagoEm || hoje() }),
        'Use para depósitos e sangrias: tirar do caixa e colocar no banco, por exemplo. Não conta como receita nem despesa.')}
      ${orig ? botaoExcluir('Excluir transferência') : ''}`,
    acao: (f) => {
      const v = lerForm(f.form);
      if (v.contaId === v.contaDestinoId) return erroCampo(f.form, 'contaDestinoId', 'Escolha contas diferentes.');
      if (!(v.valor > 0)) return erroCampo(f.form, 'valor', 'Informe o valor.');
      if (!v.pagoEm) return erroCampo(f.form, 'pagoEm', 'Informe a data.');
      const nome = (id) => store.get(id)?.nome || '';
      salvarLancamento({ ...(orig || {}), ...v, id: orig?.id || uid(), tipo: 'transferencia', descricao: `${nome(v.contaId)} → ${nome(v.contaDestinoId)}`, vencimento: v.pagoEm, pago: true });
      aviso('Transferência registrada');
    },
    aoMontar: (f) => {
      $('[data-excluir]', f.form)?.addEventListener('click', async () => {
        if (!(await confirmar({ titulo: 'Excluir transferência?' }))) return;
        f.fechar();
        store.remove(orig.id);
      });
    },
  });
}

export function formConta(id) {
  const c = id ? store.get(id) : null;
  const neg = (c?.saldoInicial || 0) < 0;
  abrirFolha({
    titulo: c ? 'Editar conta' : 'Nova conta',
    corpo: `
      ${grupo('', campo({ rotulo: 'Nome', nome: 'nome', valor: c?.nome, dica: 'Ex.: Banco do Brasil', attrs: 'autofocus' })
        + campo({ rotulo: 'Saldo inicial', nome: 'saldoInicial', tipo: 'dinheiro', valor: Math.abs(c?.saldoInicial || 0) })
        + campo({ rotulo: 'Saldo negativo', nome: 'negativo', tipo: 'toggle', valor: neg }),
        'Saldo inicial é quanto havia na conta quando você começou a usar o app.')}
      ${c && store.all('contas').length > 1 ? botaoExcluir('Excluir conta') : ''}`,
    acao: (f) => {
      const { negativo, ...v } = lerForm(f.form);
      if (!v.nome) return erroCampo(f.form, 'nome', 'Informe o nome da conta.');
      if (negativo) v.saldoInicial = -v.saldoInicial;
      store.put('contas', { ...(c || {}), ...v, id: c?.id || uid() });
      aviso('Conta salva');
    },
    aoMontar: (f) => {
      $('[data-excluir]', f.form)?.addEventListener('click', async () => {
        if (!(await confirmar({ titulo: `Excluir ${c.nome}?`, mensagem: 'Os lançamentos dessa conta passam a contar na primeira conta da lista.' }))) return;
        f.fechar();
        store.remove(c.id);
      });
    },
  });
}

// ---------- Menu "+" ----------

export function menuNovo() {
  if (ehFuncionario()) {
    return menuAcoes([
      { rotulo: 'Receita', sub: 'Venda à vista ou valor a receber', icone: 'inflow', fn: () => formLancamento({ tipo: 'receita' }) },
      { rotulo: 'Venda parcelada', sub: 'Com ou sem entrada', icone: 'layers', fn: () => formVenda() },
      { rotulo: 'Cliente', icone: 'userPlus', fn: () => formCliente() },
    ], 'Novo');
  }
  menuAcoes([
    { rotulo: 'Receita', sub: 'Venda à vista ou valor a receber', icone: 'inflow', fn: () => formLancamento({ tipo: 'receita' }) },
    { rotulo: 'Despesa', sub: 'Compra, conta ou pagamento', icone: 'outflow', fn: () => formLancamento({ tipo: 'despesa' }) },
    { rotulo: 'Venda parcelada', sub: 'Com ou sem entrada', icone: 'layers', fn: () => formVenda() },
    { rotulo: 'Cliente', icone: 'userPlus', fn: () => formCliente() },
    { rotulo: 'Gasto fixo', sub: 'Aluguel, financiamento, mensalidade', icone: 'repeat', fn: () => formFixo() },
    { rotulo: 'Transferência entre contas', icone: 'transfer', fn: () => formTransferencia() },
  ], 'Novo');
}

/** Ações comuns disparadas por data-acao em qualquer tela ou folha. */
export const acoesGlobais = {
  'novo': () => menuNovo(),
  'nova-receita': () => formLancamento({ tipo: 'receita' }),
  'nova-despesa': () => formLancamento({ tipo: 'despesa' }),
  'nova-venda': (el) => formVenda({ clienteId: el.dataset.cliente || '' }),
  'novo-cliente': () => formCliente(),
  'novo-fixo': (el) => formFixo({ tipo: el.dataset.tipo || 'despesa' }),
  'editar-lanc': (el) => formLancamento({ id: el.dataset.id }),
  'pagar': (el) => formPagamento(el.dataset.id),
  'desfazer-pag': (el) => {
    desfazerPagamento(el.dataset.id);
    aviso('Marcado como pendente');
  },
  'abrir-venda': (el) => detalheVenda(el.dataset.id),
  'editar-cliente': (el) => formCliente(el.dataset.id),
  'editar-fixo': (el) => formFixo({ id: el.dataset.id }),
  'cobrar': (el) => cobrar(el.dataset.id),
  'ir': (el) => (location.hash = el.dataset.rota),
};
