/* ================================================================
   FreePDF Editor — Word-like paragraph reflow
   ================================================================ */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const els = {
  file:      document.getElementById('file'),
  drop:      document.getElementById('drop'),
  pages:     document.getElementById('pages'),
  viewport:  document.getElementById('viewport'),
  exportPdf: document.getElementById('exportPdf'),
  exportDocx:document.getElementById('exportDocx'),
  status:    document.getElementById('status'),
  fileChip:  document.getElementById('fileChip'),
  fileName:  document.getElementById('fileName'),
  docInfo:   document.getElementById('docInfo'),
  statPages: document.getElementById('statPages'),
  statParas: document.getElementById('statParas'),
  statWords: document.getElementById('statWords'),
  statChars: document.getElementById('statChars'),
  statEdited:document.getElementById('statEdited'),
  statFonts: document.getElementById('statFonts'),
  modal:        document.getElementById('previewModal'),
  previewFrame: document.getElementById('previewFrame'),
  previewMeta:  document.getElementById('previewMeta'),
  previewClose: document.getElementById('previewClose'),
  previewCancel:document.getElementById('previewCancel'),
  previewDownload: document.getElementById('previewDownload'),
  alignToolbar: document.getElementById('alignToolbar'),
  themeToggle:  document.getElementById('themeToggle'),
};

const state = { pdfBytes:null, pdfDoc:null, pages:[], fonts:{}, focusedPara:null };

function toast(msg, ms = 2500){
  els.status.textContent = msg;
  els.status.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.status.classList.remove('show'), ms);
}
function downloadBlob(blob, filename){
  try{ if(typeof saveAs === 'function'){ saveAs(blob, filename); return; } }catch(_){}
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

document.getElementById('year').textContent = new Date().getFullYear();
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  try{ localStorage.setItem('pdfedit-theme', t); }catch(_){}
}
(function(){
  let saved = null;
  try{ saved = localStorage.getItem('pdfedit-theme'); }catch(_){}
  if(!saved) saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(saved);
})();
els.themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});
document.getElementById('showOutlines').addEventListener('change', e => {
  document.body.classList.toggle('show-outlines', e.target.checked);
});

/* -------- Metric fonts -------- */
async function tryFetchFont(url){
  try{ const r = await fetch(url, { mode:'cors' }); if(!r.ok) return null;
       return await r.arrayBuffer(); }catch(_){ return null; }
}
async function loadMetricFonts(){
  const urls = {
    'sans-regular': 'https://cdn.jsdelivr.net/npm/@fontsource/arimo/files/arimo-latin-400-normal.woff',
    'sans-bold':    'https://cdn.jsdelivr.net/npm/@fontsource/arimo/files/arimo-latin-700-normal.woff',
    'serif-regular':'https://cdn.jsdelivr.net/npm/@fontsource/tinos/files/tinos-latin-400-normal.woff',
    'serif-bold':   'https://cdn.jsdelivr.net/npm/@fontsource/tinos/files/tinos-latin-700-normal.woff',
    'mono-regular': 'https://cdn.jsdelivr.net/npm/@fontsource/cousine/files/cousine-latin-400-normal.woff',
    'mono-bold':    'https://cdn.jsdelivr.net/npm/@fontsource/cousine/files/cousine-latin-700-normal.woff',
  };
  const out = {}; let loaded = 0;
  for(const [k, u] of Object.entries(urls)){
    let buf = await tryFetchFont(u);
    if(!buf) buf = await tryFetchFont(u.replace('.woff', '.ttf'));
    if(buf){ out[k] = buf; loaded++; }
  }
  els.statFonts.textContent = `${loaded}/6`;
  return out;
}

