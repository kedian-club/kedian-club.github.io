(() => {
  "use strict";

  const forum = document.querySelector("[data-forum]");
  if (!forum) return;
  const find = selector => forum.querySelector(selector);
  const filters = Array.from(forum.querySelectorAll(".kd-forum-filters a"));
  const list = find("[data-post-list]");
  const replies = find("[data-replies]");
  const composer = find("[data-composer]");
  const form = find("[data-post-form]");
  const replyForm = find("[data-reply-form]");
  const replyInput = replyForm.querySelector("textarea");
  const compose = find("[data-compose]");
  const key = "kedian.community.";
  const params = new URLSearchParams(location.search);
  const active = filters.find(link => link.dataset.category === params.get("category")) || filters[0];
  const category = active.dataset.category || "";
  const number = Number(params.get("post")) || 0;
  const guestbook = Number(forum.dataset.welcomePost);
  const api = location.origin === "https://kedian-club.github.io" ? forum.dataset.api.replace(/\/$/, "") : "";
  const dateFormat = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" });
  const tips = [
    "可以写写你想实现什么、卡在哪里、试过哪些办法。",
    "可以说明你想做什么、需要怎样的队友。",
    "可以聊聊作品怎么做出来的，或者分享最近的一点进展。",
    "可以附上页面地址，说说你遇到了什么问题。",
  ];

  const read = name => sessionStorage.getItem(key + name);
  const write = (name, value) => sessionStorage.setItem(key + name, value);
  const remove = name => sessionStorage.removeItem(key + name);

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function notice(text) {
    const line = find("[data-notice]");
    line.textContent = text;
    line.hidden = !text;
  }

  async function request(path, body) {
    const headers = { Accept: "application/json" };
    const token = read("session");
    if (body) headers["Content-Type"] = "application/json";
    if (body && token) headers.Authorization = "Bearer " + token;
    const result = await fetch(api + path, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(18000),
    });
    const data = await result.json();
    if (!result.ok) {
      const error = new Error(data.error || "暂时无法连接，请稍后重试。");
      error.status = result.status;
      throw error;
    }
    return data;
  }

  function updateAccount() {
    const account = read("account");
    const signout = find("[data-signout]");
    signout.hidden = !api || !account;
    if (account) signout.textContent = "退出 " + account;
  }

  function signout() {
    remove("session");
    remove("account");
    updateAccount();
  }

  function showComposer() {
    const draft = read("post-draft");
    if (draft) {
      const saved = JSON.parse(draft);
      form.elements.category.value = saved.category;
      form.elements.title.value = saved.title;
      form.elements.body.value = saved.body;
    } else if (category) {
      form.elements.category.value = category;
    }
    updateWritingTip();
    if (!composer.open) composer.showModal();
  }

  function updateWritingTip() {
    find("[data-writing-tip]").textContent = tips[form.elements.category.selectedIndex] || "";
  }

  function postPath(id) {
    const search = new URLSearchParams({ post: id });
    if (category) search.set("category", category);
    return "?" + search;
  }

  function boardPath() {
    return category ? "?category=" + encodeURIComponent(category) : "?";
  }

  function meta(parts) {
    return element("div", parts.filter(Boolean).join("　"), "kd-forum-meta");
  }

  function date(value) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? dateFormat.format(timestamp) : "";
  }

  function postRow(post) {
    const row = element("a", "", "kd-forum-row");
    row.href = post.number === guestbook ? forum.dataset.guestbook : postPath(post.number);
    row.append(element("strong", post.title));
    const summary = post.bodyText.replace(/\s+/g, " ").trim();
    if (summary) row.append(element("span", summary.slice(0, 100) + (summary.length > 100 ? "…" : "")));
    row.append(meta([post.category.name, post.author?.login, date(post.createdAt),
      post.replyCount.totalCount + " 条回复", post.isAnswered && "已解决"]));
    return row;
  }

  // Rebuild visible Markdown elements from GitHub's HTML. Discard styles, scriptable
  // elements and event handlers before adding any content to the current document.
  const allowed = new Set("p div span blockquote pre code ul ol li h1 h2 h3 h4 h5 h6 strong b em i s del br hr table thead tbody tr th td a img details summary kbd sup sub".split(" "));
  function bodyHtml(html) {
    const source = document.createElement("template");
    source.innerHTML = html || "";
    const output = element("div", "", "kd-forum-content");
    function copy(parent, from) {
      for (const child of from.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          parent.append(document.createTextNode(child.textContent));
          continue;
        }
        if (child.namespaceURI !== "http://www.w3.org/1999/xhtml" || !allowed.has(child.localName)) continue;
        const node = element(child.localName);
        if (node.localName === "a") {
          try {
            const link = new URL(child.getAttribute("href") || "#", "https://github.com");
            if (["https:", "http:"].includes(link.protocol) && !link.username && !link.password) {
              node.href = link.href;
              node.rel = "noopener noreferrer";
              node.target = "_blank";
            }
          } catch {
            // Leave invalid links as plain text.
          }
        }
        if (node.localName === "img") {
          try {
            const image = new URL(child.getAttribute("src"));
            if (image.protocol !== "https:" || !["user-images.githubusercontent.com", "github.com", "camo.githubusercontent.com"].includes(image.hostname)) continue;
            node.src = image.href;
            node.alt = child.getAttribute("alt") || "";
            node.loading = "lazy";
            node.referrerPolicy = "no-referrer";
          } catch {
            continue;
          }
        }
        copy(node, child);
        parent.append(node);
      }
    }
    copy(output, source.content);
    return output;
  }

  function commentRow(comment) {
    const row = element("article", "", "kd-forum-reply");
    row.append(meta([comment.author?.login || "已注销用户", date(comment.createdAt)]), bodyHtml(comment.bodyHTML));
    for (const child of comment.replies?.nodes || []) row.append(commentRow(child));
    if (comment.replies?.totalCount > comment.replies.nodes.length) {
      row.append(meta(["更多楼内回复可在原始讨论中查看"]));
    }
    return row;
  }

  async function loadBoard(after = "") {
    if (api) {
      const query = new URLSearchParams();
      if (category) query.set("category", category);
      if (after) query.set("after", after);
      return request("/posts?" + query);
    }
    const data = await snapshot();
    return { posts: data.posts.filter(post => !category || post.category.id === category) };
  }

  async function loadPost(after = "") {
    if (api) return request("/posts/" + number + (after ? "?after=" + encodeURIComponent(after) : ""));
    const data = await snapshot();
    const post = data.posts.find(post => post.number === number);
    if (!post) throw new Error("这篇帖子暂时无法查看。");
    return post;
  }

  async function snapshot() {
    const result = await fetch(forum.dataset.snapshot);
    if (!result.ok) throw new Error("帖子暂时无法加载，请稍后刷新。");
    return result.json();
  }

  function paginate(button, initialPage, load, render) {
    let page = initialPage;
    button.hidden = !page?.hasNextPage;
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const result = await load(page.endCursor);
        page = render(result);
        button.hidden = !page?.hasNextPage;
      } catch (error) {
        notice(error.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  async function drawBoard() {
    find("[data-board]").hidden = false;
    filters.forEach(link => link.removeAttribute("aria-current"));
    active.setAttribute("aria-current", "page");
    find("[data-description-line]").textContent = active.dataset.description || "刚入门，或者正好卡在一个问题上？来交流区聊聊。";
    const data = await loadBoard();
    list.replaceChildren(...data.posts.map(postRow));
    if (!data.posts.length) {
      const empty = element("div", "", "kd-forum-empty");
      empty.append(element("p", "这个分类还没有帖子。你可以先分享手头的进展，或者问一个具体的问题。"));
      const first = element("button", "写第一帖", "kd-forum-link");
      first.type = "button";
      first.addEventListener("click", showComposer);
      empty.append(first);
      list.append(empty);
    }
    paginate(find("[data-more]"), data.pageInfo, loadBoard, result => {
      list.append(...result.posts.map(postRow));
      return result.pageInfo;
    });
  }

  async function drawPost() {
    find("[data-post]").hidden = false;
    find("[data-back]").href = boardPath();
    replyForm.hidden = true;
    const post = await loadPost();
    const item = find("[data-post-body]");
    const heading = element("h2", post.title);
    heading.id = "kd-forum-post-title";
    item.replaceChildren(heading, meta([post.category.name, post.author?.login, date(post.createdAt),
      post.isAnswered && "已解决"]), bodyHtml(post.bodyHTML));
    replies.replaceChildren(...post.comments.nodes.map(commentRow));
    if (!post.comments.nodes.length) replies.append(element("p", "还没有回复。", "kd-forum-description"));
    replyForm.hidden = !api || post.locked;
    if (post.locked) replies.append(element("p", "这篇帖子已关闭回复。", "kd-forum-description"));
    if (!api && number === guestbook) {
      const link = element("a", "去站内留言板回复");
      link.href = forum.dataset.guestbook;
      replies.append(link);
    }
    paginate(find("[data-more-replies]"), api && post.comments.pageInfo, loadPost, result => {
      replies.append(...result.comments.nodes.map(commentRow));
      return result.comments.pageInfo;
    });
  }

  async function startLogin(reason) {
    const config = await request("/config");
    if (!config.clientId || config.callback !== location.origin + location.pathname) {
      throw new Error("登录服务暂未开放，请稍后再试。");
    }
    const hex = length => Array.from(crypto.getRandomValues(new Uint8Array(length)),
      byte => byte.toString(16).padStart(2, "0")).join("");
    const verifier = hex(32);
    const state = hex(24);
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    write("oauth", JSON.stringify({ state, verifier, reason, path: location.search, created: Date.now() }));
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: config.clientId, redirect_uri: config.callback, state,
      code_challenge: challenge, code_challenge_method: "S256",
    });
    location.assign(url);
  }

  async function finishLogin() {
    if (!params.has("code") && !params.has("error")) return;
    const saved = read("oauth");
    remove("oauth");
    const auth = saved && JSON.parse(saved);
    history.replaceState(null, "", location.pathname + (auth?.path || ""));
    if (!auth || auth.state !== params.get("state") || Date.now() - auth.created > 600000) {
      notice("登录链接已失效，请重新登录。");
      return;
    }
    if (params.has("error")) {
      write("login-status", "GitHub 登录未完成，输入的草稿还在。");
    } else {
      const data = await request("/auth/exchange", { code: params.get("code"), verifier: auth.verifier });
      write("session", data.session);
      write("account", data.account);
      updateAccount();
      write("login-status", "已登录。确认内容后即可发布。");
    }
    // Route from the restored URL without losing the draft if the page was a thread.
    write("resume", auth.reason);
    location.reload();
  }

  async function publish(path, input, reason) {
    if (!api) throw new Error("草稿已存在当前标签页。站内发布将在服务开通后可用。");
    if (read("session")) {
      try {
        return await request(path, input);
      } catch (error) {
        if (error.status !== 401) throw error;
        signout();
      }
    }
    await startLogin(reason);
  }

  function bindForm(target, handler, showError) {
    target.addEventListener("submit", async event => {
      event.preventDefault();
      const button = target.querySelector("[type=submit]");
      if (button.disabled) return;
      button.disabled = true;
      try {
        await handler();
      } catch (error) {
        showError(error.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  const composeStatus = find("[data-compose-status]");
  const savePost = () => write("post-draft", JSON.stringify(Object.fromEntries(new FormData(form))));
  compose.hidden = false;
  compose.addEventListener("click", showComposer);
  find("[data-close]").addEventListener("click", () => composer.close());
  find("[data-signout]").addEventListener("click", signout);
  form.addEventListener("input", savePost);
  form.elements.category.addEventListener("change", () => { updateWritingTip(); savePost(); });
  const replyKey = "reply-" + number;
  replyInput.value = read(replyKey) || "";
  replyInput.addEventListener("input", () => write(replyKey, replyInput.value));
  if (!api) {
    composeStatus.textContent = "可以试写并保留草稿。站内发布尚未开通。";
    form.querySelector("[type=submit]").textContent = "保存草稿";
  }
  bindForm(form, async () => {
    const input = Object.fromEntries(new FormData(form));
    savePost();
    if (!api) {
      composeStatus.textContent = "草稿已保留。可以关闭表单，稍后回来继续写。";
      return;
    }
    composeStatus.textContent = "正在处理…";
    const result = await publish("/posts", input, "post");
    if (result) {
      remove("post-draft");
      location.assign(postPath(result.number));
    }
  }, message => { composeStatus.textContent = message; });
  bindForm(replyForm, async () => {
    const input = { body: replyInput.value };
    write(replyKey, input.body);
    const result = await publish("/posts/" + number + "/replies", input, "reply");
    if (result) {
      remove(replyKey);
      location.reload();
    }
  }, notice);

  async function initialize() {
    const resume = read("resume");
    remove("resume");
    updateAccount();
    const loginStatus = read("login-status");
    remove("login-status");
    if (loginStatus && resume === "post") composeStatus.textContent = loginStatus;
    else if (loginStatus) notice(loginStatus);
    if (api) await finishLogin();
    if (number) await drawPost();
    else await drawBoard();
    if (resume === "post") showComposer();
    if (resume === "reply" && !replyForm.hidden) replyInput.focus();
  }
  initialize().catch(error => {
    notice(error.message || "暂时无法加载帖子，请稍后刷新。");
  });
})();
