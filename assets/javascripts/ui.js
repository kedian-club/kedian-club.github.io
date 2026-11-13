/* Small, dependency-free enhancements. Content remains usable without JavaScript. */
(() => {
  "use strict";
  if (window.__kdUiReady) return;
  window.__kdUiReady = true;

  let viewer;
  let viewerImage;
  let viewerTitle;
  let previousFocus;

  function ensureViewer() {
    if (viewer) return viewer;
    viewer = document.createElement("dialog");
    viewer.className = "kd-image-dialog";
    viewer.setAttribute("aria-labelledby", "kd-image-viewer-title");
    const bar = document.createElement("div");
    bar.className = "kd-image-dialog__bar";
    viewerTitle = document.createElement("p");
    viewerTitle.id = "kd-image-viewer-title";
    viewerTitle.className = "kd-image-dialog__title";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "kd-image-dialog__close";
    closeButton.textContent = "关闭";
    closeButton.setAttribute("aria-label", "关闭图片预览");
    closeButton.addEventListener("click", () => viewer.close());
    bar.append(viewerTitle, closeButton);
    viewerImage = document.createElement("img");
    viewerImage.className = "kd-image-dialog__image";
    viewer.append(bar, viewerImage);
    viewer.addEventListener("click", (event) => {
      if (event.target !== viewer) return;
      const box = viewer.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) viewer.close();
    });
    viewer.addEventListener("close", () => {
      viewerImage.removeAttribute("src");
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    });
    document.body.append(viewer);
    return viewer;
  }

  function prepareImage(image) {
    if (image.dataset.kdZoom || image.closest("a, button, .kd-home, .no-zoom") || image.matches(".twemoji, .emojione, .gemoji, [data-no-zoom]")) return;
    if (!image.complete) {
      if (!image.dataset.kdZoomPending) {
        image.dataset.kdZoomPending = "true";
        image.addEventListener("load", () => prepareImage(image), { once: true });
      }
      return;
    }
    if (Math.max(image.naturalWidth, image.naturalHeight) < 240) return;
    image.dataset.kdZoom = "true";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "kd-image-trigger";
    trigger.setAttribute("aria-label", image.alt ? `放大图片：${image.alt}` : "放大图片");
    trigger.setAttribute("aria-haspopup", "dialog");
    image.before(trigger);
    trigger.append(image);
    trigger.addEventListener("click", () => {
      ensureViewer();
      previousFocus = trigger;
      viewerTitle.textContent = image.alt || "图片预览";
      viewerImage.alt = image.alt || "";
      viewerImage.src = image.currentSrc || image.src;
      viewer.showModal();
    });
  }

  function prepareFilm() {
    const video = document.querySelector('#kd-club-film');
    const play = document.querySelector('.kd-film__play');
    const error = document.querySelector('.kd-film__error');
    const label = play?.querySelector('.kd-film__play-label');
    if (!video || !play || !label || !error || video.dataset.kdReady) return;
    video.dataset.kdReady = 'true';
    // Keep a clean cover before playback; native controls return on interaction.
    video.controls = false;
    play.hidden = false;
    let retry = false;
    const failed = () => {
      retry = true;
      video.controls = false;
      error.hidden = false;
      play.hidden = false;
      label.textContent = '重试播放';
      play.setAttribute('aria-label', '重试播放科电俱乐部宣传片');
    };
    play.addEventListener('click', async () => {
      error.hidden = true;
      play.hidden = true;
      video.controls = true;
      try {
        if (retry) video.load();
        await video.play();
        video.focus({preventScroll: true});
      } catch (_) { failed(); }
    });
    video.addEventListener('playing', () => {
      retry = false;
      play.hidden = true;
      error.hidden = true;
      label.textContent = '播放宣传片';
      play.setAttribute('aria-label', '播放科电俱乐部宣传片');
    });
    video.addEventListener('ended', () => { play.hidden = false; });
    video.addEventListener('error', failed);
  }

  function prepareArticleImage(image) {
    if (image.closest('.kd-home') || image.matches('.twemoji, .emojione, .gemoji')) return;
    if (!image.dataset.kdFallback) {
      image.dataset.kdFallback = 'true';
      const failed = () => {
        const message = document.createElement('span');
        message.className = 'kd-image-fallback';
        message.textContent = image.alt ? `图片加载失败：${image.alt}。请刷新重试。` : '图片加载失败，请刷新重试。';
        const target = image.closest('.kd-image-trigger') || image.closest('picture') || image;
        target.replaceWith(message);
      };
      image.addEventListener('error', failed, { once: true });
      if (image.complete && !image.naturalWidth && (image.currentSrc || image.getAttribute('src'))) {
        failed();
        return;
      }
    }
    if ('HTMLDialogElement' in window) prepareImage(image);
  }

  function prepareErrorSearch() {
    const button = document.querySelector('.kd-error-page__search');
    const toggle = document.getElementById('__search');
    const input = document.querySelector('.md-search__input');
    if (!button || !toggle || !input || !button.hidden) return;
    button.hidden = false;
    button.addEventListener('click', () => {
      if (!toggle.checked) toggle.click();
      input.focus();
    });
  }

  let backgroundCleanup;
  function prepareBackground() {
    if (backgroundCleanup) backgroundCleanup();
    const video = document.querySelector('.kd-day-background video');
    const toggle = document.querySelector('.kd-background-toggle');
    if (!video || !toggle) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = matchMedia('(max-width: 44.984375em)');
    const connection = navigator.connection;
    let playRequested = false;
    let pausedByUser = false;
    try { pausedByUser = sessionStorage.getItem('kd-background-paused') === 'true'; } catch (_) {}
    let generation = 0;
    const sync = async () => {
      const current = ++generation;
      const light = document.body.getAttribute('data-md-color-scheme') === 'default';
      const source = light ? video.dataset.src : video.dataset.darkSrc;
      video.defaultPlaybackRate = light ? 0.5 : 1;
      video.playbackRate = video.defaultPlaybackRate;
      toggle.hidden = false;
      if (light) video.poster = video.dataset.lightPoster;
      else video.removeAttribute('poster');
      if (video.getAttribute('src') && video.getAttribute('src') !== source) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      const slowConnection = connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType);
      if (document.hidden || pausedByUser || (!playRequested && (reduced.matches || mobile.matches || slowConnection))) {
        video.pause();
        toggle.textContent = '播放背景';
        return;
      }
      if (!video.getAttribute('src')) video.src = source;
      video.muted = true;
      try {
        await video.play();
        if (current === generation) toggle.textContent = '暂停背景';
      } catch (_) {
        if (current === generation) toggle.textContent = '播放背景';
      }
    };
    const clicked = () => {
      pausedByUser = !video.paused;
      playRequested = !pausedByUser;
      try { sessionStorage.setItem('kd-background-paused', String(pausedByUser)); } catch (_) {}
      sync();
    };
    const preferenceChanged = () => { playRequested = false; sync(); };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme'] });
    toggle.addEventListener('click', clicked);
    reduced.addEventListener('change', preferenceChanged);
    mobile.addEventListener('change', preferenceChanged);
    connection?.addEventListener('change', preferenceChanged);
    document.addEventListener('visibilitychange', sync);
    backgroundCleanup = () => {
      generation++;
      video.pause();
      observer.disconnect();
      toggle.removeEventListener('click', clicked);
      reduced.removeEventListener('change', preferenceChanged);
      mobile.removeEventListener('change', preferenceChanged);
      connection?.removeEventListener('change', preferenceChanged);
      document.removeEventListener('visibilitychange', sync);
      backgroundCleanup = null;
    };
    sync();
  }

  let carouselCleanup;
  function prepareCarousel() {
    if (carouselCleanup) carouselCleanup();
    const root = document.querySelector('.kd-vela');
    if (!root) return;
    const phrases = [...root.querySelectorAll('.kd-vela__phrase')];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let index = 0, timer;
    const show = value => {
      index = value;
      root.dataset.scene = String(index);
      phrases.forEach((phrase, i) => phrase.classList.toggle('is-current', i === index));
    };
    const sync = () => {
      clearInterval(timer);
      root.dataset.photoPaused = String(document.hidden || reduced.matches);
      if (reduced.matches) show(1);
      else if (!document.hidden) timer = setInterval(() => {
        show((index + 1) % phrases.length);
      }, 3500);
    };
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    carouselCleanup = () => {
      clearInterval(timer);
      reduced.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      carouselCleanup = null;
    };
    sync();
  }

  function prepareMobileToc() {
    const button = document.querySelector(".kd-mobile-toc-open");
    const dialog = document.querySelector(".kd-mobile-toc");
    if (!button?.hidden || typeof dialog?.showModal !== "function") return;

    const sections = [...dialog.querySelectorAll('a[href^="#"]')]
      .map(link => ({ link, heading: document.getElementById(link.getAttribute("href").slice(1)) }))
      .filter(section => section.heading);
    if (!sections.length) return;

    button.hidden = false;
    button.addEventListener("click", () => {
      const scrollPadding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const readingLine = scrollPadding + 26;
      let current;
      for (const { link, heading } of sections) {
        link.removeAttribute("aria-current");
        if (heading.getBoundingClientRect().top <= readingLine) current = link;
      }
      current?.setAttribute("aria-current", "location");
      dialog.showModal();
      current?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
    dialog.addEventListener("click", (event) => {
      // Closing the sheet lets the original link update the URL and scroll normally.
      if (event.target.closest('a[href^="#"]') &&
          !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        dialog.close();
      } else if (event.target === dialog && event.clientY < dialog.getBoundingClientRect().top) {
        dialog.close();
      }
    });
  }

  function enhancePage() {
    window.kdMotion?.prepare();
    prepareMobileToc();
    prepareCarousel();
    prepareBackground();
    prepareFilm();
    prepareErrorSearch();
    document.querySelectorAll(".md-content .md-typeset img").forEach(prepareArticleImage);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enhancePage, { once: true });
  else enhancePage();
  // Material emits on its initial page and after optional instant navigation.
  if (typeof document$ !== "undefined") document$.subscribe(() => {
    if (viewer?.open) viewer.close();
    enhancePage();
  });
})();
