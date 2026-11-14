const categories = ["首页", "电视剧", "电影", "Vlog", "杂志", "商务"];
const get = (id) => document.getElementById(id);
const dataUrl = new URL("data/works.json", document.baseURI);
const home = get("home");
const detail = get("detail");
const carousel = get("carousel");
let works = [];
let featured = [];
let slideIndex = 0;
let returnPoint;
let restoring = false;

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function homeRoute(category = "首页") {
  return category === "首页" ? "#home" : "#category/" + encodeURIComponent(category);
}

function workRoute(work) {
  return "#work/" + encodeURIComponent(work.id);
}

function artwork(path, lazy = false) {
  const img = el("img");
  img.alt = "";
  if (lazy) img.loading = "lazy";
  if (path) img.src = new URL(path, dataUrl);
  img.addEventListener("error", () => img.remove(), { once: true });
  return img;
}

function badge(label) {
  const tone = label === "VIP" ? " vip" : label === "热播中" ? " hot" : "";
  return el("span", "badge" + tone, label);
}

function renderSlide() {
  const work = featured[slideIndex];
  carousel.hidden = !work;
  if (!work) return;
  const link = el("a", "hero-link");
  link.href = workRoute(work);
  link.append(artwork(work.cover || work.poster));
  if (work.badge) link.append(badge(work.badge));
  const caption = el("span", "hero-caption");
  caption.append(el("span", "hero-meta", [work.type, work.episodeInfo].filter(Boolean).join(" · ")));
  caption.append(el("strong", "hero-title", work.heroTitle || work.title));
  if (work.subtitle) caption.append(el("span", "hero-subtitle", work.subtitle));
  link.append(caption);
  get("slide").replaceChildren(link);
  [...get("dots").children].forEach((dot, index) => {
    if (index === slideIndex) dot.setAttribute("aria-current", "true");
    else dot.removeAttribute("aria-current");
  });
}

function changeSlide(index) {
  if (featured.length < 2) return;
  slideIndex = (index + featured.length) % featured.length;
  renderSlide();
}

function makeCard(work) {
  const card = el("a", "card");
  card.href = workRoute(work);
  const cover = el("span", "card-cover");
  cover.append(artwork(work.cover || work.poster, true));
  if (work.badge) cover.append(badge(work.badge));
  if (work.episodeInfo) cover.append(el("span", "episode", work.episodeInfo));
  card.append(cover, el("h2", "", work.title), el("p", "", work.subtitle));
  return card;
}

function showHome(category) {
  detail.replaceChildren();
  detail.hidden = true;
  home.hidden = false;
  const visible = category === "首页" ? works : works.filter((work) => work.type === category);
  const nextFeatured = visible.slice(0, 4);
  if (nextFeatured.map((item) => item.id).join() !== featured.map((item) => item.id).join()) slideIndex = 0;
  featured = nextFeatured;
  get("dots").replaceChildren(...featured.map((work, index) => {
    const dot = el("button");
    dot.type = "button";
    dot.setAttribute("aria-label", "切换至 " + work.title);
    dot.addEventListener("click", () => changeSlide(index));
    return dot;
  }));
  document.querySelector(".hero-controls").hidden = featured.length < 2;
  get("dots").hidden = featured.length < 2;
  renderSlide();
  get("list-title").textContent = category === "首页" ? "全部作品" : category;
  get("work-count").textContent = visible.length + " 部";
  get("grid").replaceChildren(...(visible.length ? visible.map(makeCard) : [el("p", "muted", "这个分类暂时还没有作品。")]));
}

function externalSource(source) {
  try {
    const url = new URL(source.link);
    if (!["https:", "http:"].includes(url.protocol) || !source.platform) return null;
    const row = el("li");
    const link = el("a");
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const icon = el("span", "source-icon", "▶");
    icon.setAttribute("aria-hidden", "true");
    link.append(icon, el("span", "", source.platform), el("span", "source-arrow", "前往观看 ↗"));
    row.append(link);
    return row;
  } catch {
    return null;
  }
}