/* -------- Fonts -------- */
function cleanFontName(raw){
  if(!raw) return { name:'Arial', family:'sans', bold:false, italic:false };
  let n = String(raw).replace(/^[A-Z]{6}\+/, '');
  const map = {
    'ArialMT':'Arial','Arial-BoldMT':'Arial','Arial-ItalicMT':'Arial','Arial-BoldItalicMT':'Arial','Arial':'Arial',
    'Helvetica':'Helvetica','Helvetica-Bold':'Helvetica',
    'TimesNewRomanPSMT':'Times New Roman','TimesNewRomanPS-BoldMT':'Times New Roman',
    'TimesNewRomanPS-ItalicMT':'Times New Roman','TimesNewRomanPS-BoldItalicMT':'Times New Roman',
    'Times-Roman':'Times New Roman','Times-Bold':'Times New Roman',
    'CourierNewPSMT':'Courier New','Courier':'Courier New',
    'Calibri':'Calibri','Calibri-Bold':'Calibri',
    'Cambria':'Cambria','Georgia':'Georgia','Verdana':'Verdana',
    'Tahoma':'Tahoma','TrebuchetMS':'Trebuchet MS','Garamond':'Garamond',
  };
  const bold   = /bold|black|heavy|semibold/i.test(n);
  const italic = /italic|oblique|ital/i.test(n);
  if(map[n]) n = map[n];
  else n = n.replace(/[-_,](Bold|Italic|Oblique|Regular|MT|PS|Light|Medium|Semibold|Black|Heavy).*$/i,'')
           .replace(/([a-z])([A-Z])/g,'$1 $2').trim();
  if(!n || n.length > 40) n = 'Arial';
  let family = 'sans';
  if(/times|georgia|garamond|cambria|serif|book/i.test(n)) family = 'serif';
  if(/courier|mono|consol|typewriter/i.test(n)) family = 'mono';
  return { name:n, family, bold, italic };
}
function metricKeyFor(f){
  if(f.family === 'serif') return f.bold ? 'serif-bold' : 'serif-regular';
  if(f.family === 'mono')  return f.bold ? 'mono-bold'  : 'mono-regular';
  return f.bold ? 'sans-bold' : 'sans-regular';
}
function cssFamilyFor(f){
  if(f.family === 'serif') return 'Georgia, "Times New Roman", Times, serif';
  if(f.family === 'mono')  return '"Courier New", Courier, monospace';
  return 'Arial, Helvetica, sans-serif';
}

/* -------- Group text items into lines -------- */
function groupItemsIntoLines(items){
  const lines = [];
  const sorted = [...items].sort((a,b) => a.top - b.top);
  for(const it of sorted){
    const h = Math.max(it.bottom - it.top, 1);
    let best = null, bestScore = 0;
    for(const ln of lines){
      const ov = Math.min(it.bottom, ln.bottom) - Math.max(it.top, ln.top);
      if(ov <= 0) continue;
      const s = ov / Math.min(h, ln.bottom - ln.top);
      if(s > 0.5 && s > bestScore){ bestScore = s; best = ln; }
    }
    if(best){
      best.items.push(it);
      best.top = Math.min(best.top, it.top);
      best.bottom = Math.max(best.bottom, it.bottom);
      best.left = Math.min(best.left, it.left);
      best.right = Math.max(best.right, it.right);
    } else {
      lines.push({ items:[it], top:it.top, bottom:it.bottom, left:it.left, right:it.right });
    }
  }
  for(const ln of lines){
    ln.items.sort((a,b) => a.left - b.left);
    ln.text = joinItemsText(ln.items);
    ln.fontSize = ln.items.reduce((s,it) => s + it.fontSize, 0) / ln.items.length;
    ln.baseline = Math.max(...ln.items.map(it => it.baseline));
    ln.font = ln.items[0].font;
  }
  lines.sort((a,b) => a.top - b.top);
  return lines;
}
function joinItemsText(items){
  let s = '';
  for(let i = 0; i < items.length; i++){
    const it = items[i];
    if(i > 0){
      const prev = items[i-1];
      const gap = it.left - prev.right;
      if(gap > prev.fontSize * 0.18 && !s.endsWith(' ') && !it.str.startsWith(' ')) s += ' ';
    }
    s += it.str;
  }
  return s;
}

