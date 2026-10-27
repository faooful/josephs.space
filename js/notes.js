// Notes feed. GitHub Pages builds notes/index.json from the notes/*.md files (see that file and the README),
// so adding a note is only adding a file. This script reads that feed for the map (js/metro.js) and, on
// /notes, draws the page. Plain script, no build step.
(function () {
	'use strict';

	const root = new URL('..', document.currentScript.src); // the site root: this file lives in js/
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	// 2026-10-27 -> "Oct 27, 2026" (short: "Oct 27"), read as written, with no time zone shift
	function formatDate(iso, short) {
		const [y, m, d] = iso.split('-').map(Number);
		return MONTHS[m - 1] + ' ' + d + (short ? '' : ', ' + y);
	}

	function asText(html) {
		const t = document.createElement('template');
		t.innerHTML = html;
		return t.content.textContent.replace(/\s+/g, ' ').trim();
	}

	function normalise(raw) {
		const slug = String(raw && raw.slug || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
		const date = String(raw && raw.date || '');
		if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return null;
		}
		const html = String(raw.html || '').trim();
		const image = raw.image ? new URL(String(raw.image).replace(/^\/+/, ''), root).href : '';
		return {
			slug,
			date,
			title: raw.title ? String(raw.title).trim() : '',
			project: raw.project ? String(raw.project).trim() : '',
			html,
			text: asText(html),
			image,
			alt: raw.alt ? String(raw.alt) : '',
			when: formatDate(date, false),
			whenShort: formatDate(date, true)
		};
	}

	// newest first; two notes on one day go by file name, newest name first
	const newestFirst = (a, b) => (a.date === b.date ? (a.slug < b.slug ? 1 : -1) : (a.date < b.date ? 1 : -1));

	// Any failure (no feed, a local copy served without Jekyll, a slow network) is an empty feed,
	// which leaves the map's Notes line as its dashed "coming soon" stub.
	function load() {
		const feed = fetch(new URL('notes/index.json', root), { cache: 'no-cache' })
			.then((r) => (r.ok ? r.json() : []))
			.then((list) => (Array.isArray(list) ? list : []).map(normalise).filter(Boolean).sort(newestFirst))
			.catch(() => []);
		const late = new Promise((resolve) => setTimeout(() => resolve([]), 2500));
		return Promise.race([feed, late]);
	}

	const ready = load();
	window.siteNotes = { ready, root };

	// ---------- the /notes page ----------
	const feedEl = document.getElementById('notes-feed');
	if (!feedEl) {
		return;
	}

	function span(cls, text) {
		const s = document.createElement('span');
		s.className = cls;
		if (text) {
			s.textContent = text;
		}
		return s;
	}

	function noteItem(n) {
		const li = document.createElement('li');
		li.className = 'notes-item';
		li.id = n.slug;
		const meta = span('writing-list-date');
		const time = document.createElement('time');
		time.dateTime = n.date;
		time.textContent = n.when;
		meta.append(time);
		if (n.project) {
			meta.append(' · ' + n.project);
		}
		li.append(meta);
		if (n.title) {
			li.append(span('writing-list-title', n.title));
		}
		const text = document.createElement('div');
		text.className = 'notes-text';
		text.innerHTML = n.html; // the note's own Markdown, rendered by the site build from a file in this repo
		li.append(text);
		if (n.image) {
			const img = document.createElement('img');
			img.className = 'notes-img';
			img.src = n.image;
			img.alt = n.alt;
			img.loading = 'lazy';
			img.decoding = 'async';
			li.append(img);
		}
		return li;
	}

	ready.then((notes) => {
		feedEl.append(...notes.map(noteItem));
		document.getElementById('notes-empty').hidden = notes.length > 0;
		feedEl.setAttribute('aria-busy', 'false');
		// a link to one note (/notes/#slug, from the map): go to it once the images above it have their size
		const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
		if (target) {
			const above = [...feedEl.querySelectorAll('img')].filter((img) => target.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_PRECEDING);
			above.forEach((img) => { img.loading = 'eager'; });
			Promise.all(above.map((img) => (img.complete ? null : new Promise((done) => { img.onload = img.onerror = done; }))))
				.then(() => target.scrollIntoView());
		}
	});
})();
