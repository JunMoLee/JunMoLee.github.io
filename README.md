# Junmo Lee — research website

Static site (HTML/CSS/vanilla JS) for Junmo Lee's research identity:
process → device → integration → circuit → system. No build step, no
framework — edit files directly and refresh.

Live at: https://junmolee.github.io/

## Structure

```
index.html               Page markup and section copy (hero, about, research
                          storytelling, publications, experience, education,
                          skills, awards, contact).
css/style.css             Design system: color tokens (light + dark), type
                          scale, spacing scale, layout, components.
js/main.js                Fetches the JSON files in data/ and renders
                          publications, experience, education, skills,
                          awards, and the link rows. Also handles nav scroll
                          state, the mobile menu, and scroll-reveal animation.
js/edit-mode.js            Local-only live text editor (see below). Inert
                          everywhere except localhost.
tools/dev_server.py        Local dev server for live editing — like
                          `python -m http.server`, but can also save edits
                          and publish to GitHub.
data/*.json                Editable content — see "Updating content" below.
assets/cv/                 The public, downloadable CV.
assets/icons/favicon.svg   Site favicon.
assets/images/             Research figures — see "Adding figures" below.
```

Opening `index.html` via `file://` will not work, since the page `fetch()`s
the JSON in `data/`, which requires a server — see "Running locally".

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
| Hero copy, About copy, Research narrative | directly in `index.html`, or the live editor below |

Each publication in `data/publications.json` supports: `year`, `venue`,
`venueShort`, `title`, `authors` (plain text — any `"J. Lee"` or `"J. Lee*"`
substring is auto-bolded), `vol` (optional, e.g. page range), and `tags`
(array of small badges like "Nominated — ...", "Invited", "Equal contribution").

## Live in-browser editing (local only)

The hero, about, and research/contact prose (16 text blocks) can be edited
directly on the page, with Save and Publish buttons.

```bash
python tools/dev_server.py
# then open http://localhost:8080/
```

A **"LOCAL EDITOR"** panel appears in the bottom-right corner — only on
`localhost`/`127.0.0.1`; it never appears on the deployed site.

1. Click **Enable editing** — editable text gets a dashed outline.
2. Click into any outlined text and type normally.
3. Click **Save** — writes the changes into `index.html` on disk.
4. Click **Publish to GitHub** — commits and pushes everything currently
   changed in the project (saved text edits, new figures dropped into
   `assets/images/`, JSON edits, anything) straight to the live site. Type a
   short commit message first, or leave the default.

Equivalent manual publish, if you'd rather do it yourself:
```bash
git add -A && git commit -m "..." && git push
```

**What the live editor covers**: the 16 main prose blocks. Publication /
experience / education / skills / award entries live in `data/*.json`;
edit those directly. The small spec-strip/tag labels inside each research
story, the browser-tab title, the search-preview text, and image
`alt`/`figcaption` text also need direct editing in `index.html`.

## Finding text to edit manually

Select the exact phrase you see on the page, then use **Find in Files** in
your editor (VS Code: `Ctrl+Shift+F`) across the project folder to jump
straight to it in `index.html`, rather than scrolling through the file.
Section boundaries are marked with `<!-- ===== NAME ===== -->` comments
(`HERO`, `ABOUT`, `RESEARCH`, `PUBLICATIONS`, etc.).

## Adding figures

The hero graphic and the three Research-section figures are drop-in image
slots. Save an image with the exact expected filename into `assets/images/`
and it appears automatically — no HTML editing required:

| Slot | Expected filename |
|---|---|
| Hero graphic | `assets/images/hero-device-stack.jpg` |
| Research — process/device | `assets/images/fig-process-device.jpg` |
| Research — M3D integration | `assets/images/fig-m3d-integration.jpg` |
| Research — DTCO/STCO | `assets/images/fig-dtco-system.jpg` |

JPG or PNG both work. Aim for roughly 1600px on the long edge, compressed
for web (16:10 aspect, `object-fit: cover` — crop with that in mind). After
adding a real figure, update the `<figcaption>` text and the image's
`alt=""` attribute in `index.html` to describe it.

## Updating the CV

`assets/cv/Junmo-Lee-CV.pdf` is the public copy, with the phone number
redacted from the header (page 1 is a flattened image; pages 2–4 are
regular searchable text). When replacing this file with an updated CV,
apply the same redaction before publishing it here.

## Running locally

```bash
python -m http.server 8080
# then open http://localhost:8080/
```

or, with Node installed:

```bash
npx serve .
```

Use `python tools/dev_server.py` instead of either of the above if you want
the live in-browser editor (see above).

## Analytics

Private (login-only) traffic stats via [GoatCounter](https://www.goatcounter.com/)
— no cookies, no personal data collected, no consent banner needed. Tracking
snippet is the last thing before `</body>` in `index.html`:

```html
<script data-goatcounter="https://semiconductorjunmolee.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>
```

Dashboard (private, login required): https://semiconductorjunmolee.goatcounter.com/

## Deploying

This is plain static HTML/CSS/JS — directly compatible with GitHub Pages,
Netlify, Vercel, or any static host. Currently deployed via GitHub Pages
from the `main` branch of this repo.
