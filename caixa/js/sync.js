// Nuvem (Supabase): login e sincronização entre aparelhos.
// O app funciona primeiro no aparelho (offline) e envia/recebe as mudanças quando há internet.
// Sem configuração em config.js, tudo roda em "modo local".

import { store, semear } from './store.js';
import { debounce } from './util.js';

const cfg = window.CAIXA_CONFIG || {};
export const nuvemLigada = !!(cfg.supabaseUrl && cfg.supabaseKey);

/** A biblioteca do Supabase só é baixada quando a nuvem está configurada. */
function carregarBiblioteca() {
  if (window.supabase) return Promise.resolve();
  return new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = 'vendor/supabase.js';
    s.onload = ok;
    s.onerror = () => erro(new Error('Não foi possível carregar a biblioteca da nuvem.'));
    document.head.appendChild(s);
  });
}
const TABELA = 'caixa_registros';

let sb = null;
let usuario = null;
let donoId = null; // de quem é o caixa (o próprio usuário, ou o patrão quando é funcionário)
let rodando = false;
let denovo = false;
let relogio = null;

/** status: 'local' | 'saiu' | 'ok' | 'sincronizando' | 'offline' | 'erro' */
export const estado = { status: nuvemLigada ? 'saiu' : 'local', email: '', erro: '', ultima: null, ofertaLocal: false, papel: 'dono' };
/** Funcionário: só lança receitas, vendas e clientes. O banco não entrega despesas nem resumos a ele. */
export const ehFuncionario = () => estado.papel === 'funcionario';
const podeGravar = (d) => !d.deleted && (d.col === 'clientes' || d.col === 'vendas' || (d.col === 'lancamentos' && d.data?.tipo === 'receita'));

/** Descobre se quem entrou é funcionário de alguém (tabela caixa_membros). Guarda a resposta para abrir sem internet. */
async function descobrirPapel(user) {
  const chave = `drdigital-caixa-papel-${user.id}`;
  let v = null;
  try {
    const { data, error } = await sb.from('caixa_membros').select('dono_id,papel').eq('user_id', user.id).maybeSingle();
    if (!error) {
      v = data ? { dono: data.dono_id, papel: 'funcionario' } : { dono: user.id, papel: 'dono' };
      localStorage.setItem(chave, JSON.stringify(v));
    }
  } catch (e) { /* sem internet: usa o que estava guardado */ }
  if (!v) {
    try {
      v = JSON.parse(localStorage.getItem(chave));
    } catch (e) { /* nada guardado */ }
  }
  return v && v.dono ? v : { dono: user.id, papel: 'dono' };
}
const ouvintes = new Set();
export const aoMudarNuvem = (fn) => (ouvintes.add(fn), () => ouvintes.delete(fn));
function mudar(p) {
  Object.assign(estado, p);
  ouvintes.forEach((f) => f(estado));
}

function traduzir(e) {
  const m = String(e?.message || e || '');
  if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(m)) return 'E-mail ainda não confirmado. Abra o link enviado para o seu e-mail.';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) return 'Sem conexão com a internet.';
  if (/relation .* does not exist|could not find the table|schema cache/i.test(m)) return 'A tabela do app ainda não foi criada no Supabase (rode o arquivo supabase/schema.sql).';
  if (/rate limit/i.test(m)) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
  return m || 'Erro inesperado.';
}

async function puxar() {
  const desde = store.meta('puxadoAte') || '1970-01-01T00:00:00Z';
  const TAM = 1000;
  let ultimo = desde;
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await sb.from(TABELA).select('id,col,data,deleted,updated_at')
      .gt('updated_at', desde).order('updated_at', { ascending: true }).order('id', { ascending: true })
      .range(pagina * TAM, pagina * TAM + TAM - 1);
    if (error) throw error;
    store.aplicarRemotos(data);
    if (data.length) ultimo = data[data.length - 1].updated_at;
    if (data.length < TAM) break;
  }
  // Volta 10 s para não perder gravações feitas por outro aparelho no mesmo instante.
  const t = Date.parse(ultimo);
  if (ultimo !== desde && isFinite(t)) store.setMeta('puxadoAte', new Date(t - 10000).toISOString());
}

