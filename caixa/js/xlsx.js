// Gerador de planilha .xlsx sem bibliotecas: monta os XMLs e empacota em um ZIP (sem compressão).

const enc = new TextEncoder();
const xml = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

// ---------- ZIP ----------
const TAB = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = TAB[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(arquivos) {
  const partes = [];
  const central = [];
  let pos = 0;
  for (const [nome, texto] of arquivos) {
    const n = enc.encode(nome);
    const d = enc.encode(texto);
    const crc = crc32(d);
    const cab = new DataView(new ArrayBuffer(30));
    cab.setUint32(0, 0x04034b50, true);
    cab.setUint16(4, 20, true);
    cab.setUint16(6, 0x0800, true); // nomes em UTF-8
    cab.setUint16(8, 0, true); // sem compressão
    cab.setUint16(10, 0, true);
    cab.setUint16(12, 0x21, true); // 01/01/1980
    cab.setUint32(14, crc, true);
    cab.setUint32(18, d.length, true);
    cab.setUint32(22, d.length, true);
    cab.setUint16(26, n.length, true);
    cab.setUint16(28, 0, true);
    partes.push(new Uint8Array(cab.buffer), n, d);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, 0, true);
    cen.setUint16(14, 0x21, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, d.length, true);
    cen.setUint32(24, d.length, true);
    cen.setUint16(28, n.length, true);
    cen.setUint32(42, pos, true);
    central.push(new Uint8Array(cen.buffer), n);
    pos += 30 + n.length + d.length;
  }
  const tamCentral = central.reduce((t, p) => t + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, pos, true);
  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ---------- Planilha ----------
const ESTILO = { texto: 0, cab: 1, moeda: 2, data: 3, pct: 4, numero: 5, moedaForte: 6, textoForte: 7 };

function letra(i) {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}
const serial = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
};

function celula(ref, valor, tipo, forte) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (tipo === 'data' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return `<c r="${ref}" s="${ESTILO.data}"><v>${serial(valor)}</v></c>`;
  if (typeof valor === 'number' && isFinite(valor)) {
    const s = tipo === 'moeda' ? (forte ? ESTILO.moedaForte : ESTILO.moeda) : tipo === 'pct' ? ESTILO.pct : ESTILO.numero;
    return `<c r="${ref}" s="${s}"><v>${valor}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr" s="${forte ? ESTILO.textoForte : ESTILO.texto}"><is><t xml:space="preserve">${xml(valor)}</t></is></c>`;
}

function folha({ colunas, linhas, total }) {
  const ult = letra(colunas.length - 1);
  let s = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`;
  s += `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
  s += `<cols>${colunas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura || 16}" customWidth="1"/>`).join('')}</cols><sheetData>`;
  s += `<row r="1">${colunas.map((c, i) => `<c r="${letra(i)}1" t="inlineStr" s="${ESTILO.cab}"><is><t>${xml(c.titulo)}</t></is></c>`).join('')}</row>`;
  linhas.forEach((l, r) => {
    s += `<row r="${r + 2}">${l.map((v, i) => celula(letra(i) + (r + 2), v, colunas[i]?.tipo)).join('')}</row>`;
  });
  if (total) {
    const r = linhas.length + 2;
    s += `<row r="${r}">${total.map((v, i) => celula(letra(i) + r, v, colunas[i]?.tipo, true)).join('')}</row>`;
  }
  s += `</sheetData>`;
  if (linhas.length) s += `<autoFilter ref="A1:${ult}${linhas.length + 1}"/>`;
  return s + `</worksheet>`;
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00;[Red]-&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B1B4B"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="164" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/**
 * planilhas: [{ nome, colunas: [{ titulo, largura, tipo: 'texto'|'moeda'|'data'|'numero'|'pct' }], linhas: [[...]], total: [...] }]
 */
export function criarXlsx(planilhas) {
  const nomes = planilhas.map((p) => p.nome.replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31));
  const arquivos = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${planilhas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${planilhas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${planilhas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', ESTILOS],
    ...planilhas.map((p, i) => [`xl/worksheets/sheet${i + 1}.xml`, folha(p)]),
  ];
  return zip(arquivos);
}
