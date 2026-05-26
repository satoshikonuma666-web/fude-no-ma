// 原稿エディタ画面（簡素版）

import { el, clear, countChars, toast, svg } from './util.js';
import { getState, update, getCurrentDraft, recordTodayChars, patchSettings } from './store.js';
import { openSearchReplace, openVariantCheck, openDictionary } from './search.js';
import { openModal } from './modal.js';

let saveTimer = null;
let paperEl = null;
let counterEl = null;
let currentDraftId = null;
let modeToggleEl = null;
let sessionStartTotal = 0;     // セッション開始時の総文字数
let savedTodayBaseline = 0;    // 今日分の既存記録（セッション開始時）

export function renderEditor(root) {
  const draft = getCurrentDraft();
  if (!draft) {
    root.appendChild(el('div', { class: 'empty-state' }, '原稿がありません。ホームから新規作成してください。'));
    return;
  }
  currentDraftId = draft.id;
  const settings = getState().settings;
  const isReadOnly = draft.status === 'done';

  // セッション開始時のスナップショット
  sessionStartTotal = countChars(draft.body || '', { includePunctuation: settings.includePunctuationInCount });
  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = (draft.charCountHistory || []).find(h => h.date === today);
  savedTodayBaseline = todayEntry ? todayEntry.count : 0;

  const screen = el('section', { class: 'screen editor-screen' + (isReadOnly ? ' read-only' : '') });

  // ========== ヘッダ ==========
  const backBtn = el('button', {
    class: 'back-btn',
    tabindex: '-1',
    onclick: () => { location.hash = '#screen-home'; },
  }, [arrowLeft(), '戻る']);

  // 左上に文字数（大きめ表示）
  counterEl = el('div', { class: 'counter-large' });

  // 縦/横は記号で
  const modeToggle = el('button', {
    class: 'mode-toggle' + (settings.writingMode === 'vertical' ? ' active' : ''),
    tabindex: '-1',
    onpointerdown: (e) => e.preventDefault(),
    onclick: toggleMode,
    title: settings.writingMode === 'vertical' ? '縦書き（クリックで横へ）' : '横書き（クリックで縦へ）',
  }, settings.writingMode === 'vertical' ? '↕' : '↔');
  modeToggleEl = modeToggle;

  let actions;
  if (isReadOnly) {
    // プレビュー時は『完了』バッジ＋全文コピーのみ
    const doneBadge = el('span', { class: 'editor-done-badge' }, '完了 / プレビュー');
    const copyBtn = el('button', {
      class: 'editor-mini-btn',
      title: '全文コピー',
      type: 'button',
      onpointerdown: (e) => e.preventDefault(),
      onclick: copyWholeBody,
    }, 'コピー');
    actions = el('div', { class: 'editor-actions' }, [doneBadge, copyBtn, modeToggle]);
  } else {
    const copyBtn = el('button', {
      class: 'editor-mini-btn',
      title: '全文コピー',
      type: 'button',
      tabindex: '-1',
      onpointerdown: (e) => e.preventDefault(),
      onclick: copyWholeBody,
    }, 'コピー');
    const replaceBtn = el('button', {
      class: 'editor-mini-btn',
      title: '検索・置換',
      type: 'button',
      tabindex: '-1',
      onpointerdown: (e) => e.preventDefault(),
      onclick: () => openSearchReplace(paperEl, currentDraftId, refresh),
    }, '置換');
    const variantBtn = el('button', {
      class: 'editor-mini-btn',
      title: '表記揺れ',
      type: 'button',
      tabindex: '-1',
      onpointerdown: (e) => e.preventDefault(),
      onclick: () => openVariantCheck(paperEl, currentDraftId, refresh),
    }, '揺れ');
    actions = el('div', { class: 'editor-actions' }, [copyBtn, replaceBtn, variantBtn, modeToggle]);
  }

  const header = el('div', { class: 'editor-header' }, [backBtn, counterEl, el('div', { class: 'editor-spacer' }), actions]);
  screen.appendChild(header);

  // プレビュー時のバナー
  if (isReadOnly) {
    const banner = el('div', { class: 'editor-readonly-banner' }, [
      el('span', {}, 'この原稿は「完了」状態です。閲覧専用モードで表示しています。'),
      el('button', {
        class: 'btn-ghost',
        style: { fontSize: '11px', padding: '4px 10px', minHeight: '28px' },
        onclick: () => {
          openModal({
            title: '編集を再開',
            body: 'ステータスを「推敲中」に戻して編集可能にしますか？',
            actions: [
              { label: '推敲中に戻す', variant: 'primary', onclick: () => {
                  update(s => {
                    const d = s.drafts.find(x => x.id === currentDraftId);
                    if (d) { d.status = 'revising'; d.lastEditedAt = Date.now(); }
                  });
                  toast('編集に戻しました');
                  window.dispatchEvent(new CustomEvent('app:refresh'));
                } },
              { label: 'キャンセル', variant: 'ghost' },
            ],
          });
        },
      }, '編集に戻す'),
    ]);
    screen.appendChild(banner);
  }

  // ========== 原稿入力欄 ==========
  paperEl = el('div', {
    class: 'editor-paper',
    contenteditable: isReadOnly ? 'false' : 'true',
    spellcheck: 'false',
    autocapitalize: 'off',
    autocorrect: 'off',
    // iOS 純正キーボードを抑止して、自作フリックキーボードを常時表示できるようにする
    inputmode: 'none',
    'data-mode': settings.writingMode || 'vertical',
    'data-ruled': String(settings.showRuledLines !== false),
    'data-placeholder': '　ここから書き始めましょう。',
    oninput: isReadOnly ? null : onPaperInput,
    onkeydown: isReadOnly ? null : onPaperKeydown,
  });
  paperEl.style.fontSize = settings.fontSize + 'px';
  paperEl.style.lineHeight = String(settings.lineHeight);
  // 罫線位置を実際の line-height に同期させる CSS 変数
  paperEl.style.setProperty('--paper-lh', String(settings.lineHeight));
  applyFontFamily(paperEl, settings.font);
  paperEl.textContent = draft.body || '';

  const canvas = el('div', { class: 'editor-canvas' }, paperEl);
  screen.appendChild(canvas);

  // 完了状態のときは入力系のUI（簡易入力・カーソル・キーボード）を出さない
  if (!isReadOnly) {
    // ========== 簡易入力ボタン（フリックキーボードの上に常時表示） ==========
    const quickBar = el('div', { class: 'quick-bar' });
    for (const sym of (settings.customQuickButtons || ['「」','『』','ーー','……','　','\n'])) {
      const label = sym === '\n' ? '改行' : sym === '　' ? '空' : sym;
      quickBar.appendChild(el('button', {
        type: 'button',
        tabindex: '-1',
        onpointerdown: (e) => e.preventDefault(),
        onmousedown:   (e) => e.preventDefault(),
        onclick: () => insertSymbol(sym),
      }, label));
    }
    screen.appendChild(quickBar);

    // ========== iPhone 風フリックキーボード（常時表示） ==========
    screen.appendChild(buildIosKeyboard());
  }

  root.appendChild(screen);
  updateCounter();

  paperEl.addEventListener('dblclick', () => {
    const sel = window.getSelection().toString();
    if (sel && sel.length > 0 && sel.length <= 8) {
      openDictionary(sel);
    }
  });
}