/* -------- Cluster lines into paragraphs -------- */
function clusterLines(lines){
  if(!lines.length) return [];
  const gaps = [];
  for(let i = 1; i < lines.length; i++){
    const g = lines[i].baseline - lines[i-1].baseline;
    if(g > 0) gaps.push(g);
  }
  if(!gaps.length) return [{ lines, fontSize: lines[0].fontSize, alignment: 'left' }];
  const minGap = Math.min(...gaps);
  const breakGap = minGap * 1.30;

  const clusters = [];
  let cur = [lines[0]];
  for(let i = 1; i < lines.length; i++){
    const prev = lines[i-1], line = lines[i];
    const gap = line.baseline - prev.baseline;
    const sizeRatio = line.fontSize / Math.max(prev.fontSize, 0.1);
    const leftDiff = Math.abs(line.left - cur[0].left);
    const gapTooBig   = gap > breakGap;
    const sizeChanged = sizeRatio > 1.20 || sizeRatio < 0.83;
    const indentJump  = leftDiff > prev.fontSize * 0.7 && line.left > prev.left;
    const endsSentence = /[.!?:]["')\]]?\s*$/.test(prev.text.trim());
    const startsUpper  = /^[A-Z"'(]/.test(line.text.trim());
    const sentenceBreak = endsSentence && startsUpper && gap > minGap * 1.10 && leftDiff < prev.fontSize * 0.5;

    if(gapTooBig || sizeChanged || indentJump || sentenceBreak){
      clusters.push(cur); cur = [line];
    } else cur.push(line);
  }
  if(cur.length) clusters.push(cur);

  return clusters.map(c => {
    const fontSize = c.reduce((s,l) => s + l.fontSize, 0) / c.length;
    return {
      lines: c,
      fontSize,
      lineHeight: c.length > 1
        ? (c[c.length-1].baseline - c[0].baseline) / (c.length - 1)
        : fontSize * 1.25,
      alignment: detectAlignment(c, fontSize),
    };
  });
}

function detectAlignment(lines, fontSize){
  if(lines.length <= 1) return 'left';
  const tol = Math.max(fontSize * 0.6, 3);
  const lefts  = lines.map(l => l.left);
  const rights = lines.map(l => l.right);
  const centers = lines.map(l => (l.left + l.right) / 2);
  const leftsMatch   = lefts.every(l  => Math.abs(l - lefts[0])   < tol);
  const rightsMatch  = rights.every(r => Math.abs(r - rights[0])  < tol);
  const centersMatch = centers.every(c => Math.abs(c - centers[0]) < tol);
  if(leftsMatch && centersMatch) return 'left';
  if(centersMatch && !leftsMatch && !rightsMatch) return 'center';
  if(rightsMatch && !leftsMatch) return 'right';
  if(lines.length > 2){
    const body = lines.slice(0, -1);
    const bl = body.every(l => Math.abs(l.left  - body[0].left)  < tol);
    const br = body.every(l => Math.abs(l.right - body[0].right) < tol);
    if(bl && br) return 'justify';
  }
  return 'left';
}

/* ================================================================
   LOAD PDF — build ONE editable box per paragraph
   ================================================================ */
async function loadPdf(arrayBuffer, fileName){
  state.pdfBytes = new Uint8Array(arrayBuffer);
  state.pdfDoc = await pdfjsLib.getDocument({ data: state.pdfBytes.slice() }).promise;

  els.pages.innerHTML = '';
  state.pages = [];

  for(let p = 1; p <= state.pdfDoc.numPages; p++){
    const page = await state.pdfDoc.getPage(p);
    try{ await page.getOperatorList(); }catch(_){}

    const viewport = page.getViewport({ scale: 1 });
    const rvp = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = rvp.width; canvas.height = rvp.height;
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: rvp }).promise;

    const wrap = document.createElement('div');
    wrap.className = 'page';
    wrap.style.width = viewport.width + 'px';
    wrap.style.height = viewport.height + 'px';
    wrap.appendChild(canvas);
    els.pages.appendChild(wrap);

    const pageState = { pdfWidth: viewport.width, pdfHeight: viewport.height, wrap, paras: [] };
    wrap._pageState = pageState;

    const tc = await page.getTextContent();
    const styles = tc.styles || {};
    const rawItems = [];
    for(const it of tc.items){
      if(!it.str || !it.str.trim()) continue;
      let rawFont = '';
      try{
        const fo = page.commonObjs.get(it.fontName);
        if(fo && (fo.name || fo.loadedName)) rawFont = fo.name || fo.loadedName;
      }catch(_){}
      if(!rawFont && styles[it.fontName]) rawFont = styles[it.fontName].fontFamily || '';
      const font = cleanFontName(rawFont);
      const tx = pdfjsLib.Util.transform(viewport.transform, it.transform);
      const fontSize = Math.hypot(tx[2], tx[3]);
      if(fontSize < 2) continue;
      const left = tx[4];
      const right = tx[4] + (it.width || 0) * viewport.scale;
      const baseline = tx[5];
      rawItems.push({
        str: it.str, left, right, baseline,
        top: baseline - fontSize, bottom: baseline + fontSize * 0.25,
        fontSize, font,
      });
    }

    const lines = groupItemsIntoLines(rawItems);
    const clusters = clusterLines(lines);

    for(const cluster of clusters){
      const cLines = cluster.lines;
      const left = Math.min(...cLines.map(l => l.left));
      const right = Math.max(...cLines.map(l => l.right));
      const top = Math.min(...cLines.map(l => l.top));
      const baseline1 = cLines[0].baseline;
      const fontSize = cluster.fontSize;
      const lineHeight = cluster.lineHeight;
      const alignment = cluster.alignment;
      const font = cLines[0].font;
      const width = right - left;

      // Full paragraph text (join lines with a space)
      let text = '';
      for(let i = 0; i < cLines.length; i++){
        const t = cLines[i].text;
        if(!text){ text = t; continue; }
        if(text.endsWith('-')) text = text.slice(0, -1) + t.replace(/^\s+/, '');
        else text += ' ' + t.replace(/^\s+/, '');
      }

      const el = document.createElement('div');
      el.className = 'para';
      el.contentEditable = 'true';
      el.spellcheck = false;
      el.textContent = text;

      // For alignment, the box must extend to the full paragraph width
      const boxWidth = width + fontSize * 0.5;
      let boxLeft = left;
      if(alignment === 'right')       boxLeft = right - boxWidth;
      else if(alignment === 'center') boxLeft = ((left + right) / 2) - boxWidth / 2;

      el.style.left = boxLeft + 'px';
      el.style.top = (baseline1 - fontSize * 1.15) + 'px';
      el.style.width = boxWidth + 'px';
      el.style.fontSize = fontSize + 'px';
      el.style.lineHeight = lineHeight + 'px';
      el.style.fontFamily = cssFamilyFor(font);
      el.style.fontWeight = font.bold ? '700' : '400';
      el.style.fontStyle = font.italic ? 'italic' : 'normal';
      el.style.textAlign = alignment;

      const pstate = {
        el,
        originalText: text,
        originalTop: baseline1 - fontSize * 1.15,
        originalHeight: 0,   // measured after appending
        currentHeight: 0,
        left: boxLeft,
        width: boxWidth,
        baseline1,
        fontSize,
        lineHeight,
        font,
        alignment,
        originalLines: cLines.map(l => ({
          x: l.left, baseline: l.baseline,
          width: l.right - l.left, fontSize: l.fontSize,
        })),
        changed: false,
        isNew: false,
      };
      pageState.paras.push(pstate);

      const onInput = () => handleParaInput(pageState, pstate);
      el.addEventListener('input', onInput);
      el.addEventListener('focus', () => showAlignToolbar(pstate));
      el.addEventListener('blur', () => {
        onInput();
        setTimeout(() => {
          const a = document.activeElement;
          if(a && (a === el || els.alignToolbar.contains(a))) return;
          hideAlignToolbar();
        }, 180);
      });
      el.addEventListener('keydown', e => { if(e.key === 'Escape') el.blur(); });

      wrap.appendChild(el);
    }

    // Measure natural heights AFTER all paragraphs exist
    for(const pstate of pageState.paras){
      pstate.originalHeight = pstate.el.offsetHeight;
      pstate.currentHeight = pstate.el.offsetHeight;
    }

    // Double-click empty space → new paragraph
    wrap.addEventListener('dblclick', e => {
      if(e.target.classList && e.target.classList.contains('para')) return;
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      createNewParagraph(pageState, e.clientX - rect.left, e.clientY - rect.top);
    });

    state.pages.push(pageState);
    console.log(`[page ${p}] ${rawItems.length} items → ${lines.length} lines → ${clusters.length} paragraphs`);
  }

  els.exportPdf.disabled = false;
  els.exportDocx.disabled = false;
  els.drop.style.display = 'none';
  els.fileChip.classList.remove('hidden');
  els.fileName.textContent = fileName || 'document.pdf';
  els.docInfo.textContent = `${state.pages.length} page${state.pages.length !== 1 ? 's' : ''} loaded`;
  toast('PDF loaded — click any paragraph to edit');
  updateStats();
}

