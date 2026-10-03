/* ================================================================
   FreePDF Editor — line-based PDF editing
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
  statLines: document.getElementById('statLines'),
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

const state = { pdfBytes:null, pdfDoc:null, pages:[], fonts:{}, focusedLine:null };

/* ---------- Utilities ---------- */
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

/* ---------- Theme ---------- */
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

/* ---------- Load metric fonts ---------- */
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

/* ---------- Font cleanup ---------- */
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

/* ---------- Group PDF text items into lines ---------- */
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

/* ---------- Alignment detection (line-cluster based) ---------- */
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

/* Cluster lines into paragraph groups (for alignment detection only) */
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

  return clusters.map(c => ({
    lines: c,
    fontSize: c.reduce((s,l) => s + l.fontSize, 0) / c.length,
    alignment: detectAlignment(c, c.reduce((s,l) => s + l.fontSize, 0) / c.length),
  }));
}

/* ================================================================
   LOAD PDF — one editable box per line
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

    const pageState = { pdfWidth: viewport.width, pdfHeight: viewport.height, wrap, lines: [] };
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

    /* Attach alignment from cluster to each line */
    for(const c of clusters){
      for(const line of c.lines){ line.alignment = c.alignment; }
    }

    /* Create editable box per line */
    for(const line of lines){
      const el = document.createElement('div');
      el.className = 'txt';
      el.contentEditable = 'true';
      el.spellcheck = false;
      el.textContent = line.text;

      const lineWidth = line.right - line.left;
      const buffer = Math.max(line.fontSize * 3, 40);
      const boxWidth = lineWidth + buffer;

      const align = line.alignment || 'left';
      let boxLeft;
      if(align === 'right') boxLeft = line.right - boxWidth;
      else if(align === 'center') boxLeft = ((line.left + line.right) / 2) - boxWidth / 2;
      else boxLeft = line.left;

      el.style.left = boxLeft + 'px';
      el.style.top = (line.baseline - line.fontSize * 1.15) + 'px';
      el.style.width = boxWidth + 'px';
      el.style.minHeight = (line.fontSize * 1.35) + 'px';
      el.style.fontSize = line.fontSize + 'px';
      el.style.lineHeight = 1;
      el.style.fontFamily = cssFamilyFor(line.font);
      el.style.fontWeight = line.font.bold ? '700' : '400';
      el.style.fontStyle = line.font.italic ? 'italic' : 'normal';
      el.style.textAlign = align;

      const lstate = {
        el,
        originalText: line.text,
        originalLeft: line.left,
        originalRight: line.right,
        originalBaseline: line.baseline,
        originalWidth: lineWidth,
        fontSize: line.fontSize,
        font: line.font,
        alignment: align,
        changed: false,
        isNew: false,
      };
      pageState.lines.push(lstate);

      const onInput = () => handleLineInput(lstate);
      el.addEventListener('input', onInput);
      el.addEventListener('focus', () => showAlignToolbar(lstate));
      el.addEventListener('blur', () => {
        onInput();
        setTimeout(() => {
          const a = document.activeElement;
          if(a && (a === el || els.alignToolbar.contains(a))) return;
          hideAlignToolbar();
        }, 180);
      });
      el.addEventListener('keydown', e => {
        if(e.key === 'Escape') el.blur();
        if(e.key === 'Enter'){ e.preventDefault(); el.blur(); }
      });

      wrap.appendChild(el);
    }

    wrap.addEventListener('dblclick', e => {
      if(e.target.classList && e.target.classList.contains('txt')) return;
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      createNewLine(pageState, e.clientX - rect.left, e.clientY - rect.top);
    });

    state.pages.push(pageState);
    console.log(`[page ${p}] ${rawItems.length} items → ${lines.length} lines → ${clusters.length} paragraph clusters`);
  }

  els.exportPdf.disabled = false;
  els.exportDocx.disabled = false;
  els.drop.style.display = 'none';
  els.fileChip.classList.remove('hidden');
  els.fileName.textContent = fileName || 'document.pdf';
  els.docInfo.textContent = `${state.pages.length} page${state.pages.length !== 1 ? 's' : ''} loaded`;
  toast('PDF loaded — click any line to edit');
  updateStats();
}