function refresh() {
  const draft = getCurrentDraft();
  if (paperEl && draft) {
    paperEl.textContent = draft.body || '';
  }
  updateCounter();
}

async function copyWholeBody() {
  const draft = getCurrentDraft();
  if (!draft) return;
  const text = (paperEl ? paperEl.innerText : draft.body) || '';
  if (!text) { toast('本文がありません'); return; }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // フォールバック: 一時的な textarea でコピー
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const chars = text.replace(/\s/g, '').length;
    toast(`全文をコピーしました（${chars.toLocaleString()}字）`);
  } catch (e) {
    toast('コピーに失敗しました');
    console.warn(e);
  }
}

function cBtn(label, title, onclick) {
  // pointerdown/mousedown で preventDefault → タップ時に paper のフォーカスを奪わない
  return el('button', {
    title,
    type: 'button',
    onpointerdown: (e) => e.preventDefault(),
    onmousedown:   (e) => e.preventDefault(),
    onclick,
  }, label);
}

function arrowLeft() { return svg('M15 18l-6-6 6-6', { size: 18 }); }

function arrowSvg(kind) {
  const paths = {
    left:  'M14 6l-6 6 6 6',
    right: 'M10 6l6 6-6 6',
    up:    'M6 14l6-6 6 6',
    down:  'M6 10l6 6 6-6',
    home:  'M14 6l-6 6 6 6 M5 4v16',
    end:   'M10 6l6 6-6 6 M19 4v16',
  };
  const s = svg(paths[kind], { size: 22, strokeWidth: 2.8 });
  return s;
}

function onPaperInput() {
  scheduleSave();
  updateCounter();
}