/* ================================================================
   EDITING + REFLOW
   ================================================================ */
function handleParaInput(pageState, pstate){
  const text = pstate.el.textContent;
  const changed = (text !== pstate.originalText);
  pstate.changed = changed;
  pstate.el.classList.toggle('changed', changed);

  const newH = pstate.el.offsetHeight;
  if(Math.abs(newH - pstate.currentHeight) > 0.5){
    pstate.currentHeight = newH;
    relayoutPage(pageState);
  }
  updateStats();
}

/* The magic: shift all following paragraphs up/down based on height deltas */
function relayoutPage(pageState){
  const sorted = [...pageState.paras].sort((a,b) => a.originalTop - b.originalTop);
  let shift = 0;
  for(const para of sorted){
    para.el.style.top = (para.originalTop + shift) + 'px';
    const currentH = Math.max(para.el.offsetHeight, para.lineHeight);
    para.currentHeight = currentH;
    shift += currentH - para.originalHeight;
  }
}

function createNewParagraph(pageState, x, y){
  const defaultFont = { name:'Arial', family:'sans', bold:false, italic:false };
  const fontSize = 12, lineHeight = fontSize * 1.3;

  let snapX = x;
  const lefts = pageState.paras.map(p => p.left);
  if(lefts.length){
    const nearest = lefts.reduce((a,b) => Math.abs(b-x) < Math.abs(a-x) ? b : a, lefts[0]);
    if(Math.abs(nearest - x) < 30) snapX = nearest;
  }

  const el = document.createElement('div');
  el.className = 'para changed';
  el.contentEditable = 'true';
  el.spellcheck = false;
  el.textContent = '';
  el.style.left = snapX + 'px';
  el.style.top = y + 'px';
  el.style.width = '60%';
  el.style.minHeight = lineHeight + 'px';
  el.style.fontSize = fontSize + 'px';
  el.style.lineHeight = lineHeight + 'px';
  el.style.fontFamily = cssFamilyFor(defaultFont);
  el.style.textAlign = 'left';

  const pstate = {
    el,
    originalText: '',
    originalTop: y,
    originalHeight: lineHeight,
    currentHeight: lineHeight,
    left: snapX,
    width: 0,
    baseline1: y + fontSize * 0.82,
    fontSize,
    lineHeight,
    font: defaultFont,
    alignment: 'left',
    originalLines: [],
    changed: true,
    isNew: true,
  };
  pageState.paras.push(pstate);

  const onInput = () => handleParaInput(pageState, pstate);
  el.addEventListener('input', onInput);
  el.addEventListener('focus', () => showAlignToolbar(pstate));
  el.addEventListener('blur', () => {
    onInput();
    setTimeout(() => {
      const a = document.activeElement;
      if(a && (a === el || els.alignToolbar.contains(a))) return;
      hideAlignToolbar();
    }, 180);
  });
  el.addEventListener('keydown', e => { if(e.key === 'Escape') el.blur(); });

  pageState.wrap.appendChild(el);
  el.focus();
  relayoutPage(pageState);
  updateStats();
}

