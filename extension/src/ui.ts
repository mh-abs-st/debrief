// Small DOM helpers. Everything is built with createElement and textContent (never innerHTML),
// so text from jobs, resumes or the AI can't inject markup.

// The top tabs. Interview shows the current candidate's page; from Upcoming and Jobs you can open anyone's
// page to look at it. The demo is a page, not a tab.
export type Tab = 'interview' | 'upcoming' | 'jobs';

// The parts of a candidate's page.
export type Section = 'plan' | 'interview' | 'notes';

// Moving around the panel. panel.ts makes it and hands it to each view.
export interface Nav {
  tab(tab: Tab): void;
  job(jobId: string): void;
  // Opens someone's page to look at it (the Interview tab, if they're the current candidate).
  candidate(candidateId: string, section?: Section): void;
  // Makes them the current candidate and shows the Interview tab.
  interviewWith(candidateId: string): void;
  addJob(): void;
  addCandidate(jobId: string): void;
  editCandidate(candidateId: string): void;
  demo(): void;
}

// The element with this id in panel.html. Say which kind when you need its fields: $<HTMLInputElement>('setToken').
export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

// The element an event came from, for delegated clicks: closestTarget(e, '[data-v]').
export const closestTarget = <T extends HTMLElement = HTMLElement>(e: Event, selector: string): T | null =>
  e.target instanceof Element ? (e.target.closest(selector) as T | null) : null;

export type Child = Node | string | number | boolean | null | undefined;

// class, dataset, on<event> handlers, DOM properties (value, checked, disabled…) or plain attributes.
export type Attrs = Record<string, unknown>;

// el('button', { class: 'primary-btn', onclick: fn, type: 'button' }, 'Save')
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = {}, ...children: Array<Child | Child[]>): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value as EventListener);
    else if (key === 'value' || (key in node && typeof value !== 'string')) Reflect.set(node, key, value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function icon(name: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

// How long a message stays up, in ms. Errors stay long enough to read (about 70 ms a character,
// between 10 and 20 seconds); others fade after 3.5 seconds.
export function toastDuration(message: string, error: boolean): number {
  if (!error) return 3500;
  return Math.min(20_000, Math.max(10_000, message.length * 70));
}

// A short message at the bottom of the panel. Errors have a close button and hide on their own
// (later than other messages); the next message replaces either. While the pointer is over a message,
// or its close button has focus, it stays up.
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastWait = 0;

const hideToastLater = () => {
  clearTimeout(toastTimer);
  if (toastWait) toastTimer = setTimeout(hideToast, toastWait);
};

export function hideToast(): void {
  clearTimeout(toastTimer);
  toastWait = 0;
  const box = $('toast');
  if (box) box.hidden = true;
}

export function toast(message: string, { error = false }: { error?: boolean } = {}): void {
  const box = $('toast');
  if (!box) return;
  if (!box.dataset.wired) {
    box.dataset.wired = '1';
    $('toastClose').addEventListener('click', hideToast);
    box.addEventListener('pointerenter', () => clearTimeout(toastTimer));
    box.addEventListener('pointerleave', hideToastLater);
    box.addEventListener('focusin', () => clearTimeout(toastTimer));
    box.addEventListener('focusout', hideToastLater);
  }
  if (!message) return hideToast();
  $('toastText').textContent = message;
  box.classList.toggle('error', error);
  $('toastClose').hidden = !error;
  box.hidden = false;
  toastWait = toastDuration(message, error);
  hideToastLater();
}

// Opens a <dialog> sheet. Any [data-close] button inside closes it.
export function openSheet(id: string): HTMLDialogElement {
  const dialog = $<HTMLDialogElement>(id);
  if (!dialog.dataset.wired) {
    dialog.dataset.wired = '1';
    dialog.addEventListener('click', (e) => {
      if (closestTarget(e, '[data-close]') || e.target === dialog) dialog.close();
    });
  }
  if (!dialog.open) dialog.showModal();
  return dialog;
}

export interface ConfirmOptions {
  title: string;
  body: string;
  yes?: string;
  no?: string;
  danger?: boolean;
}

// Asks a yes/no question in a sheet (no browser confirm(), which blocks the page).
export function confirmSheet({ title, body, yes = 'Delete', no = 'Keep', danger = true }: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    $('confirmTitle').textContent = title;
    $('confirmBody').textContent = body;
    const yesBtn = $<HTMLButtonElement>('confirmYes');
    const noBtn = $<HTMLButtonElement>('confirmNo');
    yesBtn.textContent = yes;
    noBtn.textContent = no;
    yesBtn.classList.toggle('danger', danger);
    const dialog = openSheet('confirmSheet');
    const done = (answer: boolean) => {
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
export function fillSelect(select: HTMLSelectElement, options: Array<{ value: string; label: string }>, value: string): string {
  select.replaceChildren(...options.map((o) => new Option(o.label, o.value)));
  if (options.some((o) => o.value === value)) select.value = value;
  return select.value;
}

export function formatDate(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: value.length > 10 ? 'short' : undefined });
}

// Reads a file as base64 (without the data: prefix).
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('We couldn’t open that file.'));
    reader.readAsDataURL(file);
  });
}

// Busy state for a button while something runs.
export async function withBusy<T>(button: HTMLButtonElement, label: string, task: () => Promise<T>): Promise<T> {
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

// The message to show for something caught: our own errors already carry a friendly one.
export const errorMessage = (err: unknown, fallback = 'Something went wrong. Please try again.'): string =>
  err instanceof Error && err.message ? err.message : fallback;