function onPaperKeydown(e) {
  if (e.key === 'Enter' && getState().settings.autoIndent) {
    setTimeout(() => insertSymbol('　', true), 0);
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const text = paperEl.innerText || '';
    const settings = getState().settings;
    update(s => {
      const draft = s.drafts.find(d => d.id === currentDraftId);
      if (draft) {
        draft.body = text;
        draft.lastEditedAt = Date.now();
      }
    });
    const cur = countChars(text, { includePunctuation: settings.includePunctuationInCount });
    const todayDelta = Math.max(0, cur - sessionStartTotal);
    recordTodayChars(currentDraftId, savedTodayBaseline + todayDelta);
  }, 3000);
}

function updateCounter() {
  if (!paperEl || !counterEl) return;
  const text = paperEl.innerText || '';
  const incl = getState().settings.includePunctuationInCount;
  const total = countChars(text, { includePunctuation: incl });
  const todayDelta = Math.max(0, total - sessionStartTotal);
  const today = savedTodayBaseline + todayDelta;
  clear(counterEl);
  counterEl.appendChild(el('div', { class: 'ctr-block today' }, [
    el('span', { class: 'ctr-label' }, '今日'),
    el('span', { class: 'ctr-value' }, today.toLocaleString()),
  ]));
  counterEl.appendChild(el('div', { class: 'ctr-block total' }, [
    el('span', { class: 'ctr-label' }, '合計'),
    el('span', { class: 'ctr-value' }, total.toLocaleString()),
  ]));
}

function insertSymbol(sym, silent = false) {
  if (!paperEl) return;
  paperEl.focus();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !paperEl.contains(sel.anchorNode)) {
    const node = document.createTextNode(sym);
    paperEl.append(node);
    const r = document.createRange();
    r.setStartAfter(node);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  } else {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    let cursorOffset = sym.length;
    let textToInsert = sym;
    if (sym === '「」') { textToInsert = '「」'; cursorOffset = 1; }
    if (sym === '『』') { textToInsert = '『』'; cursorOffset = 1; }
    if (sym === '\n') { textToInsert = '\n'; cursorOffset = 1; }
    const node = document.createTextNode(textToInsert);
    range.insertNode(node);
    const newRange = document.createRange();
    newRange.setStart(node, cursorOffset);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
  onPaperInput();
}

function moveCursor(kind) {
  if (!paperEl) return;
  paperEl.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const text = paperEl.innerText || '';
  const pos = getCaretOffsetWithin(paperEl);

  let next = pos;
  if (kind === 'charBackward') next = Math.max(0, pos - 1);
  if (kind === 'charForward')  next = Math.min(text.length, pos + 1);
  if (kind === 'lineStart') {
    const before = text.slice(0, pos);
    const ln = before.lastIndexOf('\n');
    next = ln < 0 ? 0 : ln + 1;
  }
  if (kind === 'lineEnd') {
    const after = text.slice(pos);
    const ln = after.indexOf('\n');
    next = ln < 0 ? text.length : pos + ln;
  }
  if (kind === 'lineBackward' || kind === 'lineForward') {
    const lines = text.split('\n');
    let count = 0;
    let lineIdx = 0;
    let col = 0;
    for (let i = 0; i < lines.length; i++) {
      const len = lines[i].length;
      if (pos <= count + len) { lineIdx = i; col = pos - count; break; }
      count += len + 1;
    }
    const target = kind === 'lineBackward' ? lineIdx - 1 : lineIdx + 1;
    if (target < 0 || target >= lines.length) { next = pos; }
    else {
      const targetCol = Math.min(col, lines[target].length);
      let off = 0;
      for (let i = 0; i < target; i++) off += lines[i].length + 1;
      next = off + targetCol;
    }
  }
  setCaretOffsetWithin(paperEl, next);
}

function getCaretOffsetWithin(root) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return 0;
  const range = sel.getRangeAt(0).cloneRange();
  range.setStart(root, 0);
  return range.toString().length;
}