/* ================================================================
   ALIGNMENT TOOLBAR
   ================================================================ */
function showAlignToolbar(pstate){
  state.focusedPara = pstate;
  const tb = els.alignToolbar;
  tb.style.visibility = 'hidden';
  tb.classList.add('show');
  const rect = pstate.el.getBoundingClientRect();
  const tbRect = tb.getBoundingClientRect();
  const sx = window.scrollX || window.pageXOffset;
  const sy = window.scrollY || window.pageYOffset;
  let left = Math.min(rect.left + sx, window.innerWidth + sx - tbRect.width - 12);
  left = Math.max(left, sx + 12);
  let top = rect.top + sy - tbRect.height - 8;
  if(rect.top < tbRect.height + 20) top = rect.bottom + sy + 8;
  tb.style.left = left + 'px';
  tb.style.top = top + 'px';
  tb.style.visibility = '';
  tb.querySelectorAll('button').forEach(b => {
    if(b.dataset.align) b.classList.toggle('active', b.dataset.align === pstate.alignment);
  });
}
function hideAlignToolbar(){
  state.focusedPara = null;
  els.alignToolbar.classList.remove('show');
}
function repositionToolbar(){
  if(state.focusedPara && els.alignToolbar.classList.contains('show')) showAlignToolbar(state.focusedPara);
}
els.viewport.addEventListener('scroll', repositionToolbar, { passive:true });
window.addEventListener('resize', repositionToolbar);
window.addEventListener('scroll', repositionToolbar, { passive:true });

