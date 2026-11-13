export {}; // a module, loaded with type="module" in mic.html
// The microphone permission page (mic.html). The side panel can't show Chrome's permission prompt,
// so the panel opens this page in a tab; once allowed here, the panel can use the microphone too.
const show = (id: string, on: boolean) => {
  const node = document.getElementById(id);
  if (node) node.hidden = !on;
};

async function ask(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop()); // only the permission is needed, not the audio
    show('micAsk', false);
    show('micBlocked', false);
    show('micDone', true);
    show('micTry', false);
    setTimeout(() => window.close(), 2500);
  } catch {
    show('micAsk', false);
    show('micBlocked', true);
    const button = document.getElementById('micTry');
    if (button) button.textContent = 'Try again';
  }
}

document.getElementById('micTry')?.addEventListener('click', () => void ask());
void ask(); // Chrome shows its prompt straight away; the button is for a second try
