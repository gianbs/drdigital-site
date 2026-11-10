// Ajustes: empresa, metas, contas, categorias, nuvem e dados.

import { store, config, salvarConfig, semear } from '../store.js';
import { esc, brl, pct } from '../util.js';
import { icon } from '../icons.js';
import { abrirFolha, confirmar, aviso, grupo, campo, segmentado, lerForm, erroCampo } from '../ui.js';
import { saldos } from '../calc.js';
import { formConta, formTransferencia } from '../forms.js';
import { exportarExcel, exportarCSV, exportarBackup } from '../exportar.js';
import { estado, nuvemLigada, sincronizar, sair, pendentes } from '../sync.js';
import { carregarExemplo } from '../demo.js';

const linhaNav = (icone, titulo, valor, acao, extra = '') =>
  `<button type="button" class="linha linha-toque" data-acao="${acao}" ${extra}>${icone ? `<span class="bolha neutra">${icon(icone)}</span>` : ''}<div class="linha-txt"><b>${esc(titulo)}</b></div><span class="linha-valor">${esc(valor)}</span>${icon('chevR', 'seta')}</button>`;

export function temaAtual() {
  try {
    return localStorage.getItem('caixa-tema') || 'auto';
  } catch (e) {
    return 'auto';
  }
}
export function aplicarTema(t = temaAtual()) {
  const el = document.documentElement;
  if (t === 'auto') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', t === 'escuro' ? 'dark' : 'light');
  try {
    localStorage.setItem('caixa-tema', t);
  } catch (e) { /* sem armazenamento: vale só nesta sessão */ }
}

function nuvem() {
  if (!nuvemLigada) {
    return grupo('Nuvem', `<div class="linha linha-alta"><span class="bolha neutra">${icon('cloudOff')}</span><div class="linha-txt"><b>Modo local</b><small>Os dados estão salvos só neste aparelho. Para acessar de qualquer dispositivo, ligue a nuvem seguindo o passo a passo do arquivo LEIA-ME.</small></div></div>`,
      'Enquanto isso, faça um backup de vez em quando em “Dados”.');
  }
  const txt = { ok: 'Sincronizado', sincronizando: 'Sincronizando…', offline: 'Sem internet', erro: 'Erro ao sincronizar', saiu: 'Desconectado' }[estado.status] || '';
  const n = pendentes();
  return grupo('Nuvem', `
    <div class="linha linha-alta"><span class="bolha ${estado.status === 'ok' ? 'entrada' : estado.status === 'erro' ? 'saida' : 'neutra'}">${icon(estado.status === 'offline' || estado.status === 'erro' ? 'cloudOff' : 'cloud')}</span>
      <div class="linha-txt"><b>${esc(txt)}</b><small>${esc(estado.email)}${n ? ` · ${n} ${n === 1 ? 'alteração' : 'alterações'} para enviar` : ''}${estado.erro ? ` · ${esc(estado.erro)}` : ''}</small></div></div>
    <button type="button" class="linha linha-botao" data-acao="sincronizar">${icon('refresh')}<span>Sincronizar agora</span></button>
    <button type="button" class="linha linha-botao perigo" data-acao="sair">${icon('logout')}<span>Sair desta conta</span></button>`,
    'Seus dados ficam salvos na nuvem e aparecem em qualquer aparelho em que você entrar. Sem internet, o app continua funcionando e envia tudo quando a conexão voltar.');
}

function editarLista(chave, titulo, dica) {
  abrirFolha({
    titulo,
    corpo: `${grupo('', `<label class="linha campo campo-area"><textarea name="itens" rows="14" aria-label="${esc(titulo)}">${esc(config()[chave].join('\n'))}</textarea></label>`, dica)}`,
    acao: (f) => {
      const itens = [...new Set(lerForm(f.form).itens.split('\n').map((s) => s.trim()).filter(Boolean))];
      if (!itens.length) return erroCampo(f.form, 'itens', 'Deixe pelo menos um item.');
      salvarConfig({ [chave]: itens });
      aviso('Lista atualizada');
    },
  });
}