function applyAlignment(pstate, align){
  pstate.alignment = align;
  pstate.el.style.textAlign = align;
  pstate.changed = true;
  pstate.el.classList.add('changed');

  // Reposition box so anchor matches the alignment
  const px = pstate.el.getBoundingClientRect();
  const width = pstate.el.offsetWidth;
  const pageWrap = pstate.el.parentElement;
  const pageRect = pageWrap.getBoundingClientRect();
  const currentLeft = parseFloat(pstate.el.style.left);
  const currentRight = currentLeft + width;
  let boxLeft = currentLeft;
  if(align === 'right')       boxLeft = currentRight - width;   // unchanged (box ends at same right)
  else if(align === 'center') boxLeft = ((currentLeft + currentRight) / 2) - width / 2;
  else                         boxLeft = currentLeft;            // for left, keep as-is
  pstate.el.style.left = boxLeft + 'px';

  els.alignToolbar.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b.dataset.align === align));
  if(document.activeElement !== pstate.el) pstate.el.focus();
  updateStats();
}

els.alignToolbar.addEventListener('mousedown', e => e.preventDefault());
els.alignToolbar.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if(!btn || !state.focusedPara) return;
  if(btn.dataset.align){ applyAlignment(state.focusedPara, btn.dataset.align); return; }
  if(btn.dataset.action === 'delete'){
    if(!confirm('Delete this paragraph?')) return;
    const ps = state.focusedPara;
    const pageState = state.pages.find(p => p.paras.includes(ps));
    if(!pageState) return;
    ps.el.remove();
    pageState.paras = pageState.paras.filter(p => p !== ps);
    relayoutPage(pageState);
    hideAlignToolbar();
    updateStats();
    toast('Paragraph deleted');
  }
});