async function empurrar() {
  const sujos = ehFuncionario() ? store.sujos().filter(podeGravar) : store.sujos();
  for (let i = 0; i < sujos.length; i += 200) {
    const parte = sujos.slice(i, i + 200);
    const linhas = parte.map((d) => ({ user_id: donoId, id: d.id, col: d.col, data: d.data, deleted: d.deleted }));
    const { data, error } = await sb.from(TABELA).upsert(linhas, { onConflict: 'user_id,id' }).select('id,updated_at');
    if (error) throw error;
    const carimbo = new Map((data || []).map((r) => [r.id, r.updated_at]));
    store.marcarLimpos(parte.map((d) => ({ id: d.id, updatedAt: d.updatedAt, remoto: carimbo.get(d.id) })));
  }
}

export async function sincronizar() {
  if (!sb || !usuario) return false;
  if (rodando) {
    denovo = true;
    return false;
  }
  rodando = true;
  mudar({ status: 'sincronizando' });
  let ok = false;
  try {
    await empurrar();
    await puxar();
    ok = true;
    mudar({ status: 'ok', ultima: new Date(), erro: '' });
  } catch (e) {
    mudar({ status: navigator.onLine === false ? 'offline' : 'erro', erro: traduzir(e) });
  } finally {
    rodando = false;
    if (denovo) {
      denovo = false;
      sincronizar();
    }
  }
  return ok;
}

const agendar = debounce(() => store.sujos().length && sincronizar(), 1200);
export const pendentes = () => (nuvemLigada ? (ehFuncionario() ? store.sujos().filter(podeGravar) : store.sujos()).length : 0);

async function abrirConta(user) {
  usuario = user;
  const v = await descobrirPapel(user);
  donoId = v.dono;
  await store.init(user.id, { lapides: true });
  mudar({ email: user.email || '', status: 'sincronizando', ofertaLocal: false, papel: v.papel });
  const ok = await sincronizar();
  if (v.papel === 'dono') {
    if (ok && store.vazio()) semear();
    // Se este aparelho foi usado no modo local antes de ligar a nuvem, oferece trazer esses dados (uma vez só).
    if (ok && !jaOfereceu(user.id) && (await store.temDadosLocais())) mudar({ ofertaLocal: true });
  }
  clearInterval(relogio);
  relogio = setInterval(() => document.visibilityState === 'visible' && sincronizar(), 45000);
}

/** Devolve 'local' (sem nuvem), 'entrar' (precisa de login) ou 'pronto'. */
export async function iniciar() {
  if (!nuvemLigada) {
    await store.init('local');
    semear();
    return 'local';
  }
  await carregarBiblioteca();
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'drdigital-caixa-sessao' },
  });
  store.on(agendar);
  addEventListener('online', () => sincronizar());
  addEventListener('offline', () => usuario && mudar({ status: 'offline' }));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && sincronizar());
  sb.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT' && usuario) {
      usuario = null;
      clearInterval(relogio);
      mudar({ status: 'saiu', email: '', papel: 'dono' });
    }
  });
  let sessao = null;
  try {
    sessao = (await sb.auth.getSession()).data.session;
  } catch (e) {
    console.warn(e);
  }
  if (!sessao) return 'entrar';
  await abrirConta(sessao.user);
  return 'pronto';
}

export async function entrar(email, senha) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(traduzir(error));
  await abrirConta(data.user);
}

export async function sair() {
  await sincronizar();
  clearInterval(relogio);
  const u = usuario;
  usuario = null;
  try {
    await sb.auth.signOut();
  } catch (e) {
    console.warn(e);
  }
  if (u) mudar({ status: 'saiu', email: '', papel: 'dono' });
}


const chaveOferta = (id) => `drdigital-caixa-local-visto-${id}`;
function jaOfereceu(id) {
  try {
    return localStorage.getItem(chaveOferta(id)) === '1';
  } catch (e) {
    return false;
  }
}
function marcarOferta() {
  try {
    if (usuario) localStorage.setItem(chaveOferta(usuario.id), '1');
  } catch (e) { /* sem armazenamento: pergunta de novo na próxima vez */ }
  mudar({ ofertaLocal: false });
}

/** Traz para a conta os dados que estavam no modo local deste aparelho. */
export async function importarDoLocal() {
  const n = await store.copiarDoLocal();
  marcarOferta();
  sincronizar();
  return n;
}
export const dispensarOfertaLocal = () => marcarOferta();
