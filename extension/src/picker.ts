// "For" pickers shared by Live and Prepare: choose the job, then one of its candidates.
import { el, fillSelect } from './ui.ts';
import { getState } from './data.ts';
import * as S from './store.ts';

export interface Pick {
  jobId: string;
  candidateId: string;
}

export interface Picker {
  refresh(): Pick;
  get(): Pick;
  set(jobId: string | null | undefined, candidateId: string | null | undefined): Pick;
}

// Builds two selects inside `host`. onChange({ jobId, candidateId }) runs when either changes.
export function createPicker(host: HTMLElement, { onChange }: { onChange: (pick: Pick) => void }): Picker {
  const jobSelect = el('select', { class: 'pick', 'aria-label': 'Job' });
  const candSelect = el('select', { class: 'pick', 'aria-label': 'Candidate' });
  host.replaceChildren(el('label', { class: 'pick-label' }, 'For'), jobSelect, candSelect);

  let current: Pick = { jobId: '', candidateId: '' };

  function refresh(): Pick {
    const state = getState();
    // Open jobs first; a closed job stays selectable if it's the one already chosen.
    const jobs = state.jobs.filter((j) => j.status === 'open' || j.id === current.jobId);
    const jobId = fillSelect(
      jobSelect,
      jobs.map((j) => ({ value: j.id, label: S.jobLabel(j) })),
      current.jobId,
    );
    const cands = jobId ? S.candidatesFor(state, jobId) : [];
    const candidateId = fillSelect(
      candSelect,
      cands.map((c) => ({ value: c.id, label: `${c.name} · ${S.STAGE_LABELS[c.stage]}` })),
      current.candidateId,
    );
    jobSelect.disabled = !jobs.length;
    candSelect.disabled = !cands.length;
    current = { jobId: jobId || '', candidateId: candidateId || '' };
    return current;
  }

  jobSelect.addEventListener('change', () => {
    current = { jobId: jobSelect.value, candidateId: '' };
    onChange(refresh());
  });
  candSelect.addEventListener('change', () => {
    current = { ...current, candidateId: candSelect.value };
    onChange(current);
  });

  return {
    refresh,
    get: () => current,
    set(jobId, candidateId) {
      current = { jobId: jobId || '', candidateId: candidateId || '' };
      return refresh();
    },
  };
}
