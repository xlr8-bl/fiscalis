# Photographs the site and the carousel machine need

Everything here is a gap the code already has a hole for. Nothing on
this list is decoration: each one replaces a placeholder that is
currently either stock, generated, or missing.

Shoot on a phone. All of it. A recent phone at 12MP is more resolution
than any of these need, and a real photograph of your actual desk beats
a rented one of somebody else's.

---

## 1. You

Six pictures, one afternoon. These are the highest-value items on the
list, because they are the only ones nobody else on the internet has.

| What | Where it goes | Size | Notes |
|---|---|---|---|
| Head and shoulders, looking at the lens | The byline on every article (`.jr_byline_face`) | 800×800, square | Plain wall behind you. Not smiling for a camera; the face you make when someone has just asked you a question. |
| Same, looking away | The about panel on the home page | 1600×1200 | |
| At the desk, from behind or the side, screen visible | The about panel, and the `photo` slide device | 2000×1500, landscape | The screen can show anything real. Do not stage a fake dashboard. |
| Standing, whole body, plain background | The `figure` slide device | 2400×3600, portrait | **This is the one with rules.** See the cut-out spec below. |
| Sitting, whole body, plain background | Same | 2400×3600, portrait | |
| Talking, mid-gesture, whole body | Same | 2400×3600, portrait | Hands doing something. A flat standing pose reads as a stock photo. |

### Cut-out spec, for the three whole-body shots

The generator keys you out of the background and screens you into the
slide. That works or fails on the shoot, not on the software:

- **A wall of one colour.** Any colour, as long as it is not the colour
  of your clothes. A white wall is fine. A door is not — the frame
  becomes part of you.
- **Even light, no hard shadow on the wall.** Shade outdoors, or a
  window to one side. A shadow with an edge reads as part of your body.
- **A gap all the way round.** Do not crop your feet or your elbows.
- **No transparent or fuzzy edges.** No fine hair against a light wall,
  no gauze, no glasses reflecting the room.
- **Three metres back, zoomed in**, rather than close with a wide lens.

Upload them in the studio under **Brand kit → likeness**. The `figure`
device stays unavailable until at least one is there.

---

## 2. Scenes, for the `photo` device

Twelve to twenty. Photographs a hook can be set on top of, so what
matters is that a third of the frame is quiet enough to hold type.

Shoot what you actually see:

- A counter with a card terminal on it
- A kitchen pass, mid-service
- A menu on a table, badly lit, the way a customer sees it
- Somebody's phone in their hand on a website that is loading
- A shopfront from across the street
- A laptop open on a café table
- An empty restaurant at 7pm
- A delivery bag on a bike
- A printed price list gone soft at the corners
- A queue
- A "back in 10 minutes" sign
- Anything with a screen in it that is not yours

Rules: **landscape, at least 2000px wide**, and at least a third of the
frame has to be sky, a wall, a table, a floor — something plain. A frame
that is busy edge to edge cannot carry a sentence, and the generator
will veil it until it turns to mud.

Upload under **Brand kit → aesthetic**.

---

## 3. The work

The home page runs on 22 files in `assets/stock/` and nine video clips.
They are stock. Every one of them should eventually be a real project.

For each piece of work you can show, four things:

1. **The site on a laptop screen**, photographed, not screenshotted. A
   photograph of a screen on a real desk reads as a real project.
2. **The site on a phone**, held.
3. **A photograph of the business itself** — the shop, the kitchen, the
   van, the workshop.
4. **One before**, if you have it. A screenshot of the old site is fine
   here; it is evidence, not a picture.

2000px on the long edge, landscape. If you have three projects that is
twelve files and the whole works section stops being generic.

---

## 4. Article covers — mostly handled now

**You do not need to shoot these.** Spark sources them itself: it
searches a stock library, picks a photograph, and stores it in the site's
media with its credit. Every new post gets a real picture without you
doing anything, and `publish_article` refuses a post that has no cover.

The eleven older articles still carry covers drawn from their headlines.
Those look deliberate, which is why they shipped, but they are
typography rather than photographs. Two ways to replace one:

- Ask Spark to. It can source and set a cover on an existing post.
- Do it yourself: open the article in the studio, press **Choose** under
  Cover picture, and pick anything from the media library. One landscape
  image at **1200×630** becomes the card, the picture at the top of the
  article, and the link preview.

The three where a photograph of yours would beat a stock one, because
the subject is a real thing you can point a phone at:

- `menu-saved-as-an-image` — a menu, photographed badly, on a phone
- `what-delivery-apps-cost-you` — a delivery bag, or a stack of them
- `spreadsheet-that-runs-the-business` — a laptop with a real spreadsheet

Those three are a ten-minute job and they would be the only pictures on
the site that nobody else has.

---

## 5. What is already covered, so you do not shoot it twice

- **The logo and the icons.** Drawn from the wordmark
  (`tools/build_logo.mjs`, `tools/build_icons.mjs`). 512×512 for Search
  Console, the favicon, the home-screen icon. Nothing needed.
- **The share card** (`assets/social/og.jpg`). Generated.
- **The slide grounds.** Colour, type and halftone. No photograph
  involved unless the device asks for one.
- **The interface objects** — the phone, the map pack, the spreadsheet,
  the receipt. Drawn in code, on purpose. A photograph of a real map
  pack would date in a year.

---

## How to get them in

All of it from the phone:

1. Studio → **Brand kit** for the likeness and scene shots. Tag each one
   `likeness` (you, cut out) or `aesthetic` (a scene).
2. Studio → **Pictures** for anything used in an article.
3. The work photographs go in through **Pictures**, then get attached to
   the work entries under **Site → Work**.

Alt text on everything. It is a field on the upload, it takes five
seconds, and it is the difference between a picture Google can read and
a picture it cannot.