document.addEventListener('keydown', e => {
  if(!state.focusedPara) return;
  if(!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
  const map = { l:'left', e:'center', r:'right', j:'justify' };
  const k = e.key.toLowerCase();
  if(map[k]){ e.preventDefault(); applyAlignment(state.focusedPara, map[k]); }
});

/* ================================================================
   STATS
   ================================================================ */
function updateStats(){
  let words = 0, chars = 0, edited = 0, paras = 0;
  for(const ps of state.pages){
    paras += ps.paras.length;
    for(const p of ps.paras){
      const t = (p.el.textContent || '').trim();
      if(t){ words += t.split(/\s+/).length; chars += t.length; }
      if(p.changed) edited++;
    }
  }
  els.statPages.textContent = state.pages.length;
  els.statParas.textContent = paras;
  els.statWords.textContent = words;
  els.statChars.textContent = chars;
  els.statEdited.textContent = edited;
}

/* ================================================================
   FILE INPUT + DnD
   ================================================================ */
els.file.addEventListener('change', async e => {
  const f = e.target.files[0];
  if(!f) return;
  try{ await loadPdf(await f.arrayBuffer(), f.name); }
  catch(err){ console.error(err); toast('Could not read PDF: ' + err.message); }
});
['dragover','dragenter'].forEach(ev => els.drop.addEventListener(ev, e => { e.preventDefault(); els.drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => els.drop.addEventListener(ev, e => { e.preventDefault(); els.drop.classList.remove('over'); }));
els.drop.addEventListener('drop', async e => {
  const f = e.dataTransfer.files[0];
  if(f && f.type === 'application/pdf'){
    try{ await loadPdf(await f.arrayBuffer(), f.name); }
    catch(err){ console.error(err); toast('Could not read PDF: ' + err.message); }
  } else toast('Please drop a PDF file');
});

/* ================================================================
   PDF TEXT HELPERS
   ================================================================ */
function wrapTextForPdf(text, font, fontSize, maxWidth){
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for(const w of words){
    const test = cur ? cur + ' ' + w : w;
    let width;
    try{ width = font.widthOfTextAtSize(test, fontSize); }
    catch(_){ width = test.length * fontSize * 0.55; }
    if(width > maxWidth && cur){ lines.push(cur); cur = w; }
    else cur = test;
  }
  if(cur) lines.push(cur);
  return lines;
}
function measurePdf(font, text, size){
  try{ return font.widthOfTextAtSize(text, size); }
  catch(_){ return text.length * size * 0.55; }
}
function drawJustifiedLine(op, font, text, size, xStart, targetWidth, y, rgb){
  const words = text.split(/\s+/).filter(Boolean);
  if(words.length < 2){
    op.drawText(text, { x:xStart, y, size, font, color: rgb(0,0,0) });
    return;
  }
  let wWidth = 0;
  for(const w of words) wWidth += measurePdf(font, w, size);
  const gapPer = (targetWidth - wWidth) / (words.length - 1);
  let x = xStart;
  for(let i = 0; i < words.length; i++){
    op.drawText(words[i], { x, y, size, font, color: rgb(0,0,0) });
    x += measurePdf(font, words[i], size);
    if(i < words.length - 1) x += gapPer;
  }
}

/* ================================================================
   BUILD PDF — reflow-aware, alignment-preserved
   ================================================================ */
async function buildPdfBytes(){
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const outDoc = await PDFDocument.load(state.pdfBytes);
  outDoc.registerFontkit(window.fontkit);

  const fallback = {
    'sans-regular':  await outDoc.embedFont(StandardFonts.Helvetica),
    'sans-bold':     await outDoc.embedFont(StandardFonts.HelveticaBold),
    'serif-regular': await outDoc.embedFont(StandardFonts.TimesRoman),
    'serif-bold':    await outDoc.embedFont(StandardFonts.TimesRomanBold),
    'mono-regular':  await outDoc.embedFont(StandardFonts.Courier),
    'mono-bold':     await outDoc.embedFont(StandardFonts.CourierBold),
  };
  const embedded = {};
  for(const [k, bytes] of Object.entries(state.fonts)){
    try{ embedded[k] = await outDoc.embedFont(bytes, { subset:true }); }
    catch(e){ console.warn('embed failed:', k, e); }
  }
  const pickFont = f => embedded[metricKeyFor(f)] || fallback[metricKeyFor(f)];

  const outPages = outDoc.getPages();

  for(let i = 0; i < state.pages.length; i++){
    const ps = state.pages[i];
    const op = outPages[i];
    const { width: pw, height: ph } = op.getSize();
    const sx = pw / ps.pdfWidth;
    const sy = ph / ps.pdfHeight;

    for(const para of ps.paras){
      if(!para.changed && !para.isNew) continue;

      /* White-out original lines */
      if(!para.isNew){
        for(const ln of para.originalLines){
          const vpTop    = ln.baseline - ln.fontSize * 1.10;
          const vpBottom = ln.baseline + ln.fontSize * 0.35;
          const pdfY     = ph - vpBottom * sy;
          const rectH    = (vpBottom - vpTop) * sy;
          if(rectH <= 0) continue;
          op.drawRectangle({
            x: ln.x * sx - 2, y: pdfY,
            width: ln.width * sx + 4, height: rectH,
            color: rgb(1,1,1),
          });
        }
      }

      const text = (para.el.textContent || '').replace(/\s+/g, ' ').trim();
      if(!text) continue;

      /* Compute current top position (post-reflow) */
      const elTopVp = parseFloat(para.el.style.top);
      const shiftY = elTopVp - para.originalTop;

      /* First baseline: use original first line's baseline + reflow shift */
      let firstBaselineVp;
      if(para.originalLines && para.originalLines.length > 0){
        firstBaselineVp = para.originalLines[0].baseline + shiftY;
      } else {
        const halfLead = (para.lineHeight - para.fontSize) / 2;
        firstBaselineVp = elTopVp + halfLead + para.fontSize * 0.82;
      }
      const firstBaselinePdf = ph - firstBaselineVp * sy;

      /* Line spacing: from original, or from CSS line-height */
      let lineHeightPt;
      if(para.originalLines && para.originalLines.length > 1){
        let total = 0;
        for(let k = 1; k < para.originalLines.length; k++){
          total += para.originalLines[k].baseline - para.originalLines[k-1].baseline;
        }
        lineHeightPt = (total / (para.originalLines.length - 1)) * sy;
      } else {
        lineHeightPt = para.lineHeight * sy;
      }

      const font = pickFont(para.font);
      const fontPt = para.fontSize * sy;
      const align = para.alignment || 'left';

      /* Box left + width in PDF points */
      const boxLeftPt = parseFloat(para.el.style.left) * sx;
      const boxWidthPt = para.el.offsetWidth * sx;

      const wrapped = wrapTextForPdf(text, font, fontPt, boxWidthPt);

      for(let j = 0; j < wrapped.length; j++){
        const lineText = wrapped[j];
        const lineWidth = measurePdf(font, lineText, fontPt);
        const isLast = (j === wrapped.length - 1);

        let x = boxLeftPt;
        if(align === 'right')       x = boxLeftPt + boxWidthPt - lineWidth;
        else if(align === 'center') x = boxLeftPt + (boxWidthPt - lineWidth) / 2;

        const y = firstBaselinePdf - j * lineHeightPt;

        try{
          if(align === 'justify' && !isLast && wrapped.length > 1){
            drawJustifiedLine(op, font, lineText, fontPt, boxLeftPt, boxWidthPt, y, rgb);
          } else {
            op.drawText(lineText, { x, y, size: fontPt, font, color: rgb(0,0,0) });
          }
        }catch(e){
          console.warn('drawText failed:', lineText, e);
        }
      }
    }
  }
  return await outDoc.save();
}

/* ================================================================
   PREVIEW MODAL
   ================================================================ */
let currentPreviewBlob = null;
function showPreview(blob){
  if(currentPreviewBlob && currentPreviewBlob.__url) URL.revokeObjectURL(currentPreviewBlob.__url);
  currentPreviewBlob = blob;
  const url = URL.createObjectURL(blob);
  blob.__url = url;
  els.previewFrame.src = url;
  els.previewMeta.textContent = `${state.pages.length} page${state.pages.length !== 1 ? 's' : ''} · ${(blob.size/1024).toFixed(1)} KB`;
  els.modal.classList.add('show');
}
function hidePreview(){ els.modal.classList.remove('show'); }
els.previewClose.addEventListener('click', hidePreview);
els.previewCancel.addEventListener('click', hidePreview);
els.modal.addEventListener('click', e => { if(e.target === els.modal) hidePreview(); });
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && els.modal.classList.contains('show')) hidePreview();
});
els.previewDownload.addEventListener('click', () => {
  if(!currentPreviewBlob) return;
  downloadBlob(currentPreviewBlob, 'edited.pdf');
  hidePreview();
  toast('Downloaded ✔');
});

