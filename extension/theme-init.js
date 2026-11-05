// Sets the saved theme before the page draws, so it doesn't flash light then dark.
try {
  const theme = localStorage.getItem('debriefTheme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {}
