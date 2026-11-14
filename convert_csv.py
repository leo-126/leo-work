"""Convert an Excel UTF-8 CSV export into data/works.json."""
import argparse
import csv
import io
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
REQUIRED = (
    "id", "title", "type", "year", "poster", "subtitle", "badge", "episodeInfo",
    "platform1", "link1", "platform2", "link2", "description",
)
FIELDS = REQUIRED[:8] + ("description",)
OPTIONAL = ("duration", "cover", "heroTitle", "region", "genre", "episodes", "releaseDate", "episodeDuration")
BVID = re.compile(r"(?<![A-Za-z0-9])BV[A-Za-z0-9]{10}(?![A-Za-z0-9])")


def extract_bvid(link):
    url = urlsplit(link)
    host = url.hostname or ""
    if host == "b23.tv" or host == "bilibili.com" or host.endswith(".bilibili.com"):
        match = BVID.search(unquote(url.path + "?" + url.query))
        if match:
            return match.group()


def convert(input_path):
    works = []
    ids = set()
    raw = input_path.read_bytes()
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        content = raw.decode("gb18030")
    with io.StringIO(content, newline="") as source:
        reader = csv.DictReader(source)
        reader.fieldnames = [name.strip() for name in (reader.fieldnames or [])]
        missing = [name for name in ("id", "title", "poster") if name not in reader.fieldnames]
        if missing:
            raise ValueError("缺少 CSV 表头：" + ", ".join(missing))
        slots = sorted(
            int(match.group(1))
            for name in reader.fieldnames
            if (match := re.fullmatch(r"platform([1-9][0-9]*)", name))
        )

        for row in reader:
            if None in row:
                raise ValueError(f"第 {reader.line_num} 行列数超出表头，请检查引号和逗号。")
            values = {key: (value or "").strip() for key, value in row.items()}
            if not any(values.values()):
                continue
            work = {key: values.get(key, "") for key in FIELDS}
            if not work["id"] or not work["title"] or work["id"] in ids:
                raise ValueError(f"第 {reader.line_num} 行需要唯一的 id 和非空 title。")
            ids.add(work["id"])
            work.update({key: values[key] for key in OPTIONAL if values.get(key)})
            for source, target in {"首播": "releaseDate", "单集片长": "episodeDuration", "角色": "role", "豆瓣评分": "rating"}.items():
                if values.get(source) and values[source] != "/":
                    work[target] = values[source]
            for key in ("cover", "poster"):
                path = work.get(key, "")
                if path and "/" not in path and "\\" not in path:
                    folder = ROOT / "images" / "电视剧"
                    candidate = folder / path
                    if not candidate.exists() and "在暴雪时分" in path:
                        candidate = folder / path.replace("在暴雪时分", "在暴雪十分")
                    work[key] = "../images/电视剧/" + candidate.name if candidate.exists() else "../images/" + path
            sources = []
            for slot in slots:
                platform = values.get(f"platform{slot}")
                link = values.get(f"link{slot}")
                if not platform or not link:
                    continue
                match = re.search(r"https?://[^\s<>]+", link)
                if not match:
                    continue
                link = match.group().rstrip("，。；）】~")
                entry = {"platform": platform, "link": link}
                bvid = extract_bvid(link)
                if bvid:
                    entry["bvid"] = bvid
                    work.setdefault("bvid", bvid)
                sources.append(entry)
            work["playSources"] = sources
            works.append(work)
    return works


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", type=Path, default=ROOT / "works.csv")
    parser.add_argument("--television", action="store_true", help="更新电视剧并从时间历程.csv生成时间历程，保留其他分类")
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "works.json")
    args = parser.parse_args()
    try:
        works = convert(args.input)
        if args.television:
            existing = json.loads(args.output.read_text(encoding="utf-8")) if args.output.exists() else []
            works = [item for item in existing if item.get("type") != "电视剧"] + works
            timeline_path = ROOT / "时间历程.csv"
            raw = timeline_path.read_bytes()
            try:
                content = raw.decode("utf-8-sig")
            except UnicodeDecodeError:
                content = raw.decode("gb18030")
            timeline = [
                {"title": row["title"].strip(), "year": row["year"].strip(), "role": (row.get("角色") or "").strip(), "link": (row.get("链接") or "").strip()}
                for row in csv.DictReader(io.StringIO(content))
                if (row.get("title") or "").strip()
            ]
            args.output.parent.mkdir(parents=True, exist_ok=True)
            (args.output.parent / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=2), encoding="utf-8")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(works, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, ValueError, csv.Error) as error:
        parser.exit(1, f"转换失败：{error}\n")
    print(f"已生成 {args.output}（{len(works)} 条作品）")


if __name__ == "__main__":
    main()
