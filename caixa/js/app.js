// Ponto de partida: monta a estrutura (barra lateral / abas), navega entre telas e liga os eventos.

import { store } from './store.js';
import { $, $$, esc, debounce } from './util.js';
import { icon } from './icons.js';
import { confirmar, aviso, fecharTodas, esconderDica } from './ui.js';
import { acoesGlobais } from './forms.js';
import * as nuvem from './sync.js';
import resumo from './views/resumo.js';
import lancamentos from './views/lancamentos.js';
import contas from './views/contas.js';
import vendas from './views/vendas.js';
import clientes from './views/clientes.js';
import fixos from './views/fixos.js';
import relatorios from './views/relatorios.js';
import ajustes, { acoesDados, aplicarTema } from './views/ajustes.js';
import mais from './views/mais.js';

const TELAS = { resumo, lancamentos, contas, vendas, clientes, fixos, relatorios, ajustes, mais };
const MENU = [
  ['resumo', 'Resumo'], ['lancamentos', 'Lançamentos'], ['contas', 'A receber e a pagar'], ['vendas', 'Vendas parceladas'],
  ['clientes', 'Clientes'], ['fixos', 'Gastos fixos'], ['relatorios', 'Relatórios'], ['ajustes', 'Ajustes'],
];
const ABAS = [['resumo', 'Resumo'], ['lancamentos', 'Lançamentos'], ['contas', 'Contas'], ['clientes', 'Clientes'], ['mais', 'Mais']];
const DENTRO_DE_MAIS = ['vendas', 'fixos', 'relatorios', 'ajustes'];
// Funcionário: só as telas de venda e recebimento.
const MENU_FUNC = [['lancamentos', 'Receitas'], ['contas', 'A receber'], ['vendas', 'Vendas parceladas'], ['clientes', 'Clientes'], ['ajustes', 'Conta']];
const ABAS_FUNC = [['lancamentos', 'Receitas'], ['contas', 'A receber'], ['vendas', 'Vendas'], ['clientes', 'Clientes'], ['ajustes', 'Conta']];
const func = () => nuvem.ehFuncionario();
const inicio = () => (func() ? 'lancamentos' : 'resumo');
const ACOES = { ...acoesGlobais, ...acoesDados };

let pronto = false;

