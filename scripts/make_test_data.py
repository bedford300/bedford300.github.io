"""
DEVELOPER TOOL - creates PLACEHOLDER photos and test gallery data.

    python scripts/make_test_data.py

Generates:
  * placeholder images for the hero, events, history, town gift and merch
  * a TEST gallery of 100 photos in 5 albums + 20 placeholder YouTube videos
    (assets/images/originals/test-gallery/ and data/gallery.json)
  * one photo with fake GPS data and one with a rotation tag, to prove the
    optimizer strips location data and rotates correctly.

Delete assets/images/originals/test-gallery/ and replace data/gallery.json
with real albums before launch.
"""

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ORIG = ROOT / "assets" / "images" / "originals"
random.seed(1729)

PALETTE = [
    ((31, 45, 74), (122, 30, 38)),    # navy -> barn red
    ((46, 74, 64), (201, 162, 75)),   # pine -> gold
    ((122, 30, 38), (240, 232, 214)), # red -> cream
    ((60, 70, 82), (150, 170, 190)),  # slate -> sky
    ((24, 36, 60), (201, 162, 75)),   # deep navy -> gold
]


def font(size):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def make(path: Path, label: str, size=(1600, 1067), colors=None, exif=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    a, b = colors or random.choice(PALETTE)
    w, h = size
    grad = Image.new("RGB", (2, 2))
    grad.putdata([a, b, b, a])
    im = grad.resize(size, Image.BILINEAR)
    d = ImageDraw.Draw(im, "RGBA")
    for _ in range(6):
        x, y, r = random.randint(0, w), random.randint(0, h), random.randint(h // 10, h // 3)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, random.randint(12, 35)))
    # Clapboard lines along the bottom for a New England feel
    for i in range(8):
        yy = int(h * 0.72) + i * int(h * 0.035)
        d.line((0, yy, w, yy), fill=(255, 255, 255, 40), width=3)
    if label:
        d.text((w / 2, h / 2 - h * 0.05), label, font=font(int(h * 0.075)), fill=(255, 255, 255, 235), anchor="mm")
        d.text((w / 2, h / 2 + h * 0.06), "PLACEHOLDER PHOTO", font=font(int(h * 0.035)), fill=(255, 255, 255, 190), anchor="mm")
    else:  # hero: keep the middle clear for the headline
        d.text((w - h * 0.04, h - h * 0.04), "PLACEHOLDER PHOTO", font=font(int(h * 0.025)), fill=(255, 255, 255, 150), anchor="rs")
    kwargs = {"quality": 85}
    if exif is not None:
        kwargs["exif"] = exif
    im.save(path, "JPEG", **kwargs)
    return "assets/images/originals/" + path.relative_to(ORIG).as_posix()


def main():
    make(ORIG / "site" / "hero.jpg", "", (2400, 1350), PALETTE[0])
    make(ORIG / "site" / "og-image.jpg", "Bedford 300  1729-2029", (1200, 630), PALETTE[0])

    events = ["bedford-day", "bike-rides", "block-party", "cars-and-coffee", "fireworks", "performances", "porchfest", "scavenger-hunt"]
    for e in events:
        make(ORIG / "events" / f"{e}.jpg", e.replace("-", " ").title())

    for h in ["incorporation", "bedford-flag", "april-19", "depot", "va-hospital", "hanscom", "two-brothers", "burying-ground", "job-lane"]:
        make(ORIG / "history" / f"{h}.jpg", h.replace("-", " ").title())

    make(ORIG / "gift" / "town-gift.jpg", "Town Gift")
    make(ORIG / "merch" / "t-shirt.jpg", "Bedford 300 T-Shirt", (1200, 1200))
    make(ORIG / "merch" / "flag.jpg", "Flag + QR Code", (1200, 1200))

    # Test files for the optimizer: fake GPS + rotation tag
    gps_exif = Image.Exif()
    gps = gps_exif.get_ifd(0x8825)
    gps.update({1: "N", 2: (42.0, 29.0, 26.0), 3: "W", 4: (71.0, 16.0, 34.0)})
    rot_exif = Image.Exif()
    rot_exif[0x0112] = 6  # "rotate 90° clockwise to display"

    album_names = [
        ("kickoff-2028", "Tricentennial Kickoff", "2028-09-23"),
        ("porchfest-2029", "PorchFest", "2029-06-08"),
        ("history-walk", "Historic Sites Walk", "2028-10-14"),
        ("cars-and-coffee", "Cars & Coffee", "2029-05-04"),
        ("bedford-day-2029", "Bedford Day 2029", "2029-09-22"),
    ]
    albums = []
    vid = 1
    for ai, (aid, title, date) in enumerate(album_names):
        photos = []
        for p in range(1, 21):
            exif = gps_exif if (ai, p) == (0, 1) else rot_exif if (ai, p) == (0, 2) else None
            size = (1600, 1067) if p % 5 else (1067, 1600)  # some portrait photos
            src = make(ORIG / "test-gallery" / aid / f"photo-{p:02d}.jpg", f"{title} #{p}", size, exif=exif)
            photos.append({"src": src, "alt": f"TEST placeholder photo {p} from {title}", "caption": f"Sample caption for photo {p}", "credit": "Test data"})
        videos = []
        for _ in range(4):
            videos.append({"url": f"https://www.youtube.com/watch?v=PLACEHOLD{vid:02d}", "title": f"TEST video {vid}: {title} highlights"})
            vid += 1
        albums.append({
            "id": aid, "title": f"{title} (TEST)", "date": date, "event": aid.rsplit("-", 1)[0] if aid[-1].isdigit() else aid,
            "cover": photos[0]["src"], "coverAlt": photos[0]["alt"],
            "description": "TEST album with placeholder photos. Replace before launch.",
            "photos": photos, "videos": videos,
        })

    gallery = {
        "_help": (
            "Photo albums and YouTube videos for the 'Photos & Videos' page. "
            "To add an album, copy one { ... } block inside \"albums\" and change it. "
            "Upload photos to assets/images/originals/<album-folder>/ and put that path in \"src\". "
            "Every photo needs \"alt\" text (a short description for people who can't see it). "
            "For videos, paste ANY YouTube link into \"url\". "
            "\"featuredVideo\" is shown on the Home page. "
            "THIS FILE CURRENTLY CONTAINS TEST DATA - replace before launch."
        ),
        "_test": True,
        "featuredVideo": albums[0]["videos"][0],
        "albums": albums,
    }
    (ROOT / "data" / "gallery.json").write_text(json.dumps(gallery, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Test images and data/gallery.json created.")


if __name__ == "__main__":
    main()
