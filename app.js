// 导航名称和电视剧页面文案可在这里修改。
const categories = ["首页", "电视剧", "电影", "Vlog", "时刻"];
const homeRecommendations = ["cycling-hainan-ep01", "golden-rooster-39", "qun-xing-shan-yao-shi", "jianlai"];
const televisionCopy = {
  featuredTitle: "精选剧集",
  featuredSubtitle: "光影之间，遇见不同人生",
  timelineTitle: "每一步都算数",
  timelineSubtitle: "按拍摄时间",
};
const get = (id) => document.getElementById(id);
const dataUrl = new URL("data/works.json?v=7", document.baseURI);
const home = get("home");
const detail = get("detail");
const carousel = get("carousel");
let works = [];
let timeline = [];
const timelineYears = new Map();
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

const imageObserver = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const img = entry.target;
    img.src = img.dataset.src;
    delete img.dataset.src;
    imageObserver.unobserve(img);
  }
}, { rootMargin: "900px" }) : null;

function artwork(path, lazy = false, priority = false) {
  const img = el("img", "artwork");
  img.addEventListener("load", () => {
    if (img.naturalWidth > 0) img.classList.add("is-loaded");
  }, { once: true });
  img.alt = "";
  // The observer controls when requests start. Avoid a second native lazy delay.
  img.loading = lazy && !imageObserver ? "lazy" : "eager";
  img.decoding = "async";
  if (priority) img.fetchPriority = "high";
  if (path) {
    const original = new URL(path, dataUrl);
    if (original.origin === location.origin && decodeURIComponent(original.pathname).includes("/images/电影/")) {
      original.searchParams.set("v", "2");
    }
    img.addEventListener("error", () => {
      imageObserver?.unobserve(img);
      img.remove();
    }, { once: true });
    if (lazy && imageObserver) {
      img.dataset.src = original.href;
      imageObserver.observe(img);
    } else img.src = original.href;
  }
  return img;
}

function badge(label) {
  const tone = label === "VIP" ? " vip" : label === "热播中" ? " hot" : "";
  return el("span", "badge" + tone, label);
}

function coverLabel(work) {
  return work.type === "Vlog" ? work.releaseDate : work.episodeInfo;
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
  caption.append(el("span", "hero-meta", [work.type, coverLabel(work)].filter(Boolean).join(" · ")));
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
  const label = coverLabel(work);
  if (label) cover.append(el("span", "episode", label));
  card.append(cover, el("h2", "", work.title), el("p", "", [work.role ? "饰 " + work.role : "", work.subtitle].filter(Boolean).join(" · ")));
  return card;
}

function renderFeaturedWorks(visible, movie) {
  const panel = el("section", "television-extras");
  panel.id = "television-extras";
  const heading = el("div", "section-title");
  heading.append(el("h2", "", movie ? "待映电影" : televisionCopy.featuredTitle));
  if (!movie) heading.append(el("span", "muted", televisionCopy.featuredSubtitle));
  const rail = el("div", "poster-rail");
  const picks = movie ? visible.filter(work => work.badge === "待映").slice(0, 3) : visible
    .filter(work => Number(work.rating) > 0 && Number(work.rating) <= 10)
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 8);
  picks.forEach((work, index) => {
    const card = el("a", "portrait-card");
    card.href = workRoute(work);
    const image = el("div", "portrait-image");
    image.append(artwork(work.poster, true));
    if (work.badge) image.append(badge(work.badge));
    if (work.rating) image.append(el("span", "rating", work.rating));
    card.append(image, el("h3", "", work.title), el("p", "", work.role ? "饰 " + work.role : work.subtitle));
    rail.append(card);
  });
  panel.append(heading, rail);
  carousel.after(panel);
}

