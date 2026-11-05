// Small DOM helpers. Everything is built with createElement and textContent (never innerHTML),
// so text from jobs, resumes or the AI can't inject markup.

export const $ = (id) => document.getElementById(id);

// el('button', { class: 'primary-btn', onclick: fn, type: 'button' }, 'Save')
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'value' || (key in node && typeof value !== 'string')) node[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

// A short message at the bottom of the panel. Errors stay until the next message; others fade.
let toastTimer = null;
export function toast(message, { error = false } = {}) {
  const box = $('toast');
  if (!box) return;
  clearTimeout(toastTimer);
  box.textContent = message || '';
  box.classList.toggle('error', error);
  box.hidden = !message;
  if (message && !error) toastTimer = setTimeout(() => (box.hidden = true), 3500);
}

// Opens a <dialog> sheet. Any [data-close] button inside closes it.
export function openSheet(id) {
  const dialog = $(id);
  if (!dialog.dataset.wired) {
    dialog.dataset.wired = '1';
    dialog.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') || e.target === dialog) dialog.close();
    });
  }
  if (!dialog.open) dialog.showModal();
  return dialog;
}

// Asks a yes/no question in a sheet (no browser confirm(), which blocks the page).
export function confirmSheet({ title, body, yes = 'Delete', no = 'Keep', danger = true }) {
  return new Promise((resolve) => {
    $('confirmTitle').textContent = title;
    $('confirmBody').textContent = body;
    const yesBtn = $('confirmYes');
    const noBtn = $('confirmNo');
    yesBtn.textContent = yes;
    noBtn.textContent = no;
    yesBtn.classList.toggle('danger', danger);
    const dialog = openSheet('confirmSheet');
    const done = (answer) => {
      yesBtn.onclick = noBtn.onclick = null;
      dialog.removeEventListener('close', onClose);
      if (dialog.open) dialog.close();
      resolve(answer);
    };
    const onClose = () => done(false);
    yesBtn.onclick = () => done(true);
    noBtn.onclick = () => done(false);
    dialog.addEventListener('close', onClose);
    noBtn.focus(); // the safe choice is focused
  });
}

// Fills a <select> and keeps the current choice when it still exists.
export function fillSelect(select, options, value) {
  select.replaceChildren(...options.map((o) => new Option(o.label, o.value)));
  if (options.some((o) => o.value === value)) select.value = value;
  return select.value;
}

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: value.length > 10 ? 'short' : undefined });
}

// Reads a file as base64 (without the data: prefix).
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('We couldn’t open that file.'));
    reader.readAsDataURL(file);
  });
}

// Busy state for a button while something runs.
export async function withBusy(button, label, task) {
  const original = button.textContent;
  button.disabled = true;
  if (label) button.textContent = label;
  try {
    return await task();
  } finally {
    button.disabled = false;
    // Put the label back, unless a redraw already gave the button a new one.
    if (!label || button.textContent === label) button.textContent = original;
  }
}
