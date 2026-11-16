// Run node import_movies.mjs after editing 电影.csv or 时间历程.csv.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const file = name => new URL(name, import.meta.url);
function readCsv(name) {
  const bytes = readFileSync(file(name));
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { text = new TextDecoder("gb18030", { fatal: true }).decode(bytes); }
  const rows = [];
  let row = [], value = "", quoted = false;
  for (const [, token] of text.matchAll(/("(?:[^"]|"")*"|,|\r?\n|[^",\r\n]+)/g)) {
    if (token.startsWith('"')) {
      quoted = true;
      value += token.slice(1, -1).replace(/""/g, '"');
    } else if (token === "," || token.endsWith("\n")) {
      row.push(value.trim());
      value = "";
      quoted = false;
      if (token !== ",") { if (row.some(Boolean)) rows.push(row); row = []; }
    } else value += token;
  }
  if (row.length || value || quoted) rows.push([...row, value.trim()]);
  return rows;
}

const [header, ...rows] = readCsv("电影.csv");
assert.equal(header.slice(0, 5).join(","), "id,title,type,year,首播");
const picture = name => {
  if (!name) return "";
  const available = [name, name.replace(/\.(jpe?g|png)$/i, ".webp")]
    .find(value => existsSync(file("images/电影/" + encodeURIComponent(value))));
  assert(available, "缺少电影图片：" + name);
  return "../images/电影/" + available;
};
const worksFile = file("data/works.json");
const existing = JSON.parse(readFileSync(worksFile));
const movies = rows.filter(([, title, type]) => title && type === "电影").map(row => {
  const [csvId, title, type, year, releaseDate, region, genre, duration, rating, role, description,
    cover, poster, subtitle, badge, ...sources] = row;
  const previous = existing.find(work => work.type === type && work.title === title);
  const playSources = [];
  for (let i = 0; i < sources.length; i += 2) {
    const [platform, link] = sources.slice(i, i + 2);
    if (platform && /^https?:\/\/\S+$/.test(link || "")) playSources.push({ platform, link });
  }
  return { id: previous?.id || csvId || "movie-" + title, title, type, year, releaseDate,
    region: region.replace(/^\?\s*/, ""), genre, duration, rating, role, description,
    cover: picture(cover), poster: picture(poster), subtitle, badge, playSources };
});
assert(movies.length, "没有电影数据");
const works = existing.filter(work => work.type !== "电影");
const oldIndex = existing.findIndex(work => work.type === "电影");
works.splice(oldIndex < 0 ? works.length : oldIndex, 0, ...movies);
assert.equal(new Set(works.map(work => work.id)).size, works.length, "作品 ID 重复");

const [timelineHeader, ...timelineRows] = readCsv("时间历程.csv");
assert.equal(timelineHeader.slice(0, 4).join(","), "title,type,year,角色");
const movieTimeline = timelineRows.filter(([title, type, year]) => title && type === "电影" && /^\d{4}$/.test(year))
  .map(([title, type, year, role, link = ""]) => ({ title, type, year, role, link }));
assert(movieTimeline.length, "没有电影时间轨迹");
const timelineFile = file("data/timeline.json");
const timeline = JSON.parse(readFileSync(timelineFile)).filter(item => item.type !== "电影");
for (const [target, data] of [[worksFile, works], [timelineFile, [...timeline, ...movieTimeline]]]) {
  writeFileSync(target, JSON.stringify(data, null, 2) + "\n");
}
console.log("已导入 " + movies.length + " 部电影、" + movieTimeline.length + " 条电影时间轨迹");
