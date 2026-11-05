/* Public-site counters. Local previews and error pages never send visits. */
(() => {
  "use strict";
  if (window.__kdAnalyticsReady) return;
  window.__kdAnalyticsReady = true;

  const status = document.querySelector('[data-kd-statistics-status]');
  const setStatus = text => { if (status) status.textContent = text; };
  if (location.hostname !== 'kedian-club.github.io') {
    setStatus('本地预览不计入访问统计。');
    return;
  }
  if (document.querySelector('.kd-error-page')) return;

  const values = ['site_pv', 'site_uv'].map(name =>
    document.getElementById(`busuanzi_${name}`));
  let timer;
  let observer;
  const received = () => {
    if (!values.every(node => node && /^\d+$/.test(node.textContent.trim()))) return;
    clearTimeout(timer);
    observer?.disconnect();
    setStatus('访问数据从接入后累计，UV 为服务去重估算。');
  };
  if (values.every(Boolean)) {
    observer = new MutationObserver(received);
    values.forEach(node => observer.observe(node, {childList: true, subtree: true, characterData: true}));
    timer = setTimeout(() => setStatus('访问统计暂不可用，请稍后刷新。'), 10000);
  }

  const script = document.createElement('script');
  script.src = 'https://busuanzi.9420.ltd/js';
  script.async = true;
  script.onerror = () => {
    clearTimeout(timer);
    observer?.disconnect();
    setStatus('访问统计暂不可用，请稍后刷新。');
  };
  document.head.append(script);
})();