/* ---------- Editing ---------- */
function handleLineInput(lstate){
  const text = lstate.el.textContent;
  lstate.changed = (text !== lstate.originalText);
  lstate.el.classList.toggle('changed', lstate.changed);
  updateStats();
}

function createNewLine(pageState, x, y){
  const defaultFont = { name:'Arial', family:'sans', bold:false, italic:false };
  const fontSize = 12;
  let snapX = x;
  const lefts = pageState.lines.map(l => l.originalLeft);
  if(lefts.length){
    const nearest = lefts.reduce((a,b) => Math.abs(b-x) < Math.abs(a-x) ? b : a, lefts[0]);
    if(Math.abs(nearest - x) < 30) snapX = nearest;
  }
  const el = document.createElement('div');
  el.className = 'txt changed';
  el.contentEditable = 'true';
  el.spellcheck = false;
  el.textContent = '';
  el.style.left = snapX + 'px';
  el.style.top = y + 'px';
  el.style.width = '400px';
  el.style.minHeight = (fontSize * 1.4) + 'px';
  el.style.fontSize = fontSize + 'px';
  el.style.lineHeight = 1;
  el.style.fontFamily = cssFamilyFor(defaultFont);
  el.style.textAlign = 'left';

  const lstate = {
    el, originalText:'',
    originalLeft:snapX, originalRight:snapX + 200,
    originalBaseline: y + fontSize * 0.82,
    originalWidth: 200,
    fontSize, font: defaultFont, alignment: 'left',
    changed: true, isNew: true,
  };
  pageState.lines.push(lstate);

  const onInput = () => handleLineInput(lstate);
  el.addEventListener('input', onInput);
  el.addEventListener('focus', () => showAlignToolbar(lstate));
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
  updateStats();
}

/* ---------- Alignment toolbar ---------- */
function showAlignToolbar(lstate){
  state.focusedLine = lstate;
  const tb = els.alignToolbar;
  tb.style.visibility = 'hidden';
  tb.classList.add('show');
  const rect = lstate.el.getBoundingClientRect();
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
    if(b.dataset.align) b.classList.toggle('active', b.dataset.align === lstate.alignment);
  });
}
function hideAlignToolbar(){
  state.focusedLine = null;
  els.alignToolbar.classList.remove('show');
}
function repositionToolbar(){
  if(state.focusedLine && els.alignToolbar.classList.contains('show')) showAlignToolbar(state.focusedLine);
}
els.viewport.addEventListener('scroll', repositionToolbar, { passive:true });
window.addEventListener('resize', repositionToolbar);
window.addEventListener('scroll', repositionToolbar, { passive:true });

function applyAlignment(lstate, align){
  lstate.alignment = align;
  lstate.el.style.textAlign = align;
  lstate.changed = true;
  lstate.el.classList.add('changed');

  // Reposition the box so the text sits at the correct anchor
  const lineWidth = lstate.originalWidth;
  const buffer = Math.max(lstate.fontSize * 3, 40);
  const boxWidth = lineWidth + buffer;
  let boxLeft;
  if(align === 'right') boxLeft = lstate.originalRight - boxWidth;
  else if(align === 'center') boxLeft = ((lstate.originalLeft + lstate.originalRight) / 2) - boxWidth / 2;
  else boxLeft = lstate.originalLeft;

  lstate.el.style.left = boxLeft + 'px';
  lstate.el.style.width = boxWidth + 'px';

  els.alignToolbar.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b.dataset.align === align));
  if(document.activeElement !== lstate.el) lstate.el.focus();
  updateStats();
}

els.alignToolbar.addEventListener('mousedown', e => e.preventDefault());
els.alignToolbar.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if(!btn || !state.focusedLine) return;
  if(btn.dataset.align){ applyAlignment(state.focusedLine, btn.dataset.align); return; }
  if(btn.dataset.action === 'delete'){
    if(!confirm('Delete this line?')) return;
    const ls = state.focusedLine;
    const pageState = state.pages.find(ps => ps.lines.includes(ls));
    if(!pageState) return;
    ls.el.remove();
    pageState.lines = pageState.lines.filter(l => l !== ls);
    hideAlignToolbar();
    updateStats();
    toast('Line deleted');
  }
});

