// 导航名称和电视剧页面文案可在这里修改。
const categories = ["首页", "电视剧", "电影", "Vlog", "综艺", "时刻"];
const televisionCopy = {
  featuredTitle: "精选剧集",
  featuredSubtitle: "光影之间，遇见不同人生",
  timelineTitle: "百年影人进行时",
  timelineSubtitle: "按拍摄时间",
};
const get = (id) => document.getElementById(id);
const dataUrl = new URL("data/works.json", document.baseURI);
const home = get("home");
const detail = get("detail");
const carousel = get("carousel");
let works = [];
let worksLoaded = false;
let timeline = [];
let selectedYear;
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

function artwork(path, lazy = false, priority = false) {
  const img = el("img");
  img.alt = "";
  img.loading = lazy ? "lazy" : "eager";
  img.decoding = "async";
  if (priority) img.fetchPriority = "high";
  if (path) {
    const original = new URL(path, dataUrl);
    const optimized = new URL(original);
    if (optimized.origin === location.origin) optimized.pathname = optimized.pathname.replace(/\.(jpe?g|png)$/i, ".webp");
    img.src = optimized.href;
    img.addEventListener("error", () => {
      if (img.src !== original.href) img.src = original.href;
      else img.remove();
    }, { once: true });
  }
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
  link.append(artwork(work.cover || work.poster, false, true));
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
  card.append(cover, el("h2", "", work.title), el("p", "", [work.role ? "饰 " + work.role : "", work.subtitle].filter(Boolean).join(" · ")));
  return card;
}

function renderTelevision(visible) {
  const panel = el("section", "television-extras");
  panel.id = "television-extras";
  const heading = el("div", "section-title");
  heading.append(el("h2", "", televisionCopy.featuredTitle), el("span", "muted", televisionCopy.featuredSubtitle));
  const rail = el("div", "poster-rail");
  visible.slice(0, 8).forEach((work, index) => {
    const card = el("a", "portrait-card");
    card.href = workRoute(work);
    const image = el("div", "portrait-image");
    image.append(artwork(work.poster, index >= 4));
    if (work.badge) image.append(badge(work.badge));
    if (work.rating) image.append(el("span", "rating", work.rating));
    card.append(image, el("h3", "", work.title), el("p", "", work.role ? "饰 " + work.role : work.subtitle));
    rail.append(card);
  });
  panel.append(heading, rail);
  carousel.after(panel);

  const history = el("section", "timeline-section");
  history.id = "television-timeline";
  const title = el("div", "section-title");
  title.append(el("h2", "", televisionCopy.timelineTitle), el("span", "muted", televisionCopy.timelineSubtitle));
  const years = [...new Set(timeline.map(item => item.year))].sort((a, b) => Number(b) - Number(a));
  if (!years.includes(selectedYear)) selectedYear = years[0];
  const tabs = el("div", "year-tabs");
  tabs.setAttribute("aria-label", "选择拍摄年份");
  const content = el("div", "year-content");
  content.setAttribute("aria-live", "polite");
  function renderYear() {
    [...tabs.children].forEach(button => button.setAttribute("aria-pressed", String(button.textContent === selectedYear)));
    const items = timeline.filter(item => item.year === selectedYear);
    const label = el("div", "year-label");
    label.append(el("strong", "", selectedYear), el("span", "", items.length + " 部作品"));
    const list = el("div", "year-works");
    items.forEach(item => {
      const work = visible.find(work => work.title === item.title);
      const row = el(work ? "a" : "div", "year-work");
      if (work) row.href = workRoute(work);
      row.append(el("strong", "", item.title), el("span", "", "饰 " + item.role));
      if (work) row.append(el("span", "year-arrow", "查看作品 ↗"));
      list.append(row);
    });
    content.replaceChildren(label, list);
  }
  years.forEach(year => {
    const button = el("button", "", year);
    button.type = "button";
    button.addEventListener("click", () => { selectedYear = year; renderYear(); });
    tabs.append(button);
  });
  renderYear();
  history.append(title, tabs, content);
  home.append(history);
}

