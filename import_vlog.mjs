// node import_vlog.mjs — only refreshes the Vlog entries in data/works.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const file = (path) => new URL(path, import.meta.url);
const bytes = readFileSync(file("vlog.csv"));
let csv;
try { csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
catch { csv = new TextDecoder("gb18030", { fatal: true }).decode(bytes); }

// Parse by column index because the CSV repeats the heading “期数”.
const rows = [];
let row = [], value = "", quoted = false;
for (let i = 0; i < csv.length; i++) {
  const ch = csv[i];
  if (ch === '"') {
    if (quoted && csv[i + 1] === '"') { value += ch; i++; }
    else quoted = !quoted;
  } else if (!quoted && (ch === "," || ch === "\n" || ch === "\r")) {
    row.push(value.trim());
    value = "";
    if (ch !== ",") {
      if (row.some(Boolean)) rows.push(row);
      row = [];
      if (ch === "\r" && csv[i + 1] === "\n") i++;
    }
  } else value += ch;
}
if (quoted) throw new Error("vlog.csv 有未闭合的引号");
if (row.length || value) rows.push([...row, value.trim()]);
const headers = rows.shift();
if (headers?.slice(0, 5).join(",") !== "title,year,首播,分类,cover") throw new Error("vlog.csv 表头有误");

const target = file("data/works.json");
const current = JSON.parse(readFileSync(target, "utf8"));
const legacyId = "cycling-hainan-ep01"; // Keep previously shared links working.
const legacy = current.find((work) => work.id === legacyId);
const extras = legacy?.episodes?.[0]?.playSources || legacy?.playSources || [];
const ids = new Set();
const entries = rows.map(([title, year, releaseDate, genre, cover, ...columns]) => {
  const id = title === "骑有此理-海南篇" ? legacyId : "vlog-" + title;
  if (!title || ids.has(id)) throw new Error("标题为空或重复：" + title);
  ids.add(id);
  if (!existsSync(file("images/vlog/" + encodeURIComponent(cover)))) throw new Error("找不到封面：" + cover);
  const episodes = [];
  for (let i = 0; i < columns.length; i += 2) {
    const [name, link] = columns.slice(i, i + 2);
    if (!link) continue;
    const url = new URL(link);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("无效片源：" + link);
    const host = url.hostname;
    const platform = /(^|\.)(bilibili\.com|b23\.tv)$/.test(host) ? "B站"
      : /(^|\.)weibo\.(com|cn)$/.test(host) ? "微博" : host;
    const playSources = [{ platform, link }];
    if (id === legacyId && i === 0) {
      playSources.push(...extras.filter((source) => source.platform !== platform));
    }
    episodes.push({ title: name || "第 " + (episodes.length + 1) + " 期", playSources });
  }
  if (!episodes.length) throw new Error("没有片源：" + title);
  return {
    id, title, type: "Vlog", year, releaseDate, genre, cover: "../images/vlog/" + cover,
    subtitle: episodes.length === 1 ? episodes[0].title : genre,
    episodeInfo: episodes.length + " 期",
    ...(id === legacyId ? { heroTitle: "骑有此理", badge: "更新" } : {}),
    episodes,
  };
});
const others = current.filter((work) => work.type !== "Vlog");
const [first, ...remaining] = entries;
if (!first) throw new Error("vlog.csv 没有作品");
// Keep the mixed home carousel while preserving CSV order on the Vlog page.
const featuredCount = 3;
const works = [first, ...others.slice(0, featuredCount), ...remaining, ...others.slice(featuredCount)];
writeFileSync(target, JSON.stringify(works, null, 2) + "\n");
console.log("已导入 " + entries.length + " 个 Vlog、" + entries.reduce((sum, work) => sum + work.episodes.length, 0) + " 期");