document.addEventListener('keydown', e => {
  if(!state.focusedLine) return;
  if(!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
  const map = { l:'left', e:'center', r:'right', j:'justify' };
  const k = e.key.toLowerCase();
  if(map[k]){ e.preventDefault(); applyAlignment(state.focusedLine, map[k]); }
});

/* ---------- Stats ---------- */
function updateStats(){
  let words = 0, chars = 0, edited = 0, lines = 0;
  for(const ps of state.pages){
    lines += ps.lines.length;
    for(const l of ps.lines){
      const t = (l.el.textContent || '').trim();
      if(t){ words += t.split(/\s+/).length; chars += t.length; }
      if(l.changed) edited++;
    }
  }
  els.statPages.textContent = state.pages.length;
  els.statLines.textContent = lines;
  els.statWords.textContent = words;
  els.statChars.textContent = chars;
  els.statEdited.textContent = edited;
}

/* ---------- File input + DnD ---------- */
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

/* ---------- PDF text helpers ---------- */
function measurePdf(font, text, size){
  try{ return font.widthOfTextAtSize(text, size); }
  catch(_){ return text.length * size * 0.55; }
}

/* ================================================================
   EXPORT PDF — line-by-line, alignment-preserved
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

    for(const l of ps.lines){
      if(!l.changed && !l.isNew) continue;

      /* White-out original line only */
      if(!l.isNew){
        const vpTop    = l.originalBaseline - l.fontSize * 1.10;
        const vpBottom = l.originalBaseline + l.fontSize * 0.35;
        const pdfY     = ph - vpBottom * sy;
        const rectH    = (vpBottom - vpTop) * sy;
        if(rectH > 0){
          op.drawRectangle({
            x: l.originalLeft * sx - 2,
            y: pdfY,
            width: l.originalWidth * sx + 4,
            height: rectH,
            color: rgb(1,1,1),
          });
        }
      }

      const text = (l.el.textContent || '').replace(/\s+/g, ' ').trim();
      if(!text) continue;

      const font = pickFont(l.font);
      const fontPt = l.fontSize * sy;
      const baselinePdfY = ph - l.originalBaseline * sy;
      const textWidth = measurePdf(font, text, fontPt);
      const align = l.alignment || 'left';

      let x;
      if(align === 'right'){
        x = (l.originalRight * sx) - textWidth;
      } else if(align === 'center'){
        const centerPdf = ((l.originalLeft + l.originalRight) / 2) * sx;
        x = centerPdf - textWidth / 2;
      } else {
        x = l.originalLeft * sx;
      }

      try{
        op.drawText(text, { x, y: baselinePdfX_y(baselinePdfY), size: fontPt, font, color: rgb(0,0,0) });
      }catch(e){
        console.warn('drawText failed:', text, e);
      }
    }
  }
  return await outDoc.save();
}
function baselinePdfX_y(y){ return y; }

/* ---------- Preview modal ---------- */
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

/* ---------- Save as PDF ---------- */
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

/* ---------- Save as DOCX ---------- */
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

      const sorted = [...ps.lines].sort((a, b) => a.originalBaseline - b.originalBaseline);
      let prevBaseline = null;

      for(const l of sorted){
        const text = (l.el.textContent || '').trim();
        if(!text) continue;
        // Approximate paragraph grouping: if baseline jump is large, new paragraph
        const gapBig = prevBaseline !== null && (l.originalBaseline - prevBaseline) > l.fontSize * 1.8;
        if(gapBig){
          children.push(new Paragraph({ children: [ new TextRun({ text: '' }) ], spacing: { after: 60 } }));
        }
        children.push(new Paragraph({
          alignment: alignMap[l.alignment] || AlignmentType.LEFT,
          children: [ new TextRun({
            text,
            font: l.font.name,
            bold: l.font.bold,
            italics: l.font.italic,
            size: Math.max(8, Math.min(72, Math.round(l.fontSize * 2))),
          }) ],
        }));
        prevBaseline = l.originalBaseline;
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

/* ---------- Boot ---------- */
(async () => { state.fonts = await loadMetricFonts(); })();
