# Editing Guide for Volunteers

You can update the whole website from your web browser on **GitHub.com**. There's nothing to install. All the words, events, donors and photos live in simple text files in the **`data`** folder.

---

## The basics: editing a file on GitHub.com

1. Open the website's repository on GitHub.com and click the **`data`** folder.
2. Click the file you want, for example `events.json`.
3. Click the **pencil icon ✏️** ("Edit this file") at the top right.
4. Make your change.
5. Click **Commit changes…**, write a short note (e.g. "Add PorchFest date"), and click **Commit changes** again.
6. GitHub publishes the change within a minute or two. Then just reload the page to see it.

Every file starts with a `"_help"` line explaining what it's for.

### The rules of these files (JSON)

These files use a format called JSON. It's strict, so follow these rules:

| ✅ Do | ❌ Don't |
|---|---|
| Use straight quotes `"like this"` | Use curly quotes `“like this”` (Word and Google Docs add these) |
| Put a **comma** between items: `},` then `{` | Leave a comma after the **last** item in a list |
| Change only the text to the **right** of the colon | Change the field names on the left (`"title":`) |
| Write `true` / `false` and numbers without quotes | Write `$12,500`. Write `12500` instead |

**Check your edit before committing:** copy the whole file into **https://jsonlint.com** and click "Validate JSON". If it says "Valid JSON", you're good. If it shows an error, it tells you the line number.

If you make a mistake, the site **doesn't break**. Only that one section shows "temporarily unavailable" until it's fixed. You can always undo a change in the file's **History** on GitHub.

---

## Add or change an event (`data/events.json`)

The schedule currently comes from the **"Year of celebration Rev B"** planning sheet and is **tentative**. When a new revision comes out, update the events here and change the `"notice"` text at the top of the file (for example, "planning sheet Rev C, March 2027"). Keep the public file free of internal notes and committee members' names.

Copy an existing event block, from `{` to `}`, paste it after a comma, and change it:

```json
{
  "id": "porchfest",
  "title": "PorchFest",
  "category": "community",
  "start": "2029-06-09T12:00",
  "end": "2029-06-09T17:00",
  "dateTBD": false,
  "dateLabel": "",
  "location": "Front porches across Bedford",
  "description": "Live music from front porches across town.",
  "image": "assets/images/originals/events/porchfest.jpg",
  "imageAlt": "Musicians playing on a white porch",
  "featured": false,
  "link": ""
},
```

- **id**: a short name with no spaces (used in links like `#events/porchfest`). Must be unique.
- **category**: `"main"` (Kickoff in September 2028 and the Finale in September 2029), `"community"` (Year of Celebration events), or `"ongoing"` (leading-up and year-round projects such as the magazine or trading cards; these need no date).
- **status**: `"planned"`, or `"proposed"` for ideas still being decided. Proposed events show a dashed "Proposed" badge. Change to `"planned"` once confirmed.
- **host** (optional): who is organizing it, shown as "Hosted by …". Only list organizations or people who have agreed to be named.
- **start / end**: `"YYYY-MM-DDTHH:MM"` in 24-hour Bedford time (`"2029-06-09T12:00"` = noon). For all-day events, use only the date: `"2029-03-17"`.
- **dateTBD**: `true` while the date isn't confirmed. The site then shows `dateLabel` (e.g. "Spring 2029 – date TBA") and hides "Add to calendar". Change it to `false` once the date is set.
- **tentativeDate** (optional): `true` together with `"dateTBD": true` when the planned **day** is known but not final (e.g. `"start": "2029-07-04"`). The event then appears on that day in the Calendar, marked "tentative". Events with only a month (`dateTBD` without `tentativeDate`) appear in the Calendar's "Date to be announced" row for that month. Once the date is confirmed, set `dateTBD` to `false` and remove `tentativeDate`; the "Add to calendar" button then appears too.
- **featured**: `true` puts this event in the Home page spotlight. Otherwise the next upcoming event is shown automatically.
- Past events move to a "Past Events" list automatically.
- Optional: add photos and videos from the event (same format as the gallery, below):
  `"photos": [ { "src": "assets/images/originals/porchfest-2029/photo1.jpg", "alt": "Band on a porch" } ],`
  `"videos": [ { "url": "https://youtu.be/abc123def45", "title": "PorchFest highlights" } ],`

---

## Upload photos

1. Go to **`assets/images/originals/`** on GitHub.com and open (or create) a folder, e.g. `porchfest-2029`.
   - To create a folder: click **Add file → Create new file** and type `porchfest-2029/readme.txt`. The slash creates the folder. Commit it.
2. Click **Add file → Upload files** and drag in your photos **straight from your phone or camera**. There's no need to resize them.
3. Click **Commit changes**.
4. Within a few minutes, a robot (the "Optimize images" GitHub Action) automatically:
   - makes small, fast versions of each photo for phones and computers,
   - **removes hidden location (GPS) data** from the photos,
   - updates the list of photos (`data/image-manifest.json`, which you should never edit).

   You can watch it run under the **Actions** tab. Until it finishes, the site shows the original photo.
5. Use the photo's path, e.g. `assets/images/originals/porchfest-2029/IMG_1234.jpg`, in `events.json` or `gallery.json`.

**Tips**
- Use simple file names without spaces if you can (`porchfest-band.jpg`).
- **Get permission** before posting photos where people (especially children) can be recognized, and don't put children's names in captions.
- **To change the big Home page photo:** upload a new photo named exactly **`hero.jpg`** into `assets/images/originals/site/`, replacing the old one.

### Write good alt text

Every photo needs `"alt"` text: a short description read aloud to people who can't see the image.

