"""Generate smaller WebP siblings for website images. Originals are retained."""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent


def main():
    before = after = count = 0
    for path in (ROOT / "images").rglob("*"):
        if path.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        with Image.open(path) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
            output = path.with_suffix(".webp")
            image.save(output, "WEBP", quality=82, method=6)
        before += path.stat().st_size
        after += output.stat().st_size
        count += 1
    print(f"{count} images: {before:,} -> {after:,} bytes ({1-after/before:.1%} smaller)")


if __name__ == "__main__":
    main()