function setCaretOffsetWithin(root, offset) {
  const range = document.createRange();
  const sel = window.getSelection();
  let remain = offset;
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.nodeValue.length;
      if (remain <= len) {
        range.setStart(node, remain);
        range.collapse(true);
        return true;
      }
      remain -= len;
      return false;
    }
    for (const c of node.childNodes) {
      if (walk(c)) return true;
    }
    return false;
  }
  if (!walk(root)) {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

function toggleMode() {
  const cur = getState().settings.writingMode || 'vertical';
  const next = cur === 'vertical' ? 'horizontal' : 'vertical';
  patchSettings({ writingMode: next });
  paperEl.dataset.mode = next;
  modeToggleEl.classList.toggle('active', next === 'vertical');
  modeToggleEl.textContent = next === 'vertical' ? '↕' : '↔';
  modeToggleEl.title = next === 'vertical' ? '縦書き（クリックで横へ）' : '横書き（クリックで縦へ）';
}

export function applyFontFamily(node, font) {
  const map = {
    'noto-serif': '"Noto Serif JP", "Yu Mincho", "YuMincho", serif',
    'yu-mincho':  '"Yu Mincho", "YuMincho", "Noto Serif JP", serif',
    'mincho':     '"Yu Mincho", "YuMincho", "MS Mincho", serif',
    'gothic':     '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
  };
  node.style.fontFamily = map[font] || map['noto-serif'];
}

// ============================================================
// iPhone 風フリックキーボード
// ============================================================
const FLICK_ROWS_IOS = {
  'あ': { c: 'あ', l: 'い', u: 'う', r: 'え', d: 'お' },
  'か': { c: 'か', l: 'き', u: 'く', r: 'け', d: 'こ' },
  'さ': { c: 'さ', l: 'し', u: 'す', r: 'せ', d: 'そ' },
  'た': { c: 'た', l: 'ち', u: 'つ', r: 'て', d: 'と' },
  'な': { c: 'な', l: 'に', u: 'ぬ', r: 'ね', d: 'の' },
  'は': { c: 'は', l: 'ひ', u: 'ふ', r: 'へ', d: 'ほ' },
  'ま': { c: 'ま', l: 'み', u: 'む', r: 'め', d: 'も' },
  'や': { c: 'や', l: '（', u: 'ゆ', r: '）', d: 'よ' },
  'ら': { c: 'ら', l: 'り', u: 'る', r: 'れ', d: 'ろ' },
  'わ': { c: 'わ', l: 'を', u: 'ん', r: 'ー', d: '〜' },
  '、': { c: '、', l: '。', u: '？', r: '！', d: '…' },
};

function buildIosKeyboard() {
  const kbd = el('div', { class: 'ios-kbd' });

  // フリックポップアップ
  const popup = el('div', { class: 'ios-flick-popup' }, [
    el('div', { class: 'flick-tile up' }, ''),
    el('div', { class: 'flick-tile left' }, ''),
    el('div', { class: 'flick-tile center' }, ''),
    el('div', { class: 'flick-tile right' }, ''),
    el('div', { class: 'flick-tile down' }, ''),
  ]);
  kbd.appendChild(popup);

  const grid = el('div', { class: 'ios-kbd-grid' });

  // Row 1
  grid.appendChild(kbdFn('→', 'cur-right'));
  grid.appendChild(kbdLetter('あ', popup, kbd));
  grid.appendChild(kbdLetter('か', popup, kbd));
  grid.appendChild(kbdLetter('さ', popup, kbd));
  grid.appendChild(kbdFn(deleteIcon(), 'del'));

  // Row 2
  grid.appendChild(kbdFn('↶', 'undo'));
  grid.appendChild(kbdLetter('た', popup, kbd));
  grid.appendChild(kbdLetter('な', popup, kbd));
  grid.appendChild(kbdLetter('は', popup, kbd));
  grid.appendChild(kbdFn('空白', 'space'));

  // Row 3
  grid.appendChild(kbdFn('ABC', 'abc'));
  grid.appendChild(kbdLetter('ま', popup, kbd));
  grid.appendChild(kbdLetter('や', popup, kbd));
  grid.appendChild(kbdLetter('ら', popup, kbd));
  grid.appendChild(kbdFn(returnIcon(), 'return', 'ios-kbd-return'));

  // Row 4 (column 5 is occupied by the spanning return)
  grid.appendChild(kbdFn(smileIcon(), 'emoji'));
  grid.appendChild(kbdLetter('^_^', popup, kbd, { display: '^_^', insertCenter: '(^_^)' }));
  grid.appendChild(kbdLetter('わ', popup, kbd, { display: 'わ_' }));
  grid.appendChild(kbdLetter('、', popup, kbd, { display: '、。?!' }));

  kbd.appendChild(grid);

  // 最下部バー：地球儀／マイク
  const bar = el('div', { class: 'ios-kbd-bottom' }, [
    el('button', {
      class: 'ios-corner',
      onclick: () => toast('言語切替（モック）'),
      title: '言語切替',
    }, globeIcon()),
    el('div', { class: 'ios-kbd-spacer' }),
    el('button', {
      class: 'ios-corner',
      onclick: () => toast('音声入力（モック）'),
      title: '音声入力',
    }, micIcon()),
  ]);
  kbd.appendChild(bar);

  return kbd;
}

function kbdLetter(rowKey, popup, kbd, opts = {}) {
  const display = opts.display || rowKey;
  const btn = el('button', { class: 'ios-kbd-key letter' }, display);
  bindIosFlick(btn, rowKey, popup, kbd, opts);
  return btn;
}

function kbdFn(content, fn, extraClass = '') {
  const btn = el('button', { class: 'ios-kbd-key fn ' + extraClass, type: 'button' });
  if (typeof content === 'string') btn.textContent = content;
  else btn.appendChild(content);
  // フォーカスを奪わない
  btn.addEventListener('pointerdown', (e) => e.preventDefault());
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', () => handleKbdFn(fn));
  return btn;
}

function bindIosFlick(btn, rowKey, popup, kbd, opts = {}) {
  const map = FLICK_ROWS_IOS[rowKey];
  if (!map) {
    btn.addEventListener('click', () => {
      if (opts.insertCenter) insertSymbol(opts.insertCenter);
    });
    return;
  }
  let startX = 0, startY = 0;
  let activeDir = 'c';
  let pointerId = null;

  function setPopup(dir) {
    const tiles = popup.querySelectorAll('.flick-tile');
    tiles[0].textContent = map.u;
    tiles[1].textContent = map.l;
    tiles[2].textContent = map.c;
    tiles[3].textContent = map.r;
    tiles[4].textContent = map.d;
    tiles.forEach(t => t.classList.remove('active'));
    const cls = { c: 'center', l: 'left', u: 'up', r: 'right', d: 'down' }[dir];
    if (cls) popup.querySelector('.' + cls).classList.add('active');
  }

  function showPopup() {
    const padRect = kbd.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const cx = btnRect.left - padRect.left + btnRect.width / 2 - 54;
    const cy = btnRect.top - padRect.top + btnRect.height / 2 - 54;
    popup.style.left = cx + 'px';
    popup.style.top = cy + 'px';
    popup.classList.add('active');
  }

  function calcDir(dx, dy) {
    const TH = 16;
    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return 'c';
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'r' : 'l';
    return dy > 0 ? 'd' : 'u';
  }

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();  // paper のフォーカスを奪わない
    pointerId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    activeDir = 'c';
    setPopup('c');
    showPopup();
    btn.setPointerCapture(e.pointerId);
  });
  btn.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    activeDir = calcDir(dx, dy);
    setPopup(activeDir);
  });
  btn.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointerId) return;
    popup.classList.remove('active');
    const ch = map[activeDir];
    if (ch) insertSymbol(ch);
    pointerId = null;
  });
  btn.addEventListener('pointercancel', () => {
    popup.classList.remove('active');
    pointerId = null;
  });
  btn.addEventListener('lostpointercapture', () => {
    popup.classList.remove('active');
    pointerId = null;
  });
}

