document.getElementById('options-btn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('fill-btn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'FILL_FORM' });
      window.close(); // Close popup after clicking
    }
  } catch (err) {
    console.error(err);
    document.getElementById('fill-btn').textContent = 'Error: Please Refresh Page';
    document.getElementById('fill-btn').style.backgroundColor = '#ef4444';
    setTimeout(() => {
      document.getElementById('fill-btn').textContent = 'Auto-Fill Application';
      document.getElementById('fill-btn').style.backgroundColor = '#3b82f6';
    }, 3000);
  }
});