function showDetail(work) {
  home.hidden = true;
  detail.hidden = false;
  const back = el("a", "back", "← 返回作品");
  back.href = returnPoint?.route || "#home";
  back.addEventListener("click", (event) => {
    if (!returnPoint) return;
    event.preventDefault();
    history.back();
  });
  detail.replaceChildren(back);
  const sources = work.playSources || [];
  const bvid = [work.bvid, ...sources.map((source) => source.bvid)]
    .find((id) => /^BV[A-Za-z0-9]{10}$/.test(id || ""));
  if (bvid) {
    const iframe = el("iframe", "player");
    iframe.title = work.title + " · B站播放器";
    iframe.src = "//player.bilibili.com/player.html?bvid=" + bvid + "&autoplay=0";
    iframe.allowFullscreen = true;
    detail.append(iframe);
  }
  if (work.localVideo) {
    const video = el("video", "player");
    video.src = new URL(work.localVideo, dataUrl);
    video.poster = new URL(work.cover || work.poster, dataUrl);
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("aria-label", work.title);
    detail.append(video);
  }

  const info = el("div", "detail-info");
  const poster = el("div", "poster");
  poster.append(artwork(work.poster));
  const copy = el("div");
  const title = el("h1", "", work.title);
  title.tabIndex = -1;
  copy.append(title, el("p", "muted", [work.year, work.type, work.duration].filter(Boolean).join(" · ")));
  copy.append(el("h2", "", "简介"), el("p", "description", work.description || "暂无简介。"));
  info.append(poster, copy);
  const section = el("section", "sources");
  const rows = sources.map(externalSource).filter(Boolean);
  section.append(el("h2", "", "可播放片源"));
  if (rows.length) {
    const list = el("ul");
    list.append(...rows);
    section.append(list);
  } else section.append(el("p", "muted", "暂无外部片源。"));
  detail.append(info, section);
  back.focus({ preventScroll: true });
}

function route() {
  const hash = location.hash || "#home";
  const [page, encoded = ""] = hash.slice(1).split("/");
  let value;
  try { value = decodeURIComponent(encoded); } catch { value = ""; }
  const work = page === "work" && works.find((item) => item.id === value);
  const category = page === "category" && categories.includes(value) ? value : "首页";
  const activeRoute = work ? returnPoint?.route || "#home" : homeRoute(category);
  for (const link of get("categories").children) {
    if (link.hash === activeRoute) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (work) {
    showDetail(work);
    document.title = work.title + " · 吴磊作品集";
    window.scrollTo(0, 0);
  } else {
    showHome(category);
    document.title = "吴磊 · 作品集";
    if (restoring && returnPoint?.route === activeRoute) {
      [...home.querySelectorAll("a")].find((link) => link.hash === returnPoint.work)?.focus({ preventScroll: true });
      window.scrollTo(0, returnPoint.scroll);
    } else {
      window.scrollTo(0, 0);
    }
    returnPoint = undefined;
  }
  restoring = Boolean(work);
}

get("prev").addEventListener("click", () => changeSlide(slideIndex - 1));
get("next").addEventListener("click", () => changeSlide(slideIndex + 1));
carousel.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const onSlide = get("slide").contains(document.activeElement);
  changeSlide(slideIndex + (event.key === "ArrowLeft" ? -1 : 1));
  if (onSlide) get("slide").querySelector("a")?.focus();
});

let touchStart;
let suppressClick = false;
carousel.addEventListener("touchstart", (event) => {
  touchStart = event.touches.length === 1 ? event.touches[0] : null;
  suppressClick = false;
}, { passive: true });
carousel.addEventListener("touchend", (event) => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.clientX;
  const dy = touch.clientY - touchStart.clientY;
  touchStart = null;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
    suppressClick = true;
    changeSlide(slideIndex + (dx < 0 ? 1 : -1));
  }
}, { passive: true });
carousel.addEventListener("touchcancel", () => { touchStart = null; });
carousel.addEventListener("click", (event) => {
  if (suppressClick && event.detail && event.target.closest(".hero-link")) {
    event.preventDefault();
    event.stopPropagation();
  }
  suppressClick = false;
}, true);
home.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#work/"]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  returnPoint = { route: location.hash || "#home", scroll: window.scrollY, work: link.hash };
});

async function init() {
  for (const category of categories) {
    const link = el("a", "", category);
    link.href = homeRoute(category);
    get("categories").append(link);
  }
  try {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error("HTTP " + response.status);
    works = await response.json();
    if (!Array.isArray(works)) throw new Error("作品数据需要是数组");
    get("status").hidden = true;
    history.scrollRestoration = "manual";
    window.addEventListener("hashchange", route);
    route();
  } catch (error) {
    console.error(error);
    get("status").hidden = false;
    get("status").textContent = location.protocol === "file:"
      ? "请通过本地 HTTP 服务器打开页面，以便读取作品数据。"
      : "作品数据载入失败，请检查 data/works.json 后刷新页面。";
  }
}

init();
