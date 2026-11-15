const diaryEndpoint = "https://api.github.com/repos/leo-126/leo-work/issues?state=all";
let diaryRequest;

function diaryUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    return null;
  }
  return null;
}

function diaryLink(url, label, className = "") {
  const link = el("a", className, label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function renderDiaryBody(body) {
  const content = el("div", "diary-body");
  const tokens = /!\[([^\]\n]*)\]\(<?(https?:\/\/[^\s)>]+)>?(?:\s+"[^"\n]*")?\)|<img\b[^>]*>|https?:\/\/[^\s<>"`]+/gi;
  let offset = 0;
  for (const match of body.matchAll(tokens)) {
    content.append(body.slice(offset, match.index));
    const token = match[0];
    offset = match.index + token.length;

    // GitHub uploads can use either Markdown or an HTML img tag.
    if (match[2] || /^<img\b/i.test(token)) {
      const template = document.createElement("template");
      if (!match[2]) template.innerHTML = token;
      const original = template.content.querySelector("img");
      const url = diaryUrl(match[2] || original?.getAttribute("src"));
      if (url) {
        const img = el("img", "diary-image");
        img.alt = match[1] || original?.getAttribute("alt") || "日记配图";
        img.loading = "lazy";
        img.decoding = "async";
        img.src = url;
        content.append(img);
      } else {
        content.append(token);
      }
      continue;
    }

    let label = token.replace(/[.,!?;:，。！？；：、）】》]+$/u, "");
    while (label.endsWith(")") && label.split(")").length > label.split("(").length) {
      label = label.slice(0, -1);
    }
    const url = diaryUrl(label);
    if (url) content.append(diaryLink(url, label), token.slice(label.length));
    else content.append(token);
  }
  content.append(body.slice(offset));
  return content;
}

function renderDiaryEntry(issue) {
  const item = el("li", "diary-entry");
  const date = el("time", "diary-date", issue.created_at.slice(0, 10));
  date.dateTime = issue.created_at;
  const card = el("article", "diary-card");
  card.append(el("h2", "", issue.title), renderDiaryBody(issue.body || ""));
  const original = diaryUrl(issue.html_url);
  if (original) {
    const footer = el("footer", "diary-footer");
    footer.append(diaryLink(original, "在 GitHub 查看原贴", "diary-original"));
    card.append(footer);
  }
  item.append(date, card);
  return item;
}

async function fetchDiaryIssues() {
  const issues = [];
  for (let page = 1; ; page++) {
    const response = await fetch(diaryEndpoint + "&per_page=100&sort=created&direction=desc&page=" + page, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("GitHub Issues HTTP " + response.status);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error("Invalid GitHub Issues response");
    issues.push(...batch.filter(issue => !issue.pull_request));
    if (batch.length < 100 || !/rel="next"/i.test(response.headers.get("link") || "")) return issues;
  }
}

function loadDiary() {
  if (diaryRequest) return diaryRequest;
  const status = get("diary-status");
  status.hidden = false;
  status.textContent = "正在载入日记…";
  diaryRequest = fetchDiaryIssues().then(issues => {
    get("diary-entries").replaceChildren(...issues.map(renderDiaryEntry));
    status.hidden = issues.length > 0;
    status.textContent = issues.length ? "" : "暂无日记。";
  }).catch(() => {
    status.textContent = "日记加载失败，请稍后再试";
    diaryRequest = undefined;
  });
  return diaryRequest;
}
