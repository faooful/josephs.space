# josephs.space

Joseph Korol's site, served by GitHub Pages from `master`. Plain HTML, CSS and JS: nothing to install or build.

## Adding a note

Notes are short posts (one to three sentences, with an optional image). They show on [/notes](https://josephs.space/notes/), newest first, and the five newest are stations on the map's green Notes line, with an "All notes" station at the end.

1. Add a file named `notes/YYYY-MM-DD-slug.md`, for example `notes/2026-10-27-first-note.md`:

   ```markdown
   ---
   date: 2026-10-27
   title: Optional title
   project: Drift
   image: img/notes/2026-10-27-first-note.webp
   alt: What the image shows
   ---
   One to three sentences. Markdown works, including [links](https://example.com).
   ```

   Only the text is needed. `date` falls back to the date in the file name; `title`, `project`, `image` and `alt` are optional. A note without a title is labelled on the map by its project, or by its date if it has no project either. Put any image under `img/notes/`, and give its path from the site root.

2. Commit and push to `master`. That's all: GitHub Pages rebuilds the site and `notes/index.json` (the feed the map and /notes read) lists the new note a minute or so later.

With no notes, the map's Notes line stays a dashed "coming soon" stub.

How it works: GitHub Pages builds this repo with Jekyll, and `notes/index.json` is a small Jekyll template that lists every `notes/*.md`. `js/notes.js` reads that feed. Two consequences: the repo must not get a `.nojekyll` file, and a local copy served as plain files (for example `python3 -m http.server`) shows no notes, because the template is not filled in. To preview notes locally, run `jekyll serve` in the repo.