function handleKbdFn(fn) {
  switch (fn) {
    case 'del':       deleteOneChar(); break;
    case 'space':     insertSymbol('　'); break;
    case 'return':    insertSymbol('\n'); break;
    case 'cur-right': moveCursor('charForward'); break;
    case 'undo':      toast('元に戻す（モック）'); break;
    case 'abc':       toast('英字入力（モック）'); break;
    case 'emoji':     toast('絵文字（モック）'); break;
  }
}

function deleteOneChar() {
  if (!paperEl) return;
  paperEl.focus();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const text = paperEl.innerText || '';
  const pos = getCaretOffsetWithin(paperEl);
  if (pos === 0) return;
  const next = text.slice(0, pos - 1) + text.slice(pos);
  paperEl.textContent = next;
  setCaretOffsetWithin(paperEl, pos - 1);
  onPaperInput();
}

// SVG アイコン
function deleteIcon() {
  return svg('M21 4H8a2 2 0 0 0-1.4.6L1 12l5.6 7.4A2 2 0 0 0 8 20h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM18 9l-6 6M12 9l6 6', { size: 22, stroke: '#fff' });
}
function returnIcon() {
  return svg('M9 14L4 9l5-5M4 9h11a5 5 0 0 1 5 5v6', { size: 20, stroke: '#fff' });
}
function smileIcon() {
  return svg('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01', { size: 22, stroke: '#fff' });
}
function globeIcon() {
  return svg('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10c-2.5-3-4-6.5-4-10s1.5-7 4-10z', { size: 22, stroke: '#fff' });
}
function micIcon() {
  return svg('M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v4M8 22h8', { size: 20, stroke: '#fff' });
}
