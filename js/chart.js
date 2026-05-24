// 進捗管理画面と Chart.js ラッパ

import { el, clear } from './util.js';
import { getState } from './store.js';

let chartInstance = null;
let currentRange = 7;

export function renderProgress(root) {
  const screen = el('section', { class: 'screen' });

  const back = el('button', { class: 'back-btn', onclick: () => location.hash = '#screen-home' }, '◁ 戻る');
  const header = el('div', { class: 'app-header' }, [back, el('div', { class: 'title' }, '進捗管理')]);
  screen.appendChild(header);

  const body = el('div', { class: 'screen-body' });

  // タブ
  const tabs = el('div', { class: 'range-tabs', style: { marginTop: '12px' } });
  const ranges = [{ k: 7, l: '7日' }, { k: 30, l: '30日' }, { k: 0, l: '全期間' }];
  for (const r of ranges) {
    const b = el('button', {
      class: currentRange === r.k ? 'active' : '',
      onclick: () => { currentRange = r.k; renderInside(); },
    }, r.l);
    tabs.appendChild(b);
  }
  body.appendChild(tabs);

  const summary = el('div', { class: 'summary-cards' });
  body.appendChild(summary);

  const chartBox = el('div', { class: 'chart-container' });
  const canvas = el('canvas', { id: 'progress-chart' });
  chartBox.appendChild(canvas);
  body.appendChild(chartBox);

  // 原稿別の小カード
  const draftSection = el('div');
  body.appendChild(draftSection);

  screen.appendChild(body);
  root.appendChild(screen);

  function renderInside() {
    // タブの active 再設定
    tabs.querySelectorAll('button').forEach((b, i) => {
      b.classList.toggle('active', ranges[i].k === currentRange);
    });
    drawChart(canvas);
    drawSummary(summary);
    drawDraftBreakdown(draftSection);
  }
  renderInside();
}

function aggregateByDate(range) {
  const state = getState();
  const map = new Map();
  for (const d of state.drafts) {
    for (const h of (d.charCountHistory || [])) {
      map.set(h.date, (map.get(h.date) || 0) + h.count);
    }
  }
  let entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (range > 0) {
    entries = entries.slice(-range);
  }
  return entries;
}

function drawChart(canvas) {
  if (!window.Chart) {
    // Chart.js 読込中
    setTimeout(() => drawChart(canvas), 100);
    return;
  }
  const entries = aggregateByDate(currentRange);
  const labels = entries.map(([d]) => d.slice(5));
  const values = entries.map(([_, v]) => v);

  if (chartInstance) {
    chartInstance.destroy();
  }

  const ink = getCSS('--ink-soft');
  const accent = getCSS('--accent');
  const border = getCSS('--border');

  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: '執筆文字数',
          data: values,
          backgroundColor: hexA(accent, 0.45),
          borderColor: accent,
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: '推移',
          data: values,
          borderColor: accent,
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 2,
          pointBackgroundColor: accent,
          yAxisID: 'y',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: ink, font: { size: 10 } } },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { ticks: { color: ink, font: { size: 9 } }, grid: { color: border } },
        y: { beginAtZero: true, ticks: { color: ink, font: { size: 9 } }, grid: { color: border } },
      },
    },
  });
}

function drawSummary(node) {
  clear(node);
  const state = getState();
  let total = 0;
  let days = new Set();
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  // 累計
  for (const d of state.drafts) {
    for (const h of (d.charCountHistory || [])) {
      total += h.count;
      if (h.count > 0) days.add(h.date);
    }
  }
  // 連続執筆日
  const sorted = [...days].sort().reverse();
  let cursor = new Date();
  for (let i = 0; i < 365; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (sorted.includes(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  const avg = days.size > 0 ? Math.round(total / days.size) : 0;

  node.appendChild(card(total.toLocaleString(), '累計文字数'));
  node.appendChild(card(avg.toLocaleString(),   '平均/日'));
  node.appendChild(card(streak + '日',          '連続執筆日数'));
}

function card(num, lbl) {
  return el('div', { class: 'summary-card' }, [
    el('span', { class: 'num' }, num),
    el('span', { class: 'lbl' }, lbl),
  ]);
}

function drawDraftBreakdown(node) {
  clear(node);
  const state = getState();
  const title = el('div', { class: 'section-title' }, '原稿別 直近文字数');
  node.appendChild(title);
  const list = el('div', { class: 'draft-list', style: { marginBottom: '12px' } });
  for (const d of state.drafts) {
    const last = (d.charCountHistory || []).slice(-7).reduce((a, b) => a + b.count, 0);
    list.appendChild(el('div', { class: 'draft-row' }, [
      el('div', { class: 'draft-title' }, d.title),
      el('div', { class: 'draft-meta' }, '直近7日'),
      el('div', { class: 'draft-side' }, [el('div', { class: 'char-count' }, last.toLocaleString() + ' 字')]),
    ]));
  }
  node.appendChild(list);
}

function getCSS(varName) {
  return getComputedStyle(document.body).getPropertyValue(varName).trim() || '#2C4A6E';
}

function hexA(hex, alpha) {
  // hex (#RRGGBB) → rgba
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.replace(/^#/, ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`;
}
