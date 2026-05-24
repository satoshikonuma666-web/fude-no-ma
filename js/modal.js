// 共通モーダル

import { el, clear } from './util.js';

const root = () => document.getElementById('modal-root');

export function openModal({ title, body, actions }) {
  const r = root();
  clear(r);
  const bodyNode = el('div', { class: 'body' });
  if (typeof body === 'string') bodyNode.textContent = body;
  else if (body instanceof Node) bodyNode.appendChild(body);
  const footerChildren = (actions || []).map(a =>
    el('button', {
      class: a.variant === 'primary' ? 'btn-primary' : a.variant === 'warn' ? 'btn-warn' : 'btn-ghost',
      onclick: () => {
        if (a.onclick) a.onclick();
        if (a.close !== false) closeModal();
      },
    }, a.label)
  );
  const modal = el('div', { class: 'modal' }, [
    el('header', {}, title || ''),
    bodyNode,
    el('footer', {}, footerChildren),
  ]);
  r.appendChild(modal);
  r.classList.add('open');
  r.addEventListener('click', backdropClick, { once: true });
  return { close: closeModal, bodyNode };
}

function backdropClick(e) {
  if (e.target === root()) closeModal();
}

export function closeModal() {
  const r = root();
  r.classList.remove('open');
  clear(r);
}