- ✅ `"alt": "Two girls in tricorn hats waving small flags at the Bedford Day parade"`
- ❌ `"alt": "photo"` or `"alt": "IMG_1234"`
- Keep it to one sentence, describe what matters, and don't start with "Image of…".

---

## Add a photo album or YouTube video (`data/gallery.json`)

Each album looks like this:

```json
{
  "id": "porchfest-2029",
  "title": "PorchFest 2029",
  "date": "2029-06-09",
  "event": "porchfest",
  "cover": "assets/images/originals/porchfest-2029/band.jpg",
  "description": "Music on porches all over town.",
  "photos": [
    { "src": "assets/images/originals/porchfest-2029/band.jpg", "alt": "Jazz trio on a white porch", "caption": "The Great Road Trio", "credit": "Jane Smith" }
  ],
  "videos": [
    { "url": "https://www.youtube.com/watch?v=abc123def45", "title": "PorchFest highlights" }
  ]
}
```

- **Videos:** paste **any** YouTube link: `youtube.com/watch?v=…`, `youtu.be/…` or `youtube.com/shorts/…`. The site shows a preview and only loads the video when someone presses play, which keeps the site fast.
- **`featuredVideo`** at the top of the file is the video shown on the Home page.
- ⚠️ The file currently holds **TEST** albums. Replace them with real ones before launch.

---

## Add a donor (`data/donors.json`)

```json
{ "name": "The Smith Family", "tier": "gold" },
{ "name": "Bedford Hardware", "tier": "silver", "type": "business" },
{ "name": "Anonymous", "tier": "platinum", "anonymous": true },
{ "name": "Jane Doe", "tier": "buccaneer", "inHonorOf": "John Doe" },
```

- **tier**: `platinum`, `gold`, `silver` or `buccaneer`. Tier names, order and threshold text can be changed in the `"tiers"` list at the top.
- ⚠️ **Never put dollar amounts in this file.** Anyone on the internet can open it.
- `"anonymous": true` shows the donor as "Anonymous Friend".

---

## Sponsors and partners (`data/sponsors.json`)

- **partners** are shown at the top of the Support Us page (Cultural Council, Historical Society, Job Lane Farm).
- **sponsors** have a `"type"`: `business`, `organization`, `host` or `community`.
- Optional logo: upload it to `assets/images/originals/logos/` and set `"logo": "assets/images/originals/logos/name.png"`.
- A contact person's name only appears if `"showContact": true`. Set this **only with their permission**.

---

## Upload a legal document (`data/legal.json`)

1. Upload the PDF to **`assets/legal/`** (Add file → Upload files). Use a simple name like `bylaws-2028.pdf`.
2. In `legal.json`, set `"file": "assets/legal/bylaws-2028.pdf"` and `"available": true`, and add the date (`"2028-10-01"`).

---

## Links, poll, email and other settings (`data/site.json`)

| Field | What it is |
|---|---|
| `pollFormUrl` | The Google Form poll. In Google Forms: **Send → `< >` (embed)**, then copy only the `https://docs.google.com/forms/…viewform?embedded=true` address. |
| `donateUrl` | Where every **Donate** button goes. |
| `townGiftDonateUrl` | Donate button in the Town Gift section. |
| `volunteerFormUrl`, `sponsorFormUrl`, `merchUrl` | Sign-up and order links. |
| `contactEmail`, `mailingAddress`, `ein` | Shown in the footer and on the Legal page. |
| `celebrationDate`, `celebrationLabel` | The Home page countdown. |
| `social` | Instagram, Facebook, X and TikTok profile links. |
| `showDraftBadges` | `true` shows "Draft – awaiting verification" on unchecked history facts. Set to `false` at launch. |

## History, quiz and map

- `history.json`: facts. Set `"verified": true` once the Historical Society has checked each one.
- `quiz.json`: `"answer"` is the **number** of the correct choice, **counting from 0** (first = 0, second = 1, third = 2, fourth = 3).
- `sites.json`: map pins. To get `lat`/`lng`, right-click the spot in Google Maps and click the numbers to copy them (first number = `lat`, second = `lng`).
- `town-gift.json`: update `"raised"` (numbers only, e.g. `18250`) as donations come in.

## Button labels and menu names (`data/strings.en.json`)

All the small interface text lives here: menu names, button labels, messages. Change only the text on the right.

## Languages and translations

The language menu (🌐 in the top-right corner) offers English, Español, Français, Italiano, Português, 简体中文, 繁體中文, 日本語 and 한국어. Visitors' choice is remembered, and first-time visitors get their browser's language. A link like `…/?lang=es` opens the site directly in Spanish, which is handy for flyers.

**What is translated:** all menus, buttons and labels (`data/strings.<language>.json`), plus the tagline, mission, banner flag caption, the "Tentative Schedule" notice and the "Join the Fun" box (files in `data/i18n/<language>/`). Everything else (event details, history, quiz, donors…) shows in English, with a small note saying so.

**When you change English text that has a translation** (for example the mission in `site.json` or the notice in `events.json`), also update the same field in each language's file in `data/i18n/<language>/`. Otherwise visitors in that language keep seeing the old wording.

**To translate more content** (for example the events into Spanish):
1. Create `data/i18n/es/events.json` containing only what you translate. Keep each event's `"id"` so the site can match it:
   ```json
   { "events": [ { "id": "porchfest", "title": "PorchFest", "description": "Música en vivo desde los porches de todo el pueblo." } ] }
   ```
   Events you leave out, and fields you leave out, stay in English.
2. In `data/i18n/languages.json`, add `"events.json"` to Spanish's `"overlays"` list.

**Translation quality:** the current translations were drafted for the launch. Please have a native speaker review them before publicity, especially for languages used by many Bedford residents.
