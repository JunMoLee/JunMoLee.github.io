# junmolee.gatech — personal research website

A static, dependency-free site (HTML/CSS/vanilla JS) for Junmo Lee's research
identity: process → device → integration → circuit → system. No build step,
no framework — edit files directly and refresh.

## Structure

```
index.html            All page markup and section copy (hero, about, research
                       storytelling, publications, experience, education,
                       skills, awards, contact). The hero graphic and three
                       research figures are drop-in image slots — see
                       "Replacing the placeholder research figures" below.
css/style.css          The entire design system: color tokens (light + dark),
                       type scale, spacing scale, layout, components.
js/main.js             Fetches the JSON files in data/ and renders publications,
                       experience, education, skills, awards, and the link rows.
                       Also handles nav scroll state, the mobile menu, and
                       scroll-reveal animation.
data/*.json             Editable content — see "Updating content" below.
assets/cv/              The public, downloadable CV (phone-redacted — see below).
assets/icons/favicon.svg  Site favicon (original mark, not a photo/logo).
assets/images/          Empty — drop real figures/photos here (see below).
```

There is no build tool. Opening `index.html` via `file://` will NOT work
because the page `fetch()`s the JSON in `data/`, which requires a server (see
"Running locally").

## Updating content

Everything list-like is data-driven, so most updates don't touch HTML/CSS:

| To change...              | Edit...                          |
|----------------------------|-----------------------------------|
| Publications list          | `data/publications.json` (published) and `data/publications-pending.json` (under review / submitted) |
| Experience entries          | `data/experience.json` |
| Education entries           | `data/education.json` |
| Skills groups                | `data/skills.json` |
| Awards / recognition        | `data/awards.json` |
| Email, Scholar/LinkedIn/GitHub links, CV path | `data/site.json` |
| Hero copy, About copy, Research narrative & diagrams | directly in `index.html` (these are prose/storytelling, not list data, so they're hand-authored) |

Each publication in `data/publications.json` supports: `year`, `venue`,
`venueShort`, `title`, `authors` (plain text — any `"J. Lee"` or `"J. Lee*"`
substring is auto-bolded), `vol` (optional, e.g. page range), and `tags`
(array of small badges like "Nominated — ...", "Invited", "Equal contribution").

## Editing the prose text (hero / about / research narrative)

This copy lives directly in `index.html` as plain readable HTML, not in a
`data/*.json` file — the fastest way to find the exact spot to edit is to
**search for the words you see on the page**, not to hunt through the file
top to bottom:

1. Open `http://localhost:8080/` (or the live site) and select/copy the exact
   phrase you want to change — e.g. `Process-to-system co-optimization`.
2. In your editor, use **Find in Files** across the project folder (VS Code:
   `Ctrl+Shift+F` / `Cmd+Shift+F`; Notepad++: `Ctrl+Shift+F`) and paste that
   phrase in. It'll jump straight to the matching line in `index.html`.
3. Edit the text between the HTML tags, save, refresh the local preview to
   confirm, then `git add -A && git commit && git push` as usual.

Section boundaries are marked with `<!-- ===== NAME ===== -->` comments
(`HERO`, `ABOUT`, `RESEARCH`, `PUBLICATIONS`, etc.) if you want to browse
section-by-section instead.

**Two exceptions** — text that isn't visible on the page itself, so you can't
select it to search for it. Both are near the very top of `index.html`:
- The browser-tab title and search-preview text: the `<title>` tag and the
  `<meta name="description" ...>` tag.
- Image `alt` text (screen-reader-only descriptions) and `<figcaption>`
  captions on the research figures — these sit right next to each `<img>` in
  the Research section, worth updating once you drop in a real figure.

## Replacing the placeholder research figures

No real device photos, micrographs, or figures were available in the source
materials (and an early schematic I sketched from general knowledge of the
device stack turned out not to match the actual structure — not something to
guess at). So instead of inline drawings, the hero and the three Research-section
figures are **drop-in image slots**: each is a real `<img>` pointing at a
filename in `assets/images/` that doesn't exist yet, wrapped in a frame that
shows a "Figure pending" placeholder until that file shows up.

**To add a figure, no HTML/CSS editing required** — just save an image with
the exact expected filename into `assets/images/`:

| Slot | Expected filename |
|---|---|
| Hero graphic | `assets/images/hero-device-stack.jpg` |
| Research — process/device | `assets/images/fig-process-device.jpg` |
| Research — M3D integration | `assets/images/fig-m3d-integration.jpg` |
| Research — DTCO/STCO | `assets/images/fig-dtco-system.jpg` |

JPG or PNG both work (the `<img>` tags don't care about extension case, but
match the `.jpg` in the filenames above, or edit the `src` in `index.html` if
you'd rather use `.png`). Aim for roughly 1600px on the long edge, compressed
for web. As soon as the file loads successfully, the placeholder frame
disappears and the real image fills it (16:10 aspect, `object-fit: cover` —
crop/frame your source image with that in mind). Update the `<figcaption>`
text and the `alt=""` attribute in `index.html` next to each `<img>` to
describe the real figure once it's in place.

## Updating the CV

`assets/cv/Junmo-Lee-CV.pdf` is a **phone-number-redacted** copy of the
source CV, built for public distribution:
- Page 1 (contact header) is flattened to an image with the phone number
  painted out, so the digits aren't recoverable from the PDF's text layer.
- Pages 2–4 are the original, untouched (fully selectable/searchable text).

**When you update your CV:** regenerate this file from the new source and
re-apply the same redaction (or manually cover the phone number) before
replacing `assets/cv/Junmo-Lee-CV.pdf`. Don't drop a raw, unredacted CV into
`assets/` — it's the one thing on this site that's public-facing but not
meant to expose a personal phone number.

## Running locally

Any static file server works. From the project root:

```bash
python -m http.server 8080
# then open http://localhost:8080/
```

or, with Node installed:

```bash
npx serve .
```

Private (login-only) traffic stats via [GoatCounter](https://www.goatcounter.com/)
— no cookies, no personal data collected, no consent banner needed. The
tracking snippet is the last thing before `</body>` in `index.html`:

```html
<script data-goatcounter="https://semiconductorjunmolee.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>
```

Dashboard (private, login required): https://semiconductorjunmolee.goatcounter.com/

Note: the site code is always visible in page source for any client-side
analytics tool (that's how the tracking beacon works) — an earlier code was
retired because it happened to match a personally-identifying username; this
one is just a variant of the name already shown everywhere else on the site,
so it doesn't reveal anything new. Loading the site locally during
development also counts as a visit in the dashboard — expected and harmless,
but remove the script block while testing locally if you want a completely
clean count.

## Deploying (when ready)

This is plain static HTML/CSS/JS, so it's directly compatible with GitHub
Pages, Netlify, Vercel, or any static host — no build step required. Before
making the repository public:

1. Confirm `.gitignore` is excluding the original (non-redacted) source CV
   and `Google_Scholar.txt` — `git status` should never show them staged.
2. Skim `git diff --stat` / `git status` once more right before the first
   push, since it's easy to `git add -A` by accident.

## Notes on what was deliberately left out

- **Phone number**: present in the source CV, intentionally excluded from
  every public-facing file on this site (see "Updating the CV" above).
- **Professional photo**: none was available in the source materials, so the
  hero was designed to work on typography and an original diagram rather than
  a headshot. Add one later by placing it in `assets/images/` and adding an
  `<img>` to the hero section if desired — the current layout doesn't require it.
- **Military service (2018–2020)**: present on the source CV but omitted from
  the public Experience section as not relevant to research positioning; nothing
  sensitive, just an editorial curation choice for a technical audience.
- **Research figures**: no publication-ready figures/micrographs were found in
  the source directory, and a first attempt at an illustrative device schematic
  didn't match the real structure — so rather than guess, the site now ships
  with drop-in placeholder slots instead of invented diagrams (see "Replacing
  the placeholder research figures" above).
