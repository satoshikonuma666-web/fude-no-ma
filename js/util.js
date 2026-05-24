// 共通ユーティリティ

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  if (children == null) return;
  if (Array.isArray(children)) {
    for (const c of children) appendChildren(node, c);
    return;
  }
  if (children instanceof Node) { node.appendChild(children); return; }
  node.appendChild(document.createTextNode(String(children)));
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function fmtRelative(ts) {
  if (!ts) return '未編集';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}日前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function fmtDate(date) {
  const d = (date instanceof Date) ? date : new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function countChars(text, { includePunctuation = true } = {}) {
  if (!text) return 0;
  let s = text.replace(/\n/g, '');
  if (!includePunctuation) {
    s = s.replace(/[、。・「」『』（）()【】\[\]…—ー　 ,.\!?！？:：;；]/g, '');
  } else {
    s = s.replace(/\s/g, '');
  }
  return Array.from(s).length;
}

export function genshiCount(n) {
  // 原稿用紙換算 400字
  return (n / 400).toFixed(1);
}

const STATUS_LABEL = {
  writing: '執筆中',
  revising: '推敲中',
  done: '完了',
};
export function statusLabel(s) { return STATUS_LABEL[s] || s; }

export function toast(msg, ms = 1600) {
  const root = document.getElementById('toast-root');
  const t = el('div', { class: 'toast' }, msg);
  root.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 200ms';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 220);
  }, ms);
}

export function applyRuby(text) {
  // ｜漢字《かんじ》 → <ruby>漢字<rt>かんじ</rt></ruby>
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/｜([^｜《》\n]+?)《([^《》\n]+?)》/g, (_, base, rt) => {
    return `<ruby>${base}<rt>${rt}</rt></ruby>`;
  });
}

export function svg(d, opts = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', opts.viewBox || '0 0 24 24');
  s.setAttribute('width', opts.size || 18);
  s.setAttribute('height', opts.size || 18);
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', d);
  p.setAttribute('fill', opts.fill || 'none');
  p.setAttribute('stroke', opts.stroke || 'currentColor');
  p.setAttribute('stroke-width', opts.strokeWidth || 1.6);
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  s.appendChild(p);
  return s;
}