export default {
  titulo: 'Ajustes',
  render() {
    const c = config();
    const sd = saldos();
    return `
      ${nuvem()}
      ${grupo('Empresa e metas',
        linhaNav('building', 'Nome', c.empresa, 'editar-empresa')
        + linhaNav('target', 'Meta de vendas por mês', c.metaMensal ? brl(c.metaMensal) : 'Definir', 'editar-empresa')
        + linhaNav('up', 'Margem de lucro desejada', pct((c.margemAlvo || 0) / 100), 'editar-empresa'),
        'A margem desejada define quando o painel mostra “Lucro saudável”.')}
      ${grupo('Contas e saldos',
        sd.porConta.map((x) => `<button type="button" class="linha linha-toque" data-acao="editar-conta" data-id="${x.conta.id}"><span class="bolha neutra">${icon(x.conta.tipo === 'caixa' ? 'cash' : 'bank')}</span><div class="linha-txt"><b>${esc(x.conta.nome)}</b><small>Saldo inicial ${brl(x.conta.saldoInicial || 0)}</small></div><span class="valor ${x.saldo < 0 ? 'txt-perigo' : ''}">${brl(x.saldo)}</span>${icon('chevR', 'seta')}</button>`).join('')
        + `<button type="button" class="linha linha-botao" data-acao="nova-conta">${icon('plus')}<span>Nova conta</span></button>
           <button type="button" class="linha linha-botao" data-acao="transferir">${icon('transfer')}<span>Transferir entre contas</span></button>`,
        `Saldo total: <b>${brl(sd.total)}</b>`)}
      ${grupo('Listas',
        linhaNav('tag', 'Categorias de receita', String(c.categoriasReceita.length), 'editar-lista', 'data-chave="categoriasReceita"')
        + linhaNav('tag', 'Categorias de despesa', String(c.categoriasDespesa.length), 'editar-lista', 'data-chave="categoriasDespesa"')
        + linhaNav('card', 'Formas de pagamento', String(c.formas.length), 'editar-lista', 'data-chave="formas"'))}
      ${grupo('Aparência', `<div class="linha campo"><span class="campo-rotulo">Tema</span>${segmentado('tema', [['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']], temaAtual(), 'data-muda="tema"')}</div>`)}
      ${grupo('Dados', `
        <button type="button" class="linha linha-botao" data-acao="exportar-excel">${icon('sheet')}<span>Exportar para planilha (.xlsx)</span></button>
        <button type="button" class="linha linha-botao" data-acao="exportar-csv">${icon('download')}<span>Exportar lançamentos (.csv)</span></button>
        <button type="button" class="linha linha-botao" data-acao="backup">${icon('database')}<span>Salvar backup</span></button>
        <label class="linha linha-botao">${icon('upload')}<span>Restaurar backup</span><input type="file" accept="application/json,.json" data-restaurar hidden></label>
        <button type="button" class="linha linha-botao" data-acao="exemplo">${icon('flag')}<span>Carregar dados de exemplo</span></button>
        <button type="button" class="linha linha-botao perigo" data-acao="apagar-tudo">${icon('trash')}<span>Apagar todos os dados</span></button>`)}
      <p class="rodape-app">Controle de Caixa · ${esc(c.empresa)}</p>`;
  },
  montar(el) {
    el.querySelector('[data-restaurar]')?.addEventListener('change', async (ev) => {
      const arq = ev.target.files[0];
      if (!arq) return;
      try {
        const json = JSON.parse(await arq.text());
        if (!(await confirmar({ titulo: 'Restaurar este backup?', mensagem: `Os dados atuais serão substituídos pelos ${json.docs?.length || 0} registros do arquivo.`, ok: 'Restaurar' }))) return;
        store.importar(json);
        aviso('Backup restaurado');
      } catch (e) {
        aviso(e.message || 'Não foi possível ler o arquivo.', { tipo: 'erro' });
      }
    });
  },
  mudou(nome, valor) {
    if (nome === 'tema') aplicarTema(valor);
  },
  acoes: {
    'editar-empresa': () => {
      const c = config();
      abrirFolha({
        titulo: 'Empresa e metas',
        corpo: grupo('', campo({ rotulo: 'Nome', nome: 'empresa', valor: c.empresa })
          + campo({ rotulo: 'Meta de vendas/mês', nome: 'metaMensal', tipo: 'dinheiro', valor: c.metaMensal })
          + campo({ rotulo: 'Margem desejada (%)', nome: 'margemAlvo', tipo: 'number', valor: c.margemAlvo, attrs: 'min="0" max="100"' }),
          'Margem é o quanto sobra de cada real recebido. Com meta de 20%, o painel mostra “Lucro saudável” quando sobram pelo menos R$ 20 a cada R$ 100 recebidos.'),
        acao: (f) => {
          const v = lerForm(f.form);
          if (!v.empresa) return erroCampo(f.form, 'empresa', 'Informe o nome.');
          v.margemAlvo = Math.max(0, Math.min(100, v.margemAlvo));
          salvarConfig(v);
          aviso('Ajustes salvos');
        },
      });
      return false;
    },
    'editar-conta': (el) => (formConta(el.dataset.id), false),
    'nova-conta': () => (formConta(), false),
    'transferir': () => (formTransferencia(), false),
    'editar-lista': (el) => {
      const k = el.dataset.chave;
      editarLista(k, el.querySelector('b').textContent, k === 'formas' ? 'Uma forma de pagamento por linha.' : 'Uma categoria por linha. Lançamentos antigos mantêm a categoria que já tinham.');
      return false;
    },
    'sincronizar': async () => {
      const ok = await sincronizar();
      aviso(ok ? 'Tudo sincronizado' : estado.erro || 'Não foi possível sincronizar agora.', { tipo: ok ? '' : 'erro' });
    },
    'sair': async () => {
      const n = pendentes();
      if (!(await confirmar({ titulo: 'Sair desta conta?', mensagem: n && !navigator.onLine ? `Há ${n} alterações que ainda não foram enviadas. Elas ficam guardadas neste aparelho e sobem no próximo login.` : 'Você precisará do e-mail e da senha para entrar de novo.', ok: 'Sair' }))) return false;
      await sair();
      return false;
    },
    'backup': () => (exportarBackup(), false),
    'apagar-tudo': async () => {
      if (!(await confirmar({ titulo: 'Apagar todos os dados?', mensagem: nuvemLigada ? 'Clientes, lançamentos, vendas e fixos serão apagados neste aparelho e na nuvem. Não dá para desfazer.' : 'Clientes, lançamentos, vendas e fixos serão apagados. Não dá para desfazer.', ok: 'Apagar tudo' }))) return false;
      store.apagarTudo();
      semear();
      aviso('Dados apagados');
    },
  },
};

/** Ações de exportação e exemplo, usadas em mais de uma tela. */
export const acoesDados = {
  'exportar-excel': () => {
    exportarExcel();
    aviso('Planilha gerada');
  },
  'exportar-csv': () => {
    exportarCSV();
    aviso('Arquivo CSV gerado');
  },
  'exemplo': async () => {
    const tem = store.all('lancamentos').length > 0;
    if (!(await confirmar({ titulo: 'Carregar dados de exemplo?', mensagem: tem ? 'Os exemplos serão somados aos seus dados atuais. Para tirar depois, use “Apagar todos os dados”.' : 'Entram clientes, vendas e despesas fictícias de uma gráfica. Para tirar depois, use “Apagar todos os dados” em Ajustes.', ok: 'Carregar', destrutivo: false }))) return;
    carregarExemplo();
    aviso('Dados de exemplo carregados');
  },
};
