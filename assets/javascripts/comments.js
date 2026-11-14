(() => {
  "use strict";

  const origin = "https://giscus.app";
  let current;
  let cleanup;

  function prepareComments() {
    const section = document.querySelector("[data-kd-comments]");
    if (section === current) return;
    cleanup?.();
    cleanup = undefined;
    current = section;
    if (!section) return;

    const slot = section.querySelector(".giscus");
    const status = section.querySelector("[data-kd-comment-status]");
    const discussionLink = section.querySelector("[data-kd-discussion-link]");

    const controller = new AbortController();
    const listenerOptions = { signal: controller.signal };
    const getTheme = () => document.body.dataset.mdColorScheme === "slate" ? "transparent_dark" : "noborder_light";
    const getFrame = () => slot.querySelector("iframe.giscus-frame");
    const syncTheme = () => {
      getFrame()?.contentWindow?.postMessage({ giscus: { setConfig: { theme: getTheme() } } }, origin);
    };

    let proximity;
    let scheme;
    let script;
    let backlink;
    let timer;
    let loaded = false;
    let failed = false;

    function showStatus(message, showLink = false) {
      status.textContent = message;
      status.hidden = !message;
      discussionLink.hidden = !showLink;
    }

    function handleMessage(event) {
      if (event.origin !== origin || event.source !== getFrame()?.contentWindow) return;
      const data = event.data?.giscus;
      if (!data || typeof data !== "object") return;

      const discussionUrl = data.discussion?.url;
      const prefix = `https://github.com/${section.dataset.repo}/discussions/`;
      if (typeof discussionUrl === "string" && discussionUrl.startsWith(prefix) && /^\d+$/.test(discussionUrl.slice(prefix.length))) {
        discussionLink.href = discussionUrl;
      }

      // An empty article can still accept its first comment and create a discussion.
      if (typeof data.error === "string" && !(section.dataset.mapping === "specific" && data.error.includes("Discussion not found"))) {
        failed = true;
        clearTimeout(timer);
        showStatus("评论暂时无法加载。可以在 GitHub 打开讨论。", true);
      } else if (typeof data.resizeHeight === "number" && data.resizeHeight > 0) {
        clearTimeout(timer);
        if (!failed) showStatus("");
      }
    }

    function load() {
      if (loaded || !section.isConnected) return;
      loaded = true;
      proximity?.disconnect();
      showStatus("正在载入评论…");

      // Link new discussions back to the public article even when testing locally.
      if (section.dataset.backlink && !document.querySelector('meta[name="giscus:backlink"]')) {
        backlink = document.createElement("meta");
        backlink.name = "giscus:backlink";
        backlink.content = section.dataset.backlink;
        document.head.append(backlink);
      }

      window.addEventListener("message", handleMessage, listenerOptions);
      scheme = new MutationObserver(syncTheme);
      scheme.observe(document.body, { attributes: true, attributeFilter: ["data-md-color-scheme"] });

      script = document.createElement("script");
      script.src = `${origin}/client.js`;
      script.crossOrigin = "anonymous";
      script.async = true;
      Object.assign(script.dataset, {
        repo: section.dataset.repo,
        repoId: section.dataset.repoId,
        category: section.dataset.category,
        categoryId: section.dataset.categoryId,
        mapping: section.dataset.mapping,
        term: section.dataset.term,
        strict: "1",
        reactionsEnabled: "1",
        emitMetadata: "1",
        inputPosition: "bottom",
        theme: getTheme(),
        lang: "zh-CN",
      });
      script.addEventListener("load", () => {
        const frame = getFrame();
        if (!frame) return;
        frame.title = section.getAttribute("aria-label");
        frame.addEventListener("load", syncTheme, listenerOptions);
        syncTheme();
      }, listenerOptions);
      script.addEventListener("error", () => {
        clearTimeout(timer);
        showStatus("评论暂时无法加载。可以在 GitHub 打开讨论。", true);
      }, listenerOptions);
      timer = setTimeout(() => {
        showStatus("评论加载较慢。也可以在 GitHub 打开讨论。", true);
      }, 12000);
      section.append(script);
    }

    cleanup = () => {
      controller.abort();
      proximity?.disconnect();
      scheme?.disconnect();
      clearTimeout(timer);
      script?.remove();
      backlink?.remove();
      slot.replaceChildren();
    };

    // Process the sign-in return promptly even if its anchor is outside the viewport.
    if (new URLSearchParams(location.search).has("giscus") || !("IntersectionObserver" in window)) {
      load();
    } else {
      proximity = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) load();
      }, { rootMargin: "200px" });
      proximity.observe(section);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", prepareComments, { once: true });
  else prepareComments();
  if (typeof document$ !== "undefined") document$.subscribe(prepareComments);
})();