/* ================================================================
   SAVE AS PDF
   ================================================================ */
els.exportPdf.addEventListener('click', async () => {
  if(!state.pdfDoc) return;
  els.exportPdf.disabled = true;
  toast('Building PDF…');
  try{
    const bytes = await buildPdfBytes();
    showPreview(new Blob([bytes], { type:'application/pdf' }));
    toast('Preview ready');
  }catch(err){
    console.error(err);
    toast('PDF export failed: ' + err.message, 4000);
  }finally{
    els.exportPdf.disabled = false;
  }
});

/* ================================================================
   SAVE AS DOCX
   ================================================================ */
els.exportDocx.addEventListener('click', async () => {
  if(!state.pdfDoc) return;
  if(typeof docx === 'undefined'){ toast('DOCX library failed to load.', 4000); return; }
  els.exportDocx.disabled = true;
  toast('Building DOCX…');
  try{
    const { Document, Packer, Paragraph, TextRun, AlignmentType } = docx;
    const children = [];
    const alignMap = { left: AlignmentType.LEFT, right: AlignmentType.RIGHT, center: AlignmentType.CENTER, justify: AlignmentType.JUSTIFIED };

    for(let p = 0; p < state.pages.length; p++){
      const ps = state.pages[p];
      children.push(new Paragraph({
        children: [ new TextRun({ text: `— Page ${p+1} —`, bold: true, size: 22, color: '808080' }) ],
        spacing: { after: 200 },
      }));

      const sorted = [...ps.paras].sort((a,b) => parseFloat(a.el.style.top) - parseFloat(b.el.style.top));
      for(const para of sorted){
        const text = (para.el.textContent || '').trim();
        if(!text) continue;
        children.push(new Paragraph({
          alignment: alignMap[para.alignment] || AlignmentType.LEFT,
          children: [ new TextRun({
            text,
            font: para.font.name,
            bold: para.font.bold,
            italics: para.font.italic,
            size: Math.max(8, Math.min(72, Math.round(para.fontSize * 2))),
          }) ],
          spacing: { after: 120 },
        }));
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, 'edited.docx');
    toast('Saved as DOCX ✔');
  }catch(err){
    console.error(err);
    toast('DOCX export failed: ' + (err?.message || err), 5000);
  }finally{
    els.exportDocx.disabled = false;
  }
});

/* ================================================================
   BOOT
   ================================================================ */
(async () => { state.fonts = await loadMetricFonts(); })();