function rota() {
  const [nome = '', param = ''] = location.hash.replace(/^#\/?/, '').split('/');
  const ok = TELAS[nome] && (!func() || MENU_FUNC.some(([r]) => r === nome));
  return ok ? { nome, param: decodeURIComponent(param) } : { nome: inicio(), param: '' };
}

function casca() {
  const MENU_ = func() ? MENU_FUNC : MENU;
  const ABAS_ = func() ? ABAS_FUNC : ABAS;
  $('#app').innerHTML = `
    <aside class="lateral">
      <a class="marca" href="#/${inicio()}" aria-label="Dr Digital Gráfica"><img class="logo-claro" src="assets/logo.svg" alt="Dr Digital Gráfica"><img class="logo-escuro" src="assets/logo-white.svg" alt=""></a>
      <div class="cmyk" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <button class="btn" data-acao="novo">${icon('plus')}${func() ? 'Novo' : 'Novo lançamento'}</button>
      <nav aria-label="Menu">${MENU_.map(([r, t]) => `<a href="#/${r}" data-nav="${r}">${icon(r)}<span>${t}</span></a>`).join('')}</nav>
      <a class="lateral-pe" href="#/ajustes" id="nuvem-lateral"></a>
    </aside>
    <div class="conteudo">
      <header class="topo">
        <div class="topo-esq"><a class="topo-voltar" hidden></a><img class="topo-logo" src="assets/icon.svg" alt="Dr Digital"></div>
        <span class="topo-mini" aria-hidden="true"></span>
        <div class="topo-acoes"><a class="btn-ic" href="#/ajustes" id="nuvem-topo"></a></div>
      </header>
      <main id="tela" tabindex="-1"><h1 class="titulo-grande"></h1><div id="visao" class="visao"></div></main>
    </div>
    <nav class="abas" aria-label="Abas">
      <div class="abas-capsula">${ABAS_.map(([r, t]) => `<a href="#/${r}" data-aba="${r}">${icon(r)}<span>${t}</span></a>`).join('')}</div>
      <button class="abas-mais" data-acao="novo" aria-label="Novo lançamento">${icon('plus')}</button>
    </nav>`;
}

function desenhar(manter = true) {
  if (!pronto) return;
  const { nome, param } = rota();
  const tela = TELAS[nome];
  const visao = $('#visao');
  const y = scrollY;
  const ativo = document.activeElement;
  const foco = ativo?.dataset?.digita && visao.contains(ativo) ? { k: ativo.dataset.digita, a: ativo.selectionStart, b: ativo.selectionEnd } : null;
  const titulo = tela.tituloDe ? tela.tituloDe(param) : tela.titulo;
  $('.titulo-grande').textContent = titulo;
  $('.topo-mini').textContent = titulo;
  document.title = `${titulo} · Caixa Dr Digital`;
  visao.className = `visao visao-${nome}`;
  esconderDica();
  visao.innerHTML = tela.render(param);
  tela.montar?.(visao);

  const emMais = !func() && DENTRO_DE_MAIS.includes(nome);
  const abaAtiva = emMais ? 'mais' : nome;
  $$('[data-aba]').forEach((a) => a.classList.toggle('ativo', a.dataset.aba === abaAtiva));
  $$('[data-nav]').forEach((a) => {
    a.classList.toggle('ativo', a.dataset.nav === nome);
    a.dataset.nav === nome ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  const voltar = $('.topo-voltar');
  const destino = emMais ? ['#/mais', 'Mais'] : nome === 'clientes' && param ? ['#/clientes', 'Clientes'] : null;
  voltar.hidden = !destino;
  $('.topo-logo').hidden = !!destino;
  if (destino) {
    voltar.href = destino[0];
    voltar.innerHTML = `${icon('chevL')}${destino[1]}`;
  }
  if (manter) scrollTo(0, y);
  else scrollTo(0, 0);
  if (foco) {
    const el = $(`[data-digita="${foco.k}"]`, visao);
    if (el) {
      el.focus();
      try {
        el.setSelectionRange(foco.a, foco.b);
      } catch (e) { /* campo sem seleção de texto */ }
    }
  }
}

let quadro = 0;
const agendar = () => {
  cancelAnimationFrame(quadro);
  quadro = requestAnimationFrame(() => desenhar(true));
};

function indicadorNuvem() {
  const e = nuvem.estado;
  const mapa = {
    local: ['cloudOff', 'Modo local', 'Dados só neste aparelho'],
    ok: ['cloud', 'Sincronizado', e.email],
    sincronizando: ['refresh', 'Sincronizando…', e.email],
    offline: ['cloudOff', 'Sem internet', 'Envia quando a conexão voltar'],
    erro: ['cloudOff', 'Erro ao sincronizar', e.erro],
    saiu: ['cloudOff', 'Desconectado', ''],
  };
  const [ic, t, sub] = mapa[e.status] || mapa.local;
  const lat = $('#nuvem-lateral');
  if (lat) lat.innerHTML = `${icon(ic)}<span><b>${esc(t)}</b>${esc(sub || '')}</span>`;
  const topo = $('#nuvem-topo');
  if (topo) {
    topo.innerHTML = icon(ic);
    topo.setAttribute('aria-label', `Nuvem: ${t}`);
    topo.title = t;
    topo.style.color = e.status === 'erro' ? 'var(--vermelho-txt)' : e.status === 'ok' ? 'var(--tint)' : 'var(--texto-2)';
  }
}

// ---------- Login ----------
function telaLogin() {
  pronto = false;
  fecharTodas();
  document.title = 'Entrar · Caixa Dr Digital';
  $('#app').innerHTML = `
    <div class="login"><form class="login-cartao" novalidate>
      <img class="logo-claro" src="assets/logo.svg" alt="Dr Digital Gráfica"><img class="logo-escuro" src="assets/logo-white.svg" alt="Dr Digital Gráfica">
      <div class="cmyk" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <h1>Controle de Caixa</h1>
      <p>Entre para acessar seus dados de qualquer aparelho.</p>
      <div class="lista">
        <label class="linha campo"><span class="campo-rotulo">E-mail</span><input type="email" name="email" autocomplete="username" placeholder="voce@exemplo.com" required></label>
        <label class="linha campo"><span class="campo-rotulo">Senha</span><input type="password" name="senha" autocomplete="current-password" placeholder="Sua senha" required></label>
      </div>
      <p class="login-erro" role="alert"></p>
      <button class="btn largo" type="submit">Entrar</button>
    </form></div>`;
  const form = $('.login-cartao');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const erro = $('.login-erro');
    const botao = $('button', form);
    const email = form.elements.email.value.trim();
    const senha = form.elements.senha.value;
    if (!email || !senha) return (erro.textContent = 'Preencha o e-mail e a senha.');
    erro.textContent = '';
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    try {
      await nuvem.entrar(email, senha);
      abrirApp();
    } catch (e) {
      erro.textContent = e.message;
      botao.disabled = false;
      botao.textContent = 'Entrar';
    }
  });
}

function abrirApp() {
  casca();
  pronto = true;
  indicadorNuvem();
  desenhar(false);
  oferecerLocal();
}

// ---------- Eventos ----------
async function executar(el, ev) {
  const nome = el.dataset.acao;
  const tela = TELAS[rota().nome];
  if (tela.acoes?.[nome] && $('#visao')?.contains(el)) {
    ev.preventDefault();
    const r = await tela.acoes[nome](el, ev);
    if (r !== false) desenhar(true);
  } else if (ACOES[nome]) {
    ev.preventDefault();
    ACOES[nome](el, ev);
  }
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-acao]');
  if (el) executar(el, ev);
});
document.addEventListener('keydown', (ev) => {
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches?.('[role="button"][data-acao]')) {
    ev.preventDefault();
    ev.target.click();
  }
});
document.addEventListener('change', (ev) => {
  const c = ev.target.closest?.('[data-muda]');
  if (!c || !$('#visao')?.contains(c)) return;
  TELAS[rota().nome].mudou?.(c.dataset.muda, ev.target.value);
  desenhar(true);
});
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el.dataset?.digita || !$('#visao')?.contains(el)) return;
  TELAS[rota().nome].digitou?.(el.dataset.digita, el.value, $('#visao'));
});
addEventListener('hashchange', () => {
  fecharTodas();
  desenhar(false);
});
addEventListener('scroll', () => $('.topo')?.classList.toggle('rolou', scrollY > 40), { passive: true });
let largura = innerWidth;
addEventListener('resize', debounce(() => {
  if (innerWidth === largura) return;
  largura = innerWidth;
  desenhar(true);
}, 180));

store.on(agendar);

let perguntando = false;
async function oferecerLocal() {
  if (!nuvem.estado.ofertaLocal || !pronto || perguntando) return;
  perguntando = true;
  const ok = await confirmar({ titulo: 'Trazer os dados deste aparelho?', mensagem: 'Há lançamentos salvos aqui no modo local. Quer enviá-los para a sua conta na nuvem?', ok: 'Enviar', cancelar: 'Agora não', destrutivo: false });
  perguntando = false;
  if (ok) aviso(`${await nuvem.importarDoLocal()} registros enviados para a sua conta`);
  else nuvem.dispensarOfertaLocal();
}
nuvem.aoMudarNuvem((e) => {
  if (e.status === 'saiu') return telaLogin();
  indicadorNuvem();
  if (pronto && rota().nome === 'ajustes') agendar();
  oferecerLocal();
});

// ---------- Início ----------
aplicarTema();
(async () => {
  let modo = 'local';
  try {
    modo = await nuvem.iniciar();
  } catch (e) {
    console.error(e);
  }
  if (modo === 'entrar') telaLogin();
  else abrirApp();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
