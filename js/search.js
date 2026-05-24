// 検索置換・表記揺れチェック・辞書（モック）

import { el, clear, toast } from './util.js';
import { openModal, closeModal } from './modal.js';
import { update, getCurrentDraft } from './store.js';

const VARIANT_PATTERNS = [
  { canon: 'ください', variants: ['下さい'], note: '依頼の補助動詞は仮名書きが一般的' },
  { canon: 'こと',     variants: ['事'],     note: '形式名詞は仮名書きが推奨' },
  { canon: 'とき',     variants: ['時'],     note: '形式名詞用法は仮名書きが推奨' },
  { canon: 'ため',     variants: ['為'],     note: '形式名詞は仮名書きが推奨' },
  { canon: 'もの',     variants: ['物'],     note: '形式名詞用法は仮名書きが推奨' },
  { canon: 'できる',   variants: ['出来る'], note: '補助動詞は仮名書きが一般的' },
  { canon: 'いう',     variants: ['言う'],   note: '形式動詞は仮名書きが推奨' },
  { canon: 'ように',   variants: ['様に'],   note: '比喩・例示は仮名書きが推奨' },
  { canon: 'ところ',   variants: ['所'],     note: '形式名詞は仮名書きが推奨' },
  { canon: 'ほど',     variants: ['程'],     note: '副助詞用法は仮名書きが推奨' },
];

const DICTIONARY = {
  '逡巡': '進むか退くかをためらうこと。決断できずにぐずぐずすること。',
  '邂逅': '思いがけずに出会うこと。めぐりあい。',
  '黎明': '夜明け。物事の始まろうとするとき。',
  '矜持': '自分の能力を信じて抱く誇り。プライド。',
  '逍遥': 'そぞろ歩き。気の向くままに歩き回ること。',
  '凜然': 'りりしく勇ましいさま。態度が立派なさま。',
  '蒼穹': '青空。大空。',
  '一瞥': 'ちらりと一度見ること。',
  '寡黙': '口数が少ないこと。',
  '俯瞰': '高い所から見下ろすこと。全体を見渡すこと。',
};

export function openSearchReplace(paperEl, draftId, onChange) {
  let lastIndex = -1;
  const queryInput = el('input', { type: 'text', placeholder: '検索語' });
  const replaceInput = el('input', { type: 'text', placeholder: '置換語' });
  const stat = el('div', { class: 'search-stat' }, '0 件ヒット');

  const body = el('div', { class: 'search-fields' }, [
    el('div', { class: 'row' }, [el('label', {}, '検索'),  queryInput]),
    el('div', { class: 'row' }, [el('label', {}, '置換'), replaceInput]),
    stat,
  ]);

  function countMatches() {
    const q = queryInput.value;
    if (!q) { stat.textContent = '0 件ヒット'; return 0; }
    const text = paperEl.innerText || '';
    let n = 0, i = 0;
    while ((i = text.indexOf(q, i)) !== -1) { n++; i += q.length; }
    stat.textContent = `${n} 件ヒット`;
    return n;
  }

  function findNext() {
    const q = queryInput.value;
    if (!q) return;
    const text = paperEl.innerText || '';
    const start = lastIndex + 1;
    let idx = text.indexOf(q, start);
    if (idx === -1) idx = text.indexOf(q);
    if (idx === -1) { toast('見つかりませんでした'); return; }
    lastIndex = idx;
    selectRangeInPaper(paperEl, idx, idx + q.length);
    toast(`${idx + 1} 文字目を選択`);
  }

  function replaceCurrent() {
    const q = queryInput.value;
    const r = replaceInput.value;
    if (!q) return;
    const text = paperEl.innerText || '';
    if (lastIndex < 0 || text.slice(lastIndex, lastIndex + q.length) !== q) {
      findNext();
      return;
    }
    const next = text.slice(0, lastIndex) + r + text.slice(lastIndex + q.length);
    applyTextToDraft(paperEl, draftId, next);
    lastIndex = lastIndex + r.length - q.length;
    countMatches();
    if (onChange) onChange();
    toast('置換しました');
  }

  function replaceAll() {
    const q = queryInput.value;
    const r = replaceInput.value;
    if (!q) return;
    const text = paperEl.innerText || '';
    const next = text.split(q).join(r);
    const n = text.split(q).length - 1;
    if (n === 0) { toast('見つかりませんでした'); return; }
    applyTextToDraft(paperEl, draftId, next);
    countMatches();
    if (onChange) onChange();
    toast(`${n} 箇所を置換しました`);
  }

  queryInput.addEventListener('input', countMatches);

  openModal({
    title: '検索・置換',
    body,
    actions: [
      { label: '次を検索', onclick: findNext, close: false },
      { label: '置換',     onclick: replaceCurrent, close: false },
      { label: '全置換',   variant: 'primary', onclick: replaceAll, close: false },
      { label: '閉じる',   variant: 'ghost' },
    ],
  });
}