function renderTimeline(visible, category) {
  const movie = category === "电影";
  const entries = timeline.filter(item => (item.type || "电视剧") === category);
  if (!entries.length) return;
  const history = el("section", "timeline-section");
  history.id = "television-timeline";
  const title = el("div", "section-title");
  title.append(el("h2", "", movie ? "百年影人进行时" : televisionCopy.timelineTitle),
    el("span", "muted", televisionCopy.timelineSubtitle + " · 共 " + entries.length + " 部"));
  const years = [...new Set(entries.map(item => item.year))].sort((a, b) => Number(b) - Number(a));
  let selectedYear = timelineYears.get(category);
  if (!years.includes(selectedYear)) selectedYear = years[0];
  const tabs = el("div", "year-tabs");
  tabs.setAttribute("aria-label", "选择拍摄年份");
  const content = el("div", "year-content");
  content.setAttribute("aria-live", "polite");
  function renderYear() {
    [...tabs.children].forEach(button => button.setAttribute("aria-pressed", String(button.textContent === selectedYear)));
    const items = entries.filter(item => item.year === selectedYear);
    const label = el("div", "year-label");
    label.append(el("strong", "", selectedYear), el("span", "", items.length + " 部作品"));
    const list = el("div", "year-works");
    items.forEach(item => {
      const work = visible.find(work => work.title === item.title);
      const row = el(work ? "a" : "div", "year-work");
      if (work) row.href = workRoute(work);
      row.append(el("strong", "", item.title));
      if (item.role) row.append(el("span", "", "饰 " + item.role));
      if (work) row.append(el("span", "year-arrow", "查看作品 ↗"));
      list.append(row);
    });
    content.replaceChildren(label, list);
  }
  years.forEach(year => {
    const button = el("button", "", year);
    button.type = "button";
    button.addEventListener("click", () => { selectedYear = year; timelineYears.set(category, year); renderYear(); });
    tabs.append(button);
  });
  renderYear();
  history.append(title, tabs, content);
  home.append(history);
}

function renderHomeSections(recommendations) {
  const featuredIds = new Set(recommendations.map(work => work.id));
  const sections = [["推荐", recommendations], ...categories.slice(1).map(category => {
    const all = works.filter(work => work.type === category);
    const remaining = all.filter(work => !featuredIds.has(work.id));
    return [category, (remaining.length ? remaining : all).slice(0, 4)];
  })];
  get("home-sections").replaceChildren(...sections.map(([category, items], index) => {
    const section = el("section", "home-section");
    const heading = el("div", "section-title home-section-title");
    const title = el(index === 0 ? "h1" : "h2", "", category);
    title.id = "home-section-title-" + index;
    section.setAttribute("aria-labelledby", title.id);
    heading.append(title);
    if (index !== 0) {
      const more = el("a", "section-more", "点击查看更多 »");
      more.href = homeRoute(category);
      more.setAttribute("aria-label", "点击查看更多" + category);
      heading.append(more);
    }
    const grid = el("div", "grid");
    grid.append(...(items.length ? items.map(makeCard) : [el("p", "empty-results", "暂未收录作品。")]));
    section.append(heading, grid);
    return section;
  }));
}

