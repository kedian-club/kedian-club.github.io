/* SPDX-License-Identifier: MIT
 * Original club-site motion enhancements. See motion.LICENSE.txt.
 * No animation library or paid component is required.
 */
(() => {
  "use strict";
  if (window.kdMotion) return;

  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let transition;
  let activeProfile;
  let filmCleanup;

  // Keep the theme reveal and shared profile elements out of each other's snapshots.
  async function changeView(kind, update, before, ready) {
    if (transition) {
      transition.skipTransition();
      await transition.finished.catch(() => {});
    }
    if (!document.startViewTransition || reduced.matches || document.hidden) {
      update();
      return;
    }
    root.dataset.kdMotion = kind;
    before?.();
    let current;
    let updated = false;
    try {
      current = document.startViewTransition(() => { updated = true; update(); });
      transition = current;
      await current.ready.then(() => ready?.()).catch(() => {});
      await current.finished.catch(() => {});
    } catch (_) {
      // A failed visual transition must not prevent the requested action.
      if (!updated) update();
    } finally {
      if (transition === current) {
        transition = undefined;
        delete root.dataset.kdMotion;
      }
    }
  }

  let themeBound = false;
  let themePending = false;
  let paletteClick = false;
  function prepareTheme() {
    if (themeBound) return;
    themeBound = true;
    async function selectPalette(input, anchor) {
      if (!input || themePending) return;
      const update = () => {
        // Use Material's own input handling, including persistence and OS preference.
        paletteClick = true;
        try { input.click(); } finally { paletteClick = false; }
      };
      const box = anchor.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      themePending = true;
      try {
        await changeView("theme", update, null, () => {
          root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, {
            duration: 420, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both",
            pseudoElement: "::view-transition-new(root)"
          });
        });
      } finally { themePending = false; }
    }
    document.addEventListener("click", event => {
      if (paletteClick || event.button !== 0 || event.defaultPrevented) return;
      const label = event.target.closest('[data-md-component="palette"] label[for]');
      if (!label) return;
      event.preventDefault();
      selectPalette(document.getElementById(label.htmlFor), label);
    });
    document.addEventListener("keydown", event => {
      const input = event.target.closest('[data-md-component="palette"] input');
      if (!input || ![" ", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const form = input.closest("form");
      const inputs = [...form.querySelectorAll('input[name="__palette"]')];
      const backwards = ["ArrowLeft", "ArrowUp"].includes(event.key);
      const next = inputs[(inputs.indexOf(input) + (backwards ? -1 : 1) + inputs.length) % inputs.length];
      const label = [...form.querySelectorAll("label")].find(item => item.getClientRects().length);
      selectPalette(next, label || form);
    });
  }

  function sharedElements(container, isDialog) {
    return [
      [container, "kd-profile-card"],
      [container.querySelector(".kd-author-avatar, .kd-contributor-placeholder"), "kd-profile-avatar"],
      [container.querySelector(isDialog ? ".kd-profile-name" : "summary strong"), "kd-profile-name"],
      [isDialog && container.querySelector(".kd-profile-details"), "kd-profile-details"],
      [isDialog && container.querySelector(".kd-profile-kicker"), "kd-profile-kicker"],
      [isDialog && container.querySelector(".kd-profile-id"), "kd-profile-id"],
      [isDialog && container.querySelector(".kd-profile-close"), "kd-profile-close"]
    ].filter(([element]) => element);
  }
  function nameElements(elements, enabled) {
    elements.forEach(([element, name]) => {
      if (enabled) element.style.viewTransitionName = name;
      else element.style.removeProperty("view-transition-name");
    });
  }

  function prepareProfiles() {
    if (typeof HTMLDialogElement === "undefined" || !HTMLDialogElement.prototype.showModal) return;
    if (activeProfile && !activeProfile.summary.isConnected) activeProfile.dispose();
    document.querySelectorAll(".kd-contributor-grid .kd-contributor-profile").forEach(details => {
      const summary = details.querySelector("summary");
      const content = details.querySelector(".kd-profile-content");
      if (!summary || !content || summary.dataset.kdProfileReady) return;
      summary.dataset.kdProfileReady = "true";
      summary.setAttribute("aria-haspopup", "dialog");
      summary.addEventListener("click", event => {
        event.preventDefault();
        if (activeProfile) return;
        const card = summary.closest(".kd-contributor-card");
        const dialog = document.createElement("dialog");
        dialog.className = "kd-contributor-dialog";
        const body = content.cloneNode(true);
        const title = body.querySelector(".kd-profile-name");
        title.id = "kd-profile-dialog-title";
        dialog.setAttribute("aria-labelledby", title.id);
        const extra = document.createElement("div");
        extra.className = "kd-profile-details";
        [...body.children].filter(child => !child.classList.contains("kd-profile-heading"))
          .forEach(child => extra.append(child));
        body.append(extra);
        const close = document.createElement("button");
        close.className = "kd-profile-close";
        close.type = "button";
        close.setAttribute("aria-label", "关闭个人名片");
        close.textContent = "×";
        dialog.append(close, body);
        const source = sharedElements(card, false);
        const destination = sharedElements(dialog, true);
        let closing = false;
        let disposed = false;
        function dispose() {
          if (disposed) return;
          disposed = true;
          nameElements(source, false);
          nameElements(destination, false);
          card.classList.remove("kd-profile-origin-hidden");
          root.classList.remove("kd-profile-open");
          dialog.remove();
          activeProfile = undefined;
          if (summary.isConnected) summary.focus({ preventScroll: true });
        }
        activeProfile = { summary, dispose };
        const opened = changeView("profile", () => {
          if (disposed) return;
          nameElements(source, false);
          document.body.append(dialog);
          root.classList.add("kd-profile-open");
          dialog.showModal();
          card.classList.add("kd-profile-origin-hidden");
          nameElements(destination, true);
        }, () => nameElements(source, true)).finally(() => {
          nameElements(source, false);
          nameElements(destination, false);
        });
        async function dismiss() {
          if (closing || disposed) return;
          closing = true;
          await opened;
          if (disposed) return;
          dialog.dataset.closing = "true";
          try {
            await changeView("profile", () => {
              nameElements(destination, false);
              dialog.close();
              root.classList.remove("kd-profile-open");
              card.classList.remove("kd-profile-origin-hidden");
              nameElements(source, true);
            }, () => nameElements(destination, true));
          } finally { dispose(); }
        }
        close.addEventListener("click", dismiss);
        dialog.addEventListener("cancel", event => { event.preventDefault(); dismiss(); });
        dialog.addEventListener("close", () => { if (!closing) dispose(); });
        dialog.addEventListener("click", event => {
          if (event.target !== dialog) return;
          const box = dialog.getBoundingClientRect();
          if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dismiss();
        });
      });
    });
  }

  function prepareFilmTilt() {
    filmCleanup?.();
    const player = document.querySelector(".kd-film__player");
    const video = player?.querySelector("video");
    const play = player?.querySelector(".kd-film__play");
    if (!player || !video || !play) return;
    const pointer = matchMedia("(hover: hover) and (pointer: fine)");
    const controller = new AbortController();
    const options = { signal: controller.signal };
    let frame = 0;
    let box;
    let x = 0, y = 0;
    const eligible = () => pointer.matches && !reduced.matches && !play.hidden && !video.controls;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      box = null;
      player.classList.remove("kd-film--tilting");
      player.style.removeProperty("--kd-tilt-x");
      player.style.removeProperty("--kd-tilt-y");
    };
    player.addEventListener("pointermove", event => {
      if (event.pointerType !== "mouse" || !eligible()) { reset(); return; }
      box ||= player.getBoundingClientRect();
      x = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
      y = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        player.classList.add("kd-film--tilting");
        player.style.setProperty("--kd-tilt-x", `${(-y * 3).toFixed(2)}deg`);
        player.style.setProperty("--kd-tilt-y", `${(x * 3).toFixed(2)}deg`);
      });
    }, options);
    ["pointerleave", "pointercancel", "pointerdown", "focusin"].forEach(type => player.addEventListener(type, reset, options));
    ["play", "playing", "error"].forEach(type => video.addEventListener(type, reset, options));
    pointer.addEventListener("change", reset, options);
    reduced.addEventListener("change", reset, options);
    window.addEventListener("resize", reset, options);
    window.addEventListener("scroll", () => { box = null; }, { ...options, passive: true });
    document.addEventListener("visibilitychange", reset, options);
    filmCleanup = () => { controller.abort(); reset(); };
  }

  reduced.addEventListener("change", () => transition?.skipTransition());
  window.kdMotion = { prepare() { prepareTheme(); prepareProfiles(); prepareFilmTilt(); } };
})();