export function openVariantCheck(paperEl, draftId, onChange) {
  const text = paperEl.innerText || '';
  const hits = [];
  for (const pat of VARIANT_PATTERNS) {
    for (const v of pat.variants) {
      let idx = 0;
      while ((idx = text.indexOf(v, idx)) !== -1) {
        const ctxStart = Math.max(0, idx - 8);
        const ctxEnd = Math.min(text.length, idx + v.length + 8);
        hits.push({
          pos: idx,
          variant: v,
          canon: pat.canon,
          note: pat.note,
          context: text.slice(ctxStart, ctxEnd),
        });
        idx += v.length;
      }
    }
  }
  let body;
  if (hits.length === 0) {
    body = el('div', { class: 'variant-empty' }, '表記揺れは見つかりませんでした。');
  } else {
    body = el('div', { class: 'variant-list' });
    for (const h of hits) {
      const item = el('div', { class: 'variant-item' }, [
        el('div', { class: 'variant-context' }, [
          '…',
          el('span', { style: { color: 'var(--warn)', fontWeight: '600' } }, h.variant),
          h.context.slice(h.context.indexOf(h.variant) + h.variant.length),
          '…',
        ]),
        el('button', {
          onclick: () => {
            const cur = paperEl.innerText || '';
            // 同じ index に再度ヒットすることを期待
            const next = cur.slice(0, h.pos) + h.canon + cur.slice(h.pos + h.variant.length);
            applyTextToDraft(paperEl, draftId, next);
            if (onChange) onChange();
            item.remove();
            toast(`「${h.variant}」→「${h.canon}」に置換`);
          },
        }, `→ ${h.canon}`),
        el('div', { class: 'variant-meta' }, h.note),
      ]);
      body.appendChild(item);
    }
  }
  openModal({
    title: '表記揺れチェック',
    body,
    actions: [
      {
        label: '全て統一', variant: 'primary', onclick: () => {
          let txt = paperEl.innerText || '';
          let total = 0;
          for (const pat of VARIANT_PATTERNS) {
            for (const v of pat.variants) {
              const before = txt;
              txt = txt.split(v).join(pat.canon);
              total += (before.length - txt.length) / Math.max(1, v.length - pat.canon.length || 1);
            }
          }
          applyTextToDraft(paperEl, draftId, txt);
          if (onChange) onChange();
          toast('表記を統一しました');
        },
      },
      { label: '閉じる', variant: 'ghost' },
    ],
  });
}

export function openDictionary(word) {
  const entry = DICTIONARY[word] || `「${word}」: モック辞書には登録がありません。Phase 2 では外部辞書 API と連携します。`;
  openModal({
    title: `辞書: ${word}`,
    body: el('div', { style: { fontFamily: '"Noto Serif JP", serif', fontSize: '14px', lineHeight: '1.7' } }, entry),
    actions: [{ label: '閉じる', variant: 'primary' }],
  });
}

function applyTextToDraft(paperEl, draftId, newText) {
  paperEl.textContent = newText;
  update(s => {
    const draft = s.drafts.find(d => d.id === draftId);
    if (draft) {
      draft.body = newText;
      draft.lastEditedAt = Date.now();
    }
  });
}

function selectRangeInPaper(paperEl, start, end) {
  paperEl.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  let s = start, e = end;
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.nodeValue.length;
      if (s !== null && s <= len) {
        range.setStart(node, s);
        s = null;
      } else if (s !== null) {
        s -= len;
      }
      if (e !== null && e <= len) {
        range.setEnd(node, e);
        e = null;
        return true;
      } else if (e !== null) {
        e -= len;
      }
      return false;
    }
    for (const c of node.childNodes) {
      if (walk(c)) return true;
    }
    return false;
  }
  walk(paperEl);
  sel.removeAllRanges();
  sel.addRange(range);
}