function showHome(category, query = "") {
  imageObserver?.disconnect();
  get("television-extras")?.remove();
  get("television-timeline")?.remove();
  home.classList.toggle("television-page", category === "电视剧");
  detail.replaceChildren();
  detail.hidden = true;
  home.hidden = false;
  const normalize = (value) => {
    const text = value.normalize("NFKC").toLowerCase();
    return text.replace(/[\s·・\-—]/g, "") || text;
  };
  const visible = query ? works.filter((work) => [work.title, work.heroTitle]
    .some((title) => title && normalize(title).includes(normalize(query))))
    : category === "首页" ? works : works.filter((work) => work.type === category);
  const overview = !query && category === "首页";
  const nextFeatured = query ? [] : overview
    ? homeRecommendations.map(id => works.find(work => work.id === id)).filter(Boolean)
    : visible.slice(0, 4);
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
  get("home-sections").hidden = !overview;
  get("work-list").hidden = overview;
  if (overview) {
    renderHomeSections(nextFeatured);
    get("grid").replaceChildren();
    return;
  }
  get("home-sections").replaceChildren();
  if (!query && ["电视剧", "电影"].includes(category)) {
    renderFeaturedWorks(visible, category === "电影");
    renderTimeline(visible, category);
  }
  get("list-title").textContent = query ? "搜索结果：「" + query + "」"
    : category === "首页" ? "全部作品" : category === "电视剧" ? "全部剧集" : category;
  get("work-count").textContent = visible.length + (category === "Vlog" && !query ? " 个" : " 部");
  const groupedVlog = category === "Vlog" && !query;
  get("grid").classList.toggle("vlog-groups", groupedVlog);
  if (groupedVlog && visible.length) {
    const groups = new Map();
    for (const work of visible) {
      const name = work.genre || "其他";
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(work);
    }
    get("grid").replaceChildren(...[...groups].map(([name, items]) => {
      const section = el("section", "vlog-group");
      const heading = el("div", "section-title");
      heading.append(el("h2", "", name), el("span", "muted", items.length + " 个"));
      const cards = el("div", "grid");
      cards.append(...items.map(makeCard));
      section.append(heading, cards);
      return section;
    }));
    return;
  }
  get("grid").replaceChildren(...(visible.length ? visible.map(makeCard) : [
    el("p", "empty-results", query ? "没有找到匹配的作品，试试其他关键词。" : "这个分类暂时还没有作品。")
  ]));
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

function renderPlayback(work, compact = false) {
  const sources = work.playSources || [];
  const embeds = [];
  const bvid = [work.bvid, ...sources.map(source => source.bvid ||
    (source.platform === "B站" && source.link?.match(/BV[A-Za-z0-9]{10}/)?.[0]))]
    .find(id => /^BV[A-Za-z0-9]{10}$/.test(id || ""));
  if (bvid) embeds.push({ platform: "B站", url: "https://player.bilibili.com/player.html?bvid=" + bvid + "&autoplay=0" });
  for (const source of sources) {
    try {
      const url = new URL(source.link);
      if (/(^|\.)weibo\.com$/.test(url.hostname)) {
        const fid = url.searchParams.get("fid") || url.pathname.match(/\/show\/(1034:\d+)\/?$/)?.[1];
        if (/^1034:\d+$/.test(fid || "")) embeds.push({
          platform: "微博", url: "https://video.weibo.com/show?fid=" + encodeURIComponent(fid)
        });
      }
      if (url.hostname === "v.qq.com" || url.hostname.endsWith(".v.qq.com")) {
        const vid = url.searchParams.get("vid") || url.pathname.match(/\/([a-zA-Z0-9]{11})\.html$/)?.[1];
        if (vid && /^[a-zA-Z0-9]{11}$/.test(vid)) embeds.push({
          platform: source.platform, url: "https://v.qq.com/txp/iframe/player.html?vid=" + vid + "&autoplay=false"
        });
      }
    } catch { /* Invalid sources are omitted from the player. */ }
  }
  const playback = el("section", "playback");
  if (!compact) playback.append(el("h2", "", "在线观看"));
  if (embeds.length) {
    const iframe = el("iframe", "player");
    iframe.allowFullscreen = true;
    iframe.allow = "fullscreen; picture-in-picture; encrypted-media";
    const buttons = el("div", "player-tabs");
    function selectEmbed(index) {
      iframe.classList.toggle("player-weibo", embeds[index].platform === "微博");
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
    playback.append(iframe);
    if (embeds.length > 1) playback.append(buttons);
    playback.append(el("p", "muted", "如播放器无法加载，可通过下方片源链接观看。"));
    selectEmbed(0);
  } else if (compact) {
    const poster = el("div", "player player-placeholder");
    poster.append(artwork(work.cover), el("span", "", "请通过下方片源观看"));
    playback.append(poster);
  }
  return embeds.length || compact ? playback : null;
}

function renderSources(sources, heading = "可播放片源") {
  const section = el("section", "sources");
  const rows = sources.map(externalSource).filter(Boolean);
  section.append(el("h2", "", heading));
  if (rows.length) {
    const list = el("ul");
    list.append(...rows);
    section.append(list);
  } else section.append(el("p", "muted", "暂无外部片源。"));
  return section;
}

function showVlog(work) {
  const episodes = Array.isArray(work.episodes) && work.episodes.length ? work.episodes
    : [{ title: work.subtitle || work.title, playSources: work.playSources || [], bvid: work.bvid }];
  const screen = el("div", "vlog-screen");
  const panel = el("section", "vlog-panel");
  const tabs = el("div", "episode-tabs");
  const current = el("p", "current-episode");
  const links = el("div");
  tabs.setAttribute("role", "group");
  tabs.setAttribute("aria-label", "选择期数");
  function select(index) {
    const episode = episodes[index];
    const title = episode.title || "第 " + (index + 1) + " 期";
    screen.replaceChildren(renderPlayback({ ...episode, title: work.title + " · " + title, cover: work.cover }, true));
    current.textContent = title;
    [...tabs.children].forEach((tab, i) => tab.setAttribute("aria-pressed", String(i === index)));
    links.replaceChildren(renderSources(episode.playSources || [], "本期播放链接"));
  }
  episodes.forEach((episode, index) => {
    const button = el("button", "", "第 " + (index + 1) + " 期");
    button.type = "button";
    button.title = episode.title || "";
    button.addEventListener("click", () => select(index));
    tabs.append(button);
  });
  panel.append(el("p", "vlog-label", [work.genre || "Vlog", work.year].filter(Boolean).join(" · ")),
    el("h1", "", work.title), tabs, current, links);
  detail.append(screen, panel);
  select(0);
}

function showDetail(work) {
  imageObserver?.disconnect();
  home.hidden = true;
  detail.hidden = false;
  const vlog = work.type === "Vlog";
  detail.classList.toggle("vlog-view", vlog);
  const back = el("a", "back", "← 返回作品");
  back.href = returnPoint?.route || (vlog ? homeRoute("Vlog") : "#home");
  back.addEventListener("click", (event) => {
    if (!returnPoint || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.back();
  });
  detail.replaceChildren(back);
  if (vlog) {
    showVlog(work);
    back.focus({ preventScroll: true });
    return;
  }
  const playback = renderPlayback(work);

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
  const synopsis = el("section", "synopsis");
  synopsis.append(el("h2", "", "简介"), el("p", "description", work.description || "暂无简介。"));
  detail.append(info);
  if (playback) detail.append(playback);
  detail.append(renderSources(work.playSources || []), synopsis);
  back.focus({ preventScroll: true });
}

function route() {
  const hash = location.hash || "#home";
  const [page, encoded = ""] = hash.slice(1).split("/");
  let value;
  try { value = decodeURIComponent(encoded); } catch { value = ""; }
  const work = page === "work" && works.find((item) => item.id === value);
  const category = page === "category" && categories.includes(value) ? value : "首页";
  const query = page === "search" ? value.trim() : "";
  const activeRoute = work ? returnPoint?.route || homeRoute(work.type === "Vlog" ? "Vlog" : "首页")
    : query ? hash : homeRoute(category);
  if (!work) get("search-title").value = query;
  for (const link of get("categories").children) {
    if (link.hash === activeRoute) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (work) {
    showDetail(work);
    document.title = work.title + " · 吴磊作品集";
    window.scrollTo(0, 0);
  } else {
    showHome(category, query);
    document.title = "吴磊 · 作品集";
    if (restoring && returnPoint?.route === activeRoute) {
      [...home.querySelectorAll("a")].find((link) => link.hash === returnPoint.work)?.focus({ preventScroll: true });
      window.scrollTo(0, returnPoint.scroll);
    } else {
      window.scrollTo(0, 0);
      if (query) get("list-title").focus({ preventScroll: true });
    }
    returnPoint = undefined;
  }
  restoring = Boolean(work);
}

get("work-search").addEventListener("submit", (event) => {
  event.preventDefault();
  const query = get("search-title").value.trim();
  location.hash = query ? "#search/" + encodeURIComponent(query) : "#home";
});

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
    const timelineResponse = await fetch(new URL("timeline.json?v=2", dataUrl));
    if (timelineResponse.ok) timeline = await timelineResponse.json();
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
