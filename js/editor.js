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
let toolbarCleanup = null;     // visualViewport 監視解除用

export function renderEditor(root) {
  // 直前のエディタ描画で張ったリスナーを掃除
  if (toolbarCleanup) { toolbarCleanup(); toolbarCleanup = null; }

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
  // フォーカス時に iPhone 標準の日本語キーボード（フリック入力／予測変換）が出る前提。
  // inputmode は指定しない。
  paperEl = el('div', {
    class: 'editor-paper',
    contenteditable: isReadOnly ? 'false' : 'true',
    spellcheck: 'false',
    autocapitalize: 'off',
    autocorrect: 'off',
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
    // ========== 入力ツールバー ==========
    // ・キーボードの直上に固定表示する 2 段ツールバー
    // ・上段＝簡易入力（「」『』 等）／下段＝undo・redo・カーソル移動・文頭文末・全角スペース
    // ・iPhone のキーボードが出現したら visualViewport の高さ変化に追従して上にせり上がる
    const toolbar = buildEditorToolbar();
    screen.appendChild(toolbar);
    toolbarCleanup = setupToolbarTracking(toolbar);
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
  if (kind === 'docStart')     next = 0;
  if (kind === 'docEnd')       next = text.length;
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
// 入力ツールバー（キーボード直上に固定表示する 2 段ツールバー）
// ------------------------------------------------------------
// Web の制約:
//   ・iOS のキーボード上部の予測変換バー（候補表示帯）には干渉できない。
//   ・WebKit が描く inputAccessoryView 領域に直接ツールバーを注入できない。
//   ・本実装は visualViewport の高さ差分からキーボード上端を算出し、
//     ツールバーを position:fixed で「予測変換バーの上に乗せる」擬似実装。
//   ・予測変換バー直上へ食い込ませる動作は Phase 2（SwiftUI / inputAccessoryView）で対応。
// ============================================================

function buildEditorToolbar() {
  const settings = getState().settings;

  // 簡易入力のみ（取り消し・カーソル移動などの下段は廃止）
  const quickRow = el('div', { class: 'tb-row tb-quick' });
  const quickButtons = settings.customQuickButtons || ['「」', '『』', 'ーー', '……', '　', '\n'];
  for (const sym of quickButtons) {
    const label = sym === '\n' ? '改行' : sym === '　' ? '空白' : sym;
    quickRow.appendChild(tbButton(label, () => insertSymbol(sym)));
  }

  const toolbar = el('div', { class: 'editor-toolbar' }, [quickRow]);
  // 初期位置（visualViewport が未対応の環境向けフォールバック）
  toolbar.style.bottom = '0px';
  return toolbar;
}

function tbButton(label, onClick, title) {
  return el('button', {
    type: 'button',
    class: 'tb-btn',
    title: title || '',
    tabindex: '-1',
    'aria-label': title || label,
    onpointerdown: (e) => e.preventDefault(),  // contenteditable のフォーカスを奪わない
    onmousedown:   (e) => e.preventDefault(),
    onclick: onClick,
  }, label);
}

function tbDivider() {
  return el('span', { class: 'tb-divider', 'aria-hidden': 'true' });
}

// visualViewport 監視でキーボード上端にツールバーを追従させる。
// 戻り値はリスナー解除関数。
function setupToolbarTracking(toolbar) {
  const vv = window.visualViewport;

  function update() {
    if (vv) {
      // キーボード高さ = レイアウトビューポート高 − 可視ビューポート高 − オフセット
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
      toolbar.style.bottom = Math.max(0, keyboardHeight) + 'px';
    } else {
      // 非対応環境：画面下部に固定
      toolbar.style.bottom = '0px';
    }
  }

  let ac = null;
  if (vv && typeof AbortController === 'function') {
    ac = new AbortController();
    vv.addEventListener('resize', update, { signal: ac.signal });
    vv.addEventListener('scroll', update, { signal: ac.signal });
  } else if (vv) {
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
  }
  // 初回反映
  update();

  return () => {
    if (ac) {
      ac.abort();
    } else if (vv) {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    }
  };
}

// document.execCommand での undo/redo
function execEdit(cmd) {
  if (!paperEl) return;
  paperEl.focus();
  try {
    document.execCommand(cmd, false);
  } catch (_) { /* ignore */ }
  onPaperInput();
}
