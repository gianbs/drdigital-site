// Banco de dados local (IndexedDB) com tudo em memória para leitura rápida.
// Cada registro é um "doc": { id, col, data, updatedAt, deleted, dirty }.
// "dirty" marca o que ainda precisa subir para a nuvem (ver sync.js).

import { uid } from './util.js';

const PREFIXO = 'drdigital-caixa-';
let idb = null;
let espaco = 'local';
let guardarLapides = false; // true quando a nuvem está ligada: exclusões precisam sincronizar
const docs = new Map();
const meta = {};
const ouvintes = new Set();
const cache = new Map();
let versao = 0;
let emLote = 0;
let mudouNoLote = false;

function abrir(nome) {
  return new Promise((ok, erro) => {
    let req;
    try {
      req = indexedDB.open(nome, 1);
    } catch (e) {
      return erro(e);
    }
    req.onupgradeneeded = () => {
      req.result.createObjectStore('docs', { keyPath: 'id' });
      req.result.createObjectStore('meta');
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

function lerTudo(db, nomeStore, comChaves = false) {
  return new Promise((ok, erro) => {
    const st = db.transaction(nomeStore).objectStore(nomeStore);
    const r = st.getAll();
    r.onerror = () => erro(r.error);
    r.onsuccess = () => {
      if (!comChaves) return ok(r.result);
      const k = st.getAllKeys();
      k.onsuccess = () => ok(k.result.map((key, i) => [key, r.result[i]]));
      k.onerror = () => erro(k.error);
    };
  });
}

function gravar(nomeStore, fn) {
  if (!idb) return;
  try {
    const tx = idb.transaction(nomeStore, 'readwrite');
    fn(tx.objectStore(nomeStore));
    tx.onerror = () => console.warn('Falha ao gravar no aparelho', tx.error);
  } catch (e) {
    console.warn('Falha ao gravar no aparelho', e);
  }
}

function avisar() {
  versao++;
  cache.clear();
  if (emLote) {
    mudouNoLote = true;
    return;
  }
  ouvintes.forEach((fn) => fn());
}

export const store = {
  get versao() {
    return versao;
  },
  get espaco() {
    return espaco;
  },

  /** Abre o banco do usuário (ou "local" quando a nuvem não está ligada). */
  async init(nome = 'local', { lapides = false } = {}) {
    if (idb) idb.close();
    idb = null;
    docs.clear();
    for (const k of Object.keys(meta)) delete meta[k];
    espaco = nome;
    guardarLapides = lapides;
    try {
      idb = await abrir(PREFIXO + nome);
      for (const d of await lerTudo(idb, 'docs')) docs.set(d.id, d);
      for (const [k, v] of await lerTudo(idb, 'meta', true)) meta[k] = v;
    } catch (e) {
      console.warn('IndexedDB indisponível; os dados ficam só na memória desta aba.', e);
    }
    versao++;
    cache.clear();
  },

  on(fn) {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
  },

  /** Agrupa várias alterações em um único aviso de mudança. */
  lote(fn) {
    emLote++;
    try {
      return fn();
    } finally {
      emLote--;
      if (!emLote && mudouNoLote) {
        mudouNoLote = false;
        ouvintes.forEach((f) => f());
      }
    }
  },

  vazio() {
    return docs.size === 0;
  },

  all(col) {
    if (!cache.has(col)) {
      const lista = [];
      for (const d of docs.values()) if (d.col === col && !d.deleted) lista.push({ ...d.data, id: d.id });
      cache.set(col, lista);
    }
    return cache.get(col);
  },

  get(id) {
    const d = docs.get(id);
    return d && !d.deleted ? { ...d.data, id: d.id } : null;
  },

  put(col, obj) {
    const { id = uid(), ...data } = obj;
    const doc = { id, col, data, updatedAt: Date.now(), deleted: false, dirty: true };
    docs.set(id, doc);
    gravar('docs', (s) => s.put(doc));
    avisar();
    return { ...data, id };
  },

  remove(id) {
    const d = docs.get(id);
    if (!d) return;
    if (guardarLapides) {
      const doc = { id, col: d.col, data: {}, updatedAt: Date.now(), deleted: true, dirty: true };
      docs.set(id, doc);
      gravar('docs', (s) => s.put(doc));
    } else {
      docs.delete(id);
      gravar('docs', (s) => s.delete(id));
    }
    avisar();
  },

  // ---------- preferências do aparelho (não sincronizam) ----------
  meta(k) {
    return meta[k];
  },
  setMeta(k, v) {
    meta[k] = v;
    gravar('meta', (s) => s.put(v, k));
  },

  // ---------- usados pela sincronização ----------
  sujos() {
    return [...docs.values()].filter((d) => d.dirty);
  },
  marcarLimpos(enviados) {
    gravar('docs', (s) => {
      for (const e of enviados) {
        const d = docs.get(e.id);
        if (d && d.updatedAt === e.updatedAt) {
          d.dirty = false;
          if (e.remoto) d.remoto = e.remoto;
          s.put(d);
        }
      }
    });
  },
  /** Aplica registros vindos da nuvem. O que foi alterado aqui e ainda não subiu tem prioridade. */
  aplicarRemotos(linhas) {
    let mudou = false;
    gravar('docs', (s) => {
      for (const l of linhas) {
        const local = docs.get(l.id);
        if (local && local.dirty) continue;
        const ts = Date.parse(l.updated_at) || Date.now();
        if (local && local.remoto === l.updated_at) continue;
        const doc = { id: l.id, col: l.col, data: l.data || {}, updatedAt: ts, deleted: !!l.deleted, dirty: false, remoto: l.updated_at };
        docs.set(l.id, doc);
        s.put(doc);
        mudou = true;
      }
    });
    if (mudou) avisar();
    return mudou;
  },

  // ---------- backup ----------
  exportar() {
    const lista = [];
    for (const d of docs.values()) if (!d.deleted) lista.push({ id: d.id, col: d.col, data: d.data });
    return { app: 'drdigital-caixa', versao: 1, exportadoEm: new Date().toISOString(), docs: lista };
  },
  importar(json, { substituir = true } = {}) {
    if (!json || json.app !== 'drdigital-caixa' || !Array.isArray(json.docs)) throw new Error('Arquivo de backup inválido.');
    store.lote(() => {
      if (substituir) {
        const novos = new Set(json.docs.map((d) => d.id));
        for (const d of [...docs.values()]) if (!d.deleted && !novos.has(d.id)) store.remove(d.id);
      }
      for (const d of json.docs) store.put(d.col, { ...d.data, id: d.id });
    });
  },
  apagarTudo() {
    store.lote(() => {
      for (const d of [...docs.values()]) if (!d.deleted) store.remove(d.id);
    });
  },

  /** Copia os dados do modo local para a conta que acabou de entrar. */
  async copiarDoLocal() {
    if (espaco === 'local') return 0;
    let db;
    try {
      db = await abrir(PREFIXO + 'local');
      // Não sobrescreve o que a conta já tem (configuração e contas padrão, por exemplo).
      const lista = (await lerTudo(db, 'docs')).filter((d) => !d.deleted && !docs.has(d.id));
      store.lote(() => lista.forEach((d) => store.put(d.col, { ...d.data, id: d.id })));
      return lista.length;
    } catch (e) {
      return 0;
    } finally {
      if (db) db.close();
    }
  },
  async temDadosLocais() {
    let db;
    try {
      db = await abrir(PREFIXO + 'local');
      const lista = await lerTudo(db, 'docs');
      return lista.some((d) => !d.deleted && d.col !== 'config' && d.col !== 'contas');
    } catch (e) {
      return false;
    } finally {
      if (db) db.close();
    }
  },
};

// ---------- valores iniciais ----------
export const PADRAO = {
  empresa: 'Dr Digital Gráfica',
  metaMensal: 0,
  margemAlvo: 20,
  categoriasReceita: [
    'Impressão digital', 'Impressão offset', 'Banners e lonas', 'Carimbos', 'Cartões de visita',
    'Panfletos', 'Adesivos', 'Blocos e talões', 'Criação de arte', 'Acabamento', 'Outras receitas',
  ],
  categoriasDespesa: [
    'Papel e insumos', 'Tinta e toner', 'Manutenção de máquinas', 'Terceirização', 'Aluguel', 'Energia',
    'Água', 'Internet e telefone', 'Salários', 'Pró-labore', 'Impostos', 'Equipamentos', 'Marketing',
    'Frete e transporte', 'Taxas de cartão', 'Outras despesas',
  ],
  formas: ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Boleto', 'Transferência', 'Fiado / promissória'],
};

export function config() {
  return { ...PADRAO, ...(store.get('config') || {}) };
}
export function salvarConfig(parte) {
  const atual = store.get('config') || {};
  store.put('config', { ...atual, ...parte, id: 'config' });
}

/** Cria as contas e a configuração padrão em um banco vazio. */
export function semear() {
  store.lote(() => {
    if (!store.get('config')) store.put('config', { id: 'config', ...PADRAO });
    if (!store.all('contas').length) {
      store.put('contas', { id: 'conta-caixa', nome: 'Caixa (dinheiro)', saldoInicial: 0, tipo: 'caixa' });
      store.put('contas', { id: 'conta-banco', nome: 'Conta bancária / Pix', saldoInicial: 0, tipo: 'banco' });
    }
  });
}