function showHome(category) {
  get("television-extras")?.remove();
  get("television-timeline")?.remove();
  home.classList.toggle("television-page", category === "电视剧");
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
  if (category === "电视剧") renderTelevision(visible);
  get("list-title").textContent = category === "首页" ? "全部作品" : category === "电视剧" ? "全部剧集" : category;
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
  const embeds = [];
  const bvid = [work.bvid, ...sources.map(source => source.bvid || source.link?.match(/BV[A-Za-z0-9]{10}/)?.[0])]
    .find(id => /^BV[A-Za-z0-9]{10}$/.test(id || ""));
  if (bvid) embeds.push({ platform: "B站", url: "https://player.bilibili.com/player.html?bvid=" + bvid + "&autoplay=0" });
  for (const source of sources) {
    try {
      const url = new URL(source.link);
      if (url.hostname === "v.qq.com" || url.hostname.endsWith(".v.qq.com")) {
        const vid = url.searchParams.get("vid") || url.pathname.match(/\/([a-zA-Z0-9]{11})\.html$/)?.[1];
        if (vid && /^[a-zA-Z0-9]{11}$/.test(vid)) embeds.push({
          platform: source.platform, url: "https://v.qq.com/txp/iframe/player.html?vid=" + vid + "&autoplay=false"
        });
      }
    } catch { /* Invalid sources are omitted from the player. */ }
  }
  const playback = el("section", "playback");
  if (embeds.length) {
    playback.append(el("h2", "", "在线观看"));
    const iframe = el("iframe", "player");
    iframe.allowFullscreen = true;
    iframe.allow = "fullscreen; picture-in-picture; encrypted-media";
    const buttons = el("div", "player-tabs");
    function selectEmbed(index) {
      iframe.title = work.title + " · " + embeds[index].platform;
      iframe.src = embeds[index].url;
      [...buttons.children].forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    }
    embeds.forEach((embed, index) => {
      const button = el("button", "", embed.platform);
      button.type = "button";
      button.addEventListener("click", () => selectEmbed(index));
      buttons.append(button);
    });
    playback.append(buttons, iframe, el("p", "muted", "如播放器无法加载，可通过下方片源链接观看。"));
    selectEmbed(0);
  }

  const info = el("div", "detail-info");
  const poster = el("div", "poster");
  poster.append(artwork(work.poster));
  const copy = el("div");
  const title = el("h1", "", work.title);
  title.tabIndex = -1;
  copy.append(title);
  if (work.year) copy.append(el("p", "detail-year", "(" + work.year + ")"));
  const episodes = work.episodes ? "共" + String(work.episodes).replace(/^(全|共)/, "").replace(/集$/, "") + "集" : "";
  const duration = work.episodeDuration || work.duration;
  const durationText = duration ? (work.episodes || work.episodeDuration ? "单集片长 " : "片长 ") + duration : "";
  copy.append(el("p", "detail-meta", [work.region, work.genre || work.type, work.releaseDate || work.year, episodes, durationText].filter(Boolean).join(" / ")));
  if (work.role) copy.append(el("p", "detail-role", "吴磊 饰 " + work.role));
  info.append(poster, copy);
  const section = el("section", "sources");
  const rows = sources.map(externalSource).filter(Boolean);
  section.append(el("h2", "", "可播放片源"));
  if (rows.length) {
    const list = el("ul");
    list.append(...rows);
    section.append(list);
  } else section.append(el("p", "muted", "暂无外部片源。"));
  const synopsis = el("section", "synopsis");
  synopsis.append(el("h2", "", "简介"), el("p", "description", work.description || "暂无简介。"));
  detail.append(info);
  if (embeds.length) detail.append(playback);
  detail.append(section, synopsis);
  back.focus({ preventScroll: true });
}

function route() {
  const hash = location.hash || "#home";
  const [page, encoded = ""] = hash.slice(1).split("/");
  let value;
  try { value = decodeURIComponent(encoded); } catch { value = ""; }
  const work = page === "work" && works.find((item) => item.id === value);
  const category = page === "category" && categories.includes(value) ? value : "首页";
  const isDiary = page === "diary";
  const activeRoute = isDiary ? "#diary" : work ? returnPoint?.route || "#home" : homeRoute(category);
  for (const link of get("categories").children) {
    if (link.hash === activeRoute) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  get("diary").hidden = !isDiary;
  get("status").hidden = isDiary || worksLoaded;
  if (isDiary) {
    home.hidden = true;
    detail.hidden = true;
    detail.replaceChildren();
    document.title = "日记 · 吴磊作品集";
    get("diary-title").focus({ preventScroll: true });
    window.scrollTo(0, 0);
    loadDiary();
  } else if (work) {
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
  const diaryLink = el("a", "", "日记");
  diaryLink.href = "#diary";
  get("categories").append(diaryLink);
  history.scrollRestoration = "manual";
  window.addEventListener("hashchange", route);
  if (location.hash === "#diary") route();
  try {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error("HTTP " + response.status);
    works = await response.json();
    if (!Array.isArray(works)) throw new Error("作品数据需要是数组");
    const timelineResponse = await fetch(new URL("timeline.json", dataUrl));
    if (timelineResponse.ok) timeline = await timelineResponse.json();
    worksLoaded = true;
    get("status").hidden = true;
    if (location.hash !== "#diary") route();
  } catch (error) {
    console.error(error);
    get("status").hidden = location.hash === "#diary";
    get("status").textContent = location.protocol === "file:"
      ? "请通过本地 HTTP 服务器打开页面，以便读取作品数据。"
      : "作品数据载入失败，请检查 data/works.json 后刷新页面。";
  }
}

init();
