document.getElementById('open-lab').addEventListener('click', () => {
  if (globalThis.chrome?.tabs) {
    chrome.tabs.create({ url: chrome.runtime.getURL('lab.html') });
    window.close();
  } else window.location.assign('lab.html');
});
