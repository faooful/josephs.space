// Home map: Mini Metro style radial hub. Plain script, no build step.
// The list in index.html (#metro-list) is the source of truth for stations; this file adds geometry,
// drawing, pan and zoom, popups, the intro, and one requestAnimationFrame loop for trains,
// passengers and pulses. Reduced motion skips the intro and freezes the live layer.
// The Notes line comes from the notes feed (js/notes.js), so the map waits for it and draws once.
(window.siteNotes ? window.siteNotes.ready : Promise.resolve([])).then(function (notes) {
	'use strict';

	const body = document.body;
	const view = document.getElementById('metro-view');
	const svg = document.getElementById('metro-svg');
	if (!body.classList.contains('metro-page') || !view || !svg) {
		return;
	}

	const NS = 'http://www.w3.org/2000/svg';
	const WORLD = { w: 1440, h: 900 };
	const HUB = [720, 450];
	const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

	// ---------- geometry (world units, octilinear only) ----------
	// route: the solid part trains run on. stubs: dashed "coming soon" segments.
	const LINES = {
		case: { route: [[590, 450], [420, 450], [330, 540], [330, 640], [400, 710], [620, 710]], stubs: [[[708, 450], [590, 450]]], trains: 3 },
		side: { route: [[720, 450], [720, 230], [790, 160], [1230, 160], [1280, 210], [1280, 730]], stubs: [[[1280, 730], [1280, 800]]], trains: 3 },
		write: { route: [[732, 450], [732, 360], [900, 360], [900, 60]], stubs: [], trains: 2 },
		// Notes with no notes yet: a short dashed stub off the hub, no route, no trains (see the notes feed below)
		notes: { route: null, stubs: [[[720, 450], [720, 560]]], trains: 0 }
	};
	const LINE_NAMES = { case: 'Case Studies', side: 'Side Projects', write: 'Writing', notes: 'Notes' };
	const SHAPES = { case: 'square', side: 'circle', write: 'triangle', notes: 'diamond' };

	// id: [x, y, label dx, label dy, anchor]
	const PLACES = {
		datadog: [630, 450, 0, -26, 'middle'], p44: [530, 450, 0, -26, 'middle'], spotify: [440, 450, 0, -26, 'middle'],
		hologram: [375, 495, -22, 0, 'end'], google: [330, 575, -22, 0, 'end'], slo: [330, 630, -22, 0, 'end'],
		ubuntu: [450, 710, 0, 28, 'middle'], cell: [530, 710, 0, 28, 'middle'], 'all-cases': [620, 710, 0, 28, 'middle'],
		drift: [726, 360, -26, 0, 'end'], prmap: [720, 280, -22, 0, 'end'], cli: [755, 195, -22, 0, 'end'],
		obs: [900, 160, -14, -26, 'end'], workbench: [1000, 160, 0, 28, 'middle'], signals: [1090, 160, 0, -26, 'middle'],
		mocking: [1180, 160, 0, 28, 'middle'],
		frost: [1280, 270, 22, 0, 'start'], dota: [1280, 345, 22, 0, 'start'], notetab: [1280, 420, 22, 0, 'start'],
		reading: [1280, 495, 22, 0, 'start'], ffind: [1280, 570, 22, 0, 'start'], fsound: [1280, 645, 22, 0, 'start'],
		druids: [1280, 720, 22, 0, 'start'],
		postcards: [820, 360, 0, 28, 'middle'], taste: [900, 115, 22, 0, 'start'], 'writing-index': [900, 60, 22, 0, 'start']
	};
	const DECO = [{ id: 'next-project', line: 'side', label: 'Next project', place: [1280, 790, 22, 0, 'start'] }];
	// The few places where waiting passengers would sit on a line or a label.
	const PAX_SIDE = { drift: [-1, 1], obs: [1, 1], postcards: [0, -1], 'writing-index': [-1, 0], taste: [-1, 0] };

	// ---------- the notes feed ----------
	// The 5 newest notes and an 'All notes' terminus go into the list's Notes section, so they are stations like
	// any other. They run down from the hub and then east, one slot each; with no notes the stub stays.
	const list = document.getElementById('metro-list');
	const NOTE_STOPS = 5;
	const NOTE_SLOTS = [[720, 545, -22, 0, 'end'], [830, 630, 0, 28, 'middle'], [920, 630, 0, -26, 'middle'], [1010, 630, 0, 28, 'middle'], [1100, 630, 0, -26, 'middle'], [1190, 630, 0, 28, 'middle']];
	const shortLabel = (t) => (t.length > 18 ? t.slice(0, 17).trimEnd() + '\u2026' : t);

	function noteLi(id, kicker, label, href, cta, title, meta, image, alt) {
		const li = document.createElement('li');
		li.dataset.station = id;
		li.dataset.label = label;
		if (kicker) {
			li.dataset.kicker = kicker;
			const k = document.createElement('span');
			k.className = 'ml-kicker';
			k.textContent = kicker;
			li.append(k);
		}
		if (image) {
			li.dataset.image = image;
			li.dataset.previewAlt = alt;
		}
		const a = document.createElement('a');
		a.href = href;
		a.dataset.cta = cta;
		a.textContent = title;
		li.append(a);
		if (meta) {
			const m = document.createElement('span');
			m.className = 'ml-meta';
			m.textContent = meta;
			li.append(m);
		}
		return li;
	}

	const noteList = list.querySelector('section[data-line="notes"] ul');
	const newest = notes.slice(0, NOTE_STOPS);
	if (newest.length && noteList) {
		noteList.replaceChildren(...newest.map((n) => noteLi('note-' + n.slug, [n.when, n.project].filter(Boolean).join(' \u00b7 '),
			shortLabel(n.title || n.whenShort), 'notes/#' + n.slug, 'Open on the notes page', n.title || n.text, n.title ? n.text : '', n.image, n.alt)),
		noteLi('all-notes', '', 'All notes', 'notes/', 'Read all notes', 'All notes', 'Every note, newest first.', '', ''));
		const stops = NOTE_SLOTS.slice(0, newest.length + 1);
		stops.forEach((slot, i) => {
			PLACES[i < newest.length ? 'note-' + newest[i].slug : 'all-notes'] = slot;
		});
		const end = stops[stops.length - 1];
		LINES.notes = { route: [HUB, [720, 560], [790, 630], [end[0], 630]], stubs: [], trains: 1 };
	}

	// ---------- read stations from the list ----------
	const stations = new Map();

	function textOf(el, sel) {
		const found = el.querySelector(sel);
		return found ? found.textContent.trim() : '';
	}

	function entryFrom(li, line) {
		const link = li.querySelector('a');
		return {
			line,
			title: link ? link.textContent.trim() : textOf(li, '.ml-title'),
			meta: textOf(li, '.ml-meta'),
			kicker: li.dataset.kicker || '',
			link,
			cta: link ? (link.dataset.cta || 'Open') : '',
			soon: li.hasAttribute('data-soon'),
			preview: li.dataset.preview || '',
			image: li.dataset.image || '',
			previewAlt: li.dataset.previewAlt || ''
		};
	}

	list.querySelectorAll('section[data-line]').forEach((section) => {
		const line = section.dataset.line;
		section.querySelectorAll('li[data-station]').forEach((li) => {
			const id = li.dataset.station;
			if (!PLACES[id]) {
				return; // in the list but not drawn yet: still reachable there
			}
			const entry = entryFrom(li, line);
			const known = stations.get(id);
			if (known) {
				known.entries.push(entry);
				known.lines.push(line);
				return;
			}
			stations.set(id, { id, place: PLACES[id], lines: [line], entries: [entry], label: li.dataset.label || entry.title, soon: entry.soon });
		});
	});

	// ---------- svg helpers ----------
	function el(tag, attrs, parent) {
		const node = document.createElementNS(NS, tag);
		for (const key in attrs) {
			node.setAttribute(key, attrs[key]);
		}
		if (parent) {
			parent.appendChild(node);
		}
		return node;
	}

	function roundedPath(pts, r) {
		let d = 'M' + pts[0][0] + ' ' + pts[0][1];
		for (let i = 1; i < pts.length - 1; i++) {
			const [px, py] = pts[i - 1];
			const [cx, cy] = pts[i];
			const [nx, ny] = pts[i + 1];
			const l1 = Math.hypot(cx - px, cy - py);
			const l2 = Math.hypot(nx - cx, ny - cy);
			const rr = Math.min(r, l1 / 2, l2 / 2);
			d += ' L' + (cx - (cx - px) / l1 * rr) + ' ' + (cy - (cy - py) / l1 * rr) + ' Q' + cx + ' ' + cy + ' ' + (cx + (nx - cx) / l2 * rr) + ' ' + (cy + (ny - cy) / l2 * rr);
		}
		const last = pts[pts.length - 1];
		return d + ' L' + last[0] + ' ' + last[1];
	}

	function tBar(g, pts, cls) {
		const [ax, ay] = pts[pts.length - 2];
		const [bx, by] = pts[pts.length - 1];
		const len = Math.hypot(bx - ax, by - ay);
		const ux = (bx - ax) / len;
		const uy = (by - ay) / len;
		return el('line', { x1: bx - uy * 13, y1: by + ux * 13, x2: bx + uy * 13, y2: by - ux * 13, class: cls }, g);
	}

	function glyphPath(shape, x, y, s) {
		const h = s / 2;
		if (shape === 'square') {
			const q = h * 0.9;
			return 'M' + (x - q) + ' ' + (y - q) + 'h' + 2 * q + 'v' + 2 * q + 'h' + -2 * q + 'Z';
		}
		if (shape === 'triangle') {
			const t = s * 1.1;
			return 'M' + x + ' ' + (y - t * 0.58) + 'L' + (x + t / 2) + ' ' + (y + t * 0.29) + 'L' + (x - t / 2) + ' ' + (y + t * 0.29) + 'Z';
		}
		if (shape === 'diamond') {
			const t = h * 1.15;
			return 'M' + x + ' ' + (y - t) + 'L' + (x + t) + ' ' + y + 'L' + x + ' ' + (y + t) + 'L' + (x - t) + ' ' + y + 'Z';
		}
		return 'M' + (x - h) + ' ' + y + 'a' + h + ' ' + h + ' 0 1 0 ' + s + ' 0a' + h + ' ' + h + ' 0 1 0 ' + -s + ' 0Z';
	}

	// ---------- draw ----------
	const world = el('g', { class: 'm-world' }, svg);
	const gBack = el('g', { class: 'm-back', 'aria-hidden': 'true' }, world);
	const gLines = el('g', { 'aria-hidden': 'true' }, world);
	const gLive = el('g', { class: 'm-live', 'aria-hidden': 'true' }, world);
	const gStations = el('g', {}, world);
	const gLabels = el('g', { 'aria-hidden': 'true' }, world);

	// Backdrop: a faint district grid, one river and three parks, all behind the lines.
	for (let x = 0; x <= WORLD.w; x += 80) {
		el('line', { x1: x, y1: -200, x2: x, y2: WORLD.h + 200, class: 'm-grid' }, gBack);
	}
	for (let y = 0; y <= WORLD.h; y += 80) {
		el('line', { x1: -200, y1: y, x2: WORLD.w + 200, y2: y, class: 'm-grid' }, gBack);
	}
	el('path', { class: 'm-river', d: 'M-80 840 C 180 800 360 640 560 600 S 900 560 1080 470 S 1320 300 1540 250' }, gBack);
	el('rect', { class: 'm-park', x: 980, y: 220, width: 170, height: 110, rx: 24 }, gBack);
	el('rect', { class: 'm-park', x: 450, y: 610, width: 190, height: 130, rx: 24 }, gBack);
	el('rect', { class: 'm-park', x: 420, y: 140, width: 150, height: 120, rx: 24 }, gBack);

	const routes = {};
	const drawables = []; // for the intro: { el, len, from } solid lines drawn outward
	const fadeIns = []; // stubs, caps and decorations that fade in after the lines
	for (const key in LINES) {
		const spec = LINES[key];
		spec.stubs.forEach((pts) => {
			const stub = el('path', { d: roundedPath(pts, 16), class: 'm-stub m-' + key }, gLines);
			fadeIns.push(stub);
		});
		if (!spec.route) {
			fadeIns.push(tBar(gLines, spec.stubs[0], 'm-cap m-' + key + ' m-stub'));
			// no legend: a hover title and a label say what the dashed stub is
			const tag = LINE_NAMES[key] + ', coming soon';
			const hint = el('g', { class: 'm-stub-hint', role: 'img', 'aria-label': tag }, gStations);
			el('title', {}, hint).textContent = tag;
			el('path', { d: roundedPath(spec.stubs[0], 16), class: 'm-stub-hit' }, hint);
			continue;
		}
		const path = el('path', { d: roundedPath(spec.route, 16), class: 'm-line m-' + key }, gLines);
		const len = path.getTotalLength();
		const last = spec.stubs.length && spec.stubs[spec.stubs.length - 1][0][0] === spec.route[spec.route.length - 1][0] && spec.stubs[spec.stubs.length - 1][0][1] === spec.route[spec.route.length - 1][1]
			? spec.stubs[spec.stubs.length - 1] : spec.route;
		const cap = tBar(gLines, last, 'm-cap m-' + key + (last === spec.route ? '' : ' m-stub'));
		fadeIns.push(cap);
		// sample every 2 units so trains never call getPointAtLength in the loop
		const n = Math.ceil(len / 2) + 1;
		const xs = new Float32Array(n);
		const ys = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			const p = path.getPointAtLength(Math.min(len, i * 2));
			xs[i] = p.x;
			ys[i] = p.y;
		}
		routes[key] = { key, path, len, xs, ys, stops: [] };
		const offset = key === 'case' ? 0.18 : 0; // red starts after Datadog's dashed stretch
		drawables.push({ el: path, len, delay: offset });
	}

	function nearestOn(route, x, y) {
		let best = Infinity;
		let at = 0;
		for (let i = 0; i < route.xs.length; i++) {
			const d = (route.xs[i] - x) ** 2 + (route.ys[i] - y) ** 2;
			if (d < best) {
				best = d;
				at = i;
			}
		}
		return { s: at * 2, d: Math.sqrt(best) };
	}

	function hubDistance(line, x, y) {
		const r = routes[line];
		const hit = nearestOn(r, x, y);
		return hit.d < 14 ? hit.s : Math.hypot(x - HUB[0], y - HUB[1]);
	}

	const stationEls = new Map();
	const labelEls = new Map();

	function drawStation(st, deco) {
		const [x, y, dx, dy, anchor] = st.place;
		const inter = st.lines.length > 1;
		const shape = inter ? 'circle' : SHAPES[st.lines[0]];
		const size = inter ? 28 : 22;
		const cls = 'st' + (inter ? ' st--inter' : '') + (st.soon ? ' st--soon' : '') + (deco ? ' st--deco st--soon' : '');
		const g = el('g', deco ? { class: cls, 'aria-hidden': 'true' } : { class: cls, tabindex: '0', role: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-id': st.id }, gStations);
		if (!deco) {
			const lineNames = st.lines.map((l) => LINE_NAMES[l]).join(' and ');
			const extra = st.soon ? ', coming soon' : '';
			g.setAttribute('aria-label', st.label + extra + ', ' + lineNames);
		}
		el('circle', { cx: x, cy: y, r: 22, class: 'st-hit' }, g);
		el('circle', { cx: x, cy: y, r: size / 2 + 8, class: 'st-ring' }, g);
		el('path', { d: glyphPath(shape, x, y, size), class: 'st-glyph' }, g);
		const label = el('text', { x: x + dx, y: y + dy, 'text-anchor': anchor, 'dominant-baseline': 'middle', class: deco || st.soon ? 'm-label-sm' : 'm-label' }, gLabels);
		label.textContent = st.label;
		const along = hubDistance(st.lines[0], x, y);
		const item = { st, g, label, x, y, shape, size, along, line: st.lines[0], waiting: [] };
		if (!deco) {
			stationEls.set(st.id, item);
			labelEls.set(st.id, label);
		}
		return item;
	}

	stations.forEach((st) => drawStation(st, false));
	const decoItems = DECO.map((d) => drawStation({ id: d.id, place: d.place, lines: [d.line], label: d.label, entries: [] }, true));
	decoItems.forEach((d) => {
		fadeIns.push(d.g, d.label);
	});
	// hub: opens the bio from the list, so the words live in one place. First in tab order.
	const [bioName, bioRole] = textOf(list, '.ml-ident').split(' · ');
	const hub = el('g', { class: 'st st--hub', tabindex: '0', role: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-id': 'hub', 'aria-label': bioName + ', ' + bioRole + ', about' }, gStations);
	gStations.insertBefore(hub, gStations.querySelector('.st[data-id]'));
	el('circle', { cx: HUB[0], cy: HUB[1], r: 30, class: 'st-hit' }, hub);
	el('circle', { cx: HUB[0], cy: HUB[1], r: 28, class: 'st-ring' }, hub);
	el('path', { d: glyphPath('circle', HUB[0], HUB[1], 40), class: 'st-glyph' }, hub);
	const hubName = el('text', { x: HUB[0] + 30, y: HUB[1] + 32, class: 'm-label-hub m-hub-label', 'dominant-baseline': 'middle' }, gLabels);
	hubName.textContent = bioName;
	const hubRole = el('text', { x: HUB[0] + 30, y: HUB[1] + 52, class: 'm-label-sm m-hub-label', 'dominant-baseline': 'middle' }, gLabels);
	hubRole.textContent = bioRole;
	const hubItem = { bio: true, g: hub, label: hubName, x: HUB[0], y: HUB[1], shape: 'circle', size: 40 };

	// stops along each route, for trains
	stationEls.forEach((item) => {
		item.st.lines.forEach((line) => {
			const hit = nearestOn(routes[line], item.x, item.y);
			if (hit.d < 14) {
				routes[line].stops.push({ s: hit.s, item });
			}
		});
	});
	for (const key in routes) {
		routes[key].stops.sort((a, b) => a.s - b.s);
	}
	const liveStops = []; // stations where passengers wait (not "coming soon")
	stationEls.forEach((item) => {
		if (!item.st.soon) {
			liveStops.push(item);
		}
	});

	// ---------- camera ----------
	const cam = { k: 1, tx: 0, ty: 0 };
	let vw = view.clientWidth;
	let vh = view.clientHeight;
	const small = () => vw <= 640;
	const fitK = () => Math.min(vw / (WORLD.w + 80), vh / (WORLD.h + 80));
	const minK = () => Math.min(fitK() * 0.85, 0.6);
	const maxK = 2.6;

	function restView() {
		if (small()) {
			return { k: 1, cx: 845, cy: 420 };
		}
		return { k: Math.min(1.3, fitK() * 1.15), cx: 770, cy: 430 };
	}

	function setCam(k, cx, cy) {
		cam.k = k;
		cam.tx = vw / 2 - cx * k;
		cam.ty = vh / 2 - cy * k;
		applyCam();
	}

	function clampCam() {
		const margin = 120;
		const w = WORLD.w * cam.k;
		const h = WORLD.h * cam.k;
		cam.tx = Math.min(vw - margin, Math.max(margin - w, cam.tx));
		cam.ty = Math.min(vh - margin, Math.max(margin - h, cam.ty));
	}

	function drawCam() {
		world.setAttribute('transform', 'translate(' + cam.tx.toFixed(2) + ' ' + cam.ty.toFixed(2) + ') scale(' + cam.k.toFixed(4) + ')');
	}

	function applyCam() {
		clampCam();
		drawCam();
		svg.classList.toggle('is-far', cam.k < 0.62);
		placePop();
	}

	function zoomAt(factor, sx, sy) {
		const k = Math.min(maxK, Math.max(minK(), cam.k * factor));
		cam.tx = sx - (sx - cam.tx) * (k / cam.k);
		cam.ty = sy - (sy - cam.ty) * (k / cam.k);
		cam.k = k;
		applyCam();
	}

	const toScreen = (x, y) => [x * cam.k + cam.tx, y * cam.k + cam.ty];

	// ---------- popup ----------
	const pop = document.getElementById('metro-pop');
	const dock = document.querySelector('.metro-dock');
	const ident = document.querySelector('.metro-ident');
	const popBody = pop.querySelector('.m-pop-body');
	let openItem = null;
	let popAt = [0, 0]; // where the open card sits, for the morph

	// the line's colour with its station shape on it, standing in for the legend
	function lineKey(line) {
		const key = document.createElementNS(NS, 'svg');
		key.setAttribute('class', 'm-line-key m-key--' + line);
		key.setAttribute('viewBox', '0 0 24 12');
		key.setAttribute('aria-hidden', 'true');
		el('path', { d: 'M0 6H24', class: 'k-line' }, key);
		el('path', { d: glyphPath(SHAPES[line], 12, 6, 8), class: 'k-glyph' }, key);
		return key;
	}

	function section(entry, idx) {
		const sec = document.createElement('div');
		sec.className = 'm-pop-sec';
		const kicker = document.createElement('div');
		kicker.className = 'm-pop-kicker';
		kicker.append(lineKey(entry.line), LINE_NAMES[entry.line] + (entry.kicker ? ' · ' + entry.kicker : ''));
		if (entry.soon) {
			const badge = document.createElement('span');
			badge.className = 'coming-soon-badge';
			badge.textContent = 'Coming soon';
			kicker.append(badge);
		}
		const title = document.createElement('h2');
		title.className = 'm-pop-title';
		if (idx === 0) {
			title.id = 'metro-pop-title';
		}
		title.textContent = entry.title;
		sec.append(kicker, title);
		if (entry.preview || entry.image) {
			sec.append(previewImg(entry));
		}
		if (entry.meta) {
			const meta = document.createElement('p');
			meta.className = 'm-pop-meta';
			meta.textContent = entry.meta;
			sec.append(meta);
		}
		if (entry.link) {
			const a = entry.link.cloneNode(false);
			a.removeAttribute('data-cta');
			a.textContent = entry.cta;
			sec.append(a);
		}
		return sec;
	}

	// built only when a card opens, so nothing is fetched until then; fixed size so the card never shifts
	function previewImg(entry) {
		const img = document.createElement('img');
		img.className = 'm-pop-img';
		img.width = 280;
		img.height = 175;
		img.decoding = 'async';
		img.alt = entry.previewAlt;
		img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
		if (entry.image) {
			img.classList.add('m-pop-img--note'); // a note's own image, any size: cropped to the card's frame
			img.src = entry.image;
			return img;
		}
		img.srcset = entry.preview + '-560.webp 2x';
		img.src = entry.preview + '-280.webp';
		return img;
	}

	// the hub's card: name, role, the bio's opening two paragraphs and the contact links, all cloned from the list;
	// the second is set as a quieter 'Currently' line, with its first word picked out (the words are unchanged)
	function bioSection() {
		const sec = document.createElement('div');
		sec.className = 'm-pop-sec m-pop-bio';
		const title = document.createElement('h2');
		title.className = 'm-pop-title';
		title.id = 'metro-pop-title';
		title.textContent = bioName;
		const role = document.createElement('div');
		role.className = 'm-pop-kicker';
		role.textContent = bioRole;
		sec.append(title, role);
		list.querySelectorAll('.bio-copy p:nth-child(-n+2)').forEach((p, i) => {
			const copy = p.cloneNode(true);
			copy.className = i ? 'm-pop-bio-now' : 'm-pop-bio-lede';
			const first = copy.firstChild;
			if (i && first && first.nodeType === 3 && first.data.startsWith('Currently')) {
				const lead = document.createElement('span');
				lead.textContent = 'Currently';
				first.data = first.data.slice(9);
				copy.prepend(lead);
			}
			sec.append(copy);
		});
		const links = document.createElement('div');
		links.className = 'm-pop-links';
		list.querySelectorAll('.home-footer a').forEach((a) => links.append(a.cloneNode(true)));
		sec.append(links);
		return sec;
	}

	// ---------- every card is centred on its shape: the map pans to make room, and a card bigger than the room (or on a dragged map) is held on screen ----------
	const popRoof = () => ident.getBoundingClientRect().bottom + 8;
	const popFloor = () => dock.getBoundingClientRect().top - 8;
	const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

	// the shape's outline as drawn while open (scaled 1.22), around its centre in screen px: [left, top, right, bottom]
	function shapeBox(item) {
		const s = item.size * 1.22 * cam.k;
		if (item.shape === 'square') {
			return [-0.45 * s, -0.45 * s, 0.45 * s, 0.45 * s];
		}
		if (item.shape === 'triangle') {
			return [-0.55 * s, -0.638 * s, 0.55 * s, 0.319 * s];
		}
		const r = item.shape === 'diamond' ? 0.575 * s : s / 2;
		return [-r, -r, r, r];
	}

	// ---------- the shape itself becomes the card ----------
	// A copy of the station's own outline (same fill, same stroke) is drawn on a layer over the map and reshaped every frame.
	// It grows out from the node's centre, its centre staying on the node's: size, outline (circle, square, triangle or
	// diamond to the card's rounded rectangle), stroke (thinning into the card's border) and fill (becoming the card's) all
	// move together on one expo-out curve. Only if the growing box would run off screen is it held inside, so any shift
	// eases in as it grows. The real card stays see-through under it; its content fades in over the last 100 ms.
	// Closing: the text fades in 60 ms while the shape starts to collapse back into the node, 220 ms in all.
	// The layer is a plain SVG path redrawn from the clock, so it works the same in every browser (no CSS d, and a
	// clip-path would cut a triangle's stroke off). Each frame is arithmetic on values read once at the start: no layout reads.
	const OPEN_MS = 300;
	const CLOSE_MS = 220;
	const SHOW_AT = 200 / OPEN_MS; // the content fades in from 200 ms to 300 ms
	const HIDE_BY = 60 / CLOSE_MS; // and out in the first 60 ms of a close
	const SHRINK_AT = 40; // the shape starts back 40 ms into a close
	// cubic-bezier(0.16, 1, 0.3, 1), an expo-out, tabulated once so a frame only looks it up
	const EASE = (() => {
		const n = 256;
		const xs = [];
		const ys = [];
		for (let i = 0; i <= n; i++) {
			const t = i / n;
			const u = 1 - t;
			xs.push(3 * u * u * t * 0.16 + 3 * u * t * t * 0.3 + t * t * t);
			ys.push(3 * u * u * t + 3 * u * t * t + t * t * t);
		}
		return (x) => {
			if (x <= 0) {
				return 0;
			}
			if (x >= 1) {
				return 1;
			}
			let i = 1;
			while (xs[i] < x) {
				i++;
			}
			return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / (xs[i] - xs[i - 1]);
		};
	})();
	const popClose = pop.querySelector('.m-pop-close');
	const morphSvg = document.createElementNS(NS, 'svg');
	morphSvg.setAttribute('class', 'm-morph');
	morphSvg.setAttribute('aria-hidden', 'true');
	const morphPath = el('path', {}, morphSvg);
	pop.before(morphSvg);
	let morph = null; // { item, closing, anims, pan, from, to, w, h, roof, floor }

	// Every outline is the same 8 points on a frame (in % of it), with round corners of radius R: a FLIP of the frame from the
	// shape's box to the card's, while the points slide out to the box's corners and edges and R goes to the card's 12px.
	// A circle is the box with R at half its size; triangles and diamonds start as their own polygon, with sharp corners.
	const BOX = [[50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50], [0, 0]];
	const POLY = {
		triangle: [[50, 0], [62.5, 25], [75, 50], [100, 100], [50, 100], [0, 100], [25, 50], [37.5, 25]],
		diamond: [[50, 0], [75, 25], [100, 50], [75, 75], [50, 100], [25, 75], [0, 50], [25, 25]],
	};
	const KAPPA = 0.5523; // a cubic through a right-angled corner this way is a quarter circle

	const mix = (a, b, e) => a + (b - a) * e;
	const channels = (c) => (c.match(/[\d.]+/g) || [0, 0, 0]).map(Number).concat([1]).slice(0, 4);
	const mixColour = (a, b, e) => 'rgba(' + a.map((v, i) => (i < 3 ? Math.round(mix(v, b[i], e)) : +mix(v, b[i], e).toFixed(3))).join(',') + ')';
	const f2 = (v) => v.toFixed(2);

	// a closed polygon of the 8 points, its 4 corner points (odd) rounded by up to R, never past their neighbours;
	// the other 4 (the edges' middles at the end, a diamond's or triangle's tips at the start) stay sharp
	function roundedPoly(pts, R) {
		const n = pts.length;
		let d = '';
		for (let i = 0; i < n; i++) {
			const [vx, vy] = pts[i];
			const [ax, ay] = pts[(i + n - 1) % n];
			const [bx, by] = pts[(i + 1) % n];
			const la = Math.hypot(ax - vx, ay - vy) || 1;
			const lb = Math.hypot(bx - vx, by - vy) || 1;
			const c = i % 2 ? Math.max(0, Math.min(R, la, lb)) : 0;
			const ix = vx + ((ax - vx) / la) * c;
			const iy = vy + ((ay - vy) / la) * c;
			const ox = vx + ((bx - vx) / lb) * c;
			const oy = vy + ((by - vy) / lb) * c;
			d += (i ? 'L' : 'M') + f2(ix) + ' ' + f2(iy);
			if (c > 0.01) {
				d += 'C' + f2(mix(ix, vx, KAPPA)) + ' ' + f2(mix(iy, vy, KAPPA)) + ' ' + f2(mix(ox, vx, KAPPA)) + ' ' + f2(mix(oy, vy, KAPPA)) + ' ' + f2(ox) + ' ' + f2(oy);
			}
		}
		return d + 'Z';
	}

	// the morphing outline at e (0 the node as drawn while open, 1 the card's 1px border), its centre on the node's.
	// The map pans so the card fits centred; only a card bigger than the room is held on screen, eased in with e
	function morphD(m, e) {
		const item = m.item;
		const [sx, sy] = toScreen(item.x, item.y);
		const [l, t, r, b] = shapeBox(item);
		const W = mix(r - l, m.w, e);
		const H = mix(b - t, m.h, e);
		const cx = mix(sx + (l + r) / 2, sx, e);
		const cy = mix(sy + (t + b) / 2, sy, e);
		// it arrives on the card's whole-pixel box (and, for a card bigger than the room, its held place)
		const [hx, hy] = m.pan ? m.pan.hold : [popAt[0] - (sx - m.w / 2), popAt[1] - (sy - m.h / 2)];
		const x = cx - W / 2 + hx * e;
		const y = cy - H / 2 + hy * e;
		const poly = POLY[item.shape] || BOX;
		const half = (m.from.width / 2) * e; // drawn on the middle of the card's border (the node's own outline) at the end
		const R = mix(item.shape === 'circle' ? (r - l) / 2 : 0, 12, e) - half;
		const iw = W - 2 * half;
		const ih = H - 2 * half;
		const pts = poly.map(([px, py], j) => [x + half + (iw * mix(px, BOX[j][0], e)) / 100, y + half + (ih * mix(py, BOX[j][1], e)) / 100]);
		return roundedPoly(pts, R);
	}

	// where the shape is at time t (ms) into this open or close
	function shapeAt(m, t) {
		return m.closing ? m.e0 * (1 - EASE((t - SHRINK_AT) / (CLOSE_MS - SHRINK_AT))) : m.e0 + (1 - m.e0) * EASE(t / OPEN_MS);
	}

	// one frame: read the clock (the content's fade, linear), redraw the shape
	function drawMorph(m) {
		if (morph !== m) {
			return;
		}
		const a = m.anims[0];
		const p = a.effect.getComputedTiming().progress;
		const e = shapeAt(m, (p == null ? 1 : p) * m.ms);
		m.e = e;
		if (m.pan) {
			if (cam.tx !== m.pan.at[0] || cam.ty !== m.pan.at[1]) {
				m.pan = null; // the map was dragged or zoomed: the pan gives way
			} else {
				const f = m.pan.e0 < 1 ? (e - m.pan.e0) / (1 - m.pan.e0) : 1; // the same curve as the shape
				cam.tx = mix(m.pan.from[0], m.pan.to[0], f);
				cam.ty = mix(m.pan.from[1], m.pan.to[1], f);
				m.pan.at = [cam.tx, cam.ty];
				drawCam();
				placeFast(m);
			}
		}
		morphPath.setAttribute('d', morphD(m, e));
		morphPath.style.fill = mixColour(m.from.fill, m.to.fill, e);
		requestAnimationFrame(() => drawMorph(m));
	}

	function stopMorph() {
		if (morph) {
			morph.anims.forEach((a) => a.cancel());
			const panned = !!morph.pan;
			morph = null;
			if (panned) {
				applyCam(); // a pan cut short (closed part-way) stays where it got to
			}
		}
		morphSvg.classList.remove('is-on');
		pop.classList.remove('is-morphing');
	}

	let shownItem = null; // whose shape has become the card, so its node is empty until the card goes back into it

	function hideCard() {
		stopMorph();
		pop.hidden = true;
		pop.classList.remove('is-closing');
		svg.classList.remove('is-bio');
		if (shownItem) {
			shownItem.g.classList.remove('is-card');
			shownItem = null;
		}
	}

	// plays the morph open (closing false) or back into the shape (closing true). Turned round part-way, it starts again
	// from where the shape and the text are, so nothing jumps
	function playMorph(item, closing) {
		let e0 = closing ? 1 : 0;
		let op0 = closing ? 1 : 0;
		let colours = null;
		if (morph && morph.item === item && morph.e != null && morph.anims[0].playState !== 'finished') {
			if (morph.closing === closing) {
				return;
			}
			e0 = morph.e;
			op0 = +getComputedStyle(popBody).opacity;
			colours = [morph.from, morph.to];
		}
		stopMorph();
		pop.classList.toggle('is-closing', closing); // a card on its way out lets clicks through to the map
		if (reduceQuery.matches) {
			const m = { item, closing, anims: [pop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, direction: closing ? 'reverse' : 'normal', fill: 'both' })] };
			m.anims[0].onfinish = () => (morph === m && (m.closing ? hideCard() : stopMorph()));
			morph = m;
			if (!closing) {
				const to = panTo(item, pop.offsetWidth, pop.offsetHeight, popRoof(), popFloor());
				if (to) {
					cam.tx = to[0];
					cam.ty = to[1];
					applyCam(); // no motion: the map is simply where it needs to be
				}
			}
			return;
		}
		if (!colours) {
			// the node's outline stays as it is, colour and weight, and is the card's border; only the fill changes
			const glyph = getComputedStyle(item.g.querySelector('.st-glyph'));
			colours = [{ fill: channels(glyph.fill), stroke: edge.stroke, width: edge.width }, { fill: channels(getComputedStyle(pop).backgroundColor) }];
		}
		const ms = closing ? CLOSE_MS : OPEN_MS;
		const fade = closing ? [{ opacity: op0 }, { opacity: 0, offset: HIDE_BY }, { opacity: 0 }] : [{ opacity: op0 }, { opacity: op0, offset: SHOW_AT }, { opacity: 1 }];
		const timing = { duration: ms, fill: 'both' };
		const m = {
			item,
			closing,
			ms,
			e0,
			e: e0,
			anims: [popBody.animate(fade, timing), popClose.animate(fade, timing)],
			from: colours[0],
			to: colours[1],
			// read once: the card's size and the room on screen, so no frame reads layout
			w: pop.offsetWidth,
			h: pop.offsetHeight,
			roof: popRoof(),
			floor: popFloor(),
		};
		shownItem = item;
		item.g.classList.add('is-card'); // the node's own shape is now the one on the move
		pop.classList.add('is-morphing'); // the card is see-through until the shape has landed under it
		morphSvg.classList.add('is-on');
		m.anims[0].onfinish = () => {
			if (morph !== m) {
				return;
			}
			if (m.closing) {
				hideCard();
			} else {
				if (m.pan) {
					[cam.tx, cam.ty] = m.pan.to; // land exactly where the pan was going
				}
				stopMorph();
			}
		};
		if (!closing) {
			// opening never leaves the card off centre if the map can move to make room; closing leaves the map where it is
			const to = panTo(item, m.w, m.h, m.roof, m.floor);
			if (to) {
				// where the card will be held once the map is there (only its whole-pixel rounding, unless it is bigger than the room)
				const [tx, ty] = [item.x * cam.k + to[0], item.y * cam.k + to[1]];
				const hold = [Math.round(clamp(tx - m.w / 2, 16, vw - 16 - m.w)) - (tx - m.w / 2), Math.round(clamp(ty - m.h / 2, m.roof, m.floor - m.h)) - (ty - m.h / 2)];
				m.pan = { from: [cam.tx, cam.ty], to, at: [cam.tx, cam.ty], e0, hold };
			}
		}
		morph = m;
		morphPath.style.stroke = m.from.stroke;
		morphPath.style.strokeWidth = m.from.width.toFixed(2) + 'px';
		drawMorph(m);
	}

	// where the map would have to be for a w x h card to sit centred on the item, inside the room; null if it already fits.
	// On an axis where the card is bigger than the room, the item goes to the room's middle and placePop holds the card
	function panTo(item, w, h, roof, floor) {
		const [sx, sy] = toScreen(item.x, item.y);
		const need = (s, size, lo, hi) => (hi - lo >= size ? clamp(s, lo + size / 2, hi - size / 2) - s : (lo + hi) / 2 - s);
		const dx = need(sx, w, 16, vw - 16);
		const dy = need(sy, h, roof, floor);
		if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
			return null;
		}
		const save = [cam.tx, cam.ty];
		cam.tx += dx;
		cam.ty += dy;
		clampCam(); // never past the map's own limits
		const to = [cam.tx, cam.ty];
		[cam.tx, cam.ty] = save;
		return to[0] === save[0] && to[1] === save[1] ? null : to;
	}

	// placePop from the sizes read when the morph began, for frames that must not read layout
	function placeFast(m) {
		const [sx, sy] = toScreen(m.item.x, m.item.y);
		popAt = [Math.round(clamp(sx - m.w / 2, 16, vw - 16 - m.w)), Math.round(clamp(sy - m.h / 2, m.roof, m.floor - m.h))];
		pop.style.transform = 'translate(' + popAt[0] + 'px,' + popAt[1] + 'px)';
	}

	function openStation(item, focusInside) {
		if (morph && morph.closing && morph.item === item) {
			// reopened while it shrinks back: grow again from where it is, nothing jumps
			openItem = item;
			item.g.classList.add('is-open');
			item.g.setAttribute('aria-expanded', 'true');
			playMorph(item, false);
			if (focusInside) {
				(pop.querySelector('a') || popClose).focus();
			}
			return;
		}
		closePop(false, true);
		hideCard(); // also ends a card still shrinking back
		openItem = item;
		popBody.replaceChildren(...(item.bio ? [bioSection()] : item.st.entries.map(section)));
		pop.classList.toggle('m-pop--bio', !!item.bio);
		pop.hidden = false;
		item.g.classList.add('is-open');
		item.g.setAttribute('aria-expanded', 'true');
		// the bio card repeats the name and role, so the hub's own labels step aside for it
		svg.classList.toggle('is-bio', !!item.bio);
		setEdge(item);
		placePop();
		playMorph(item, false);
		if (focusInside) {
			(pop.querySelector('a') || popClose).focus();
		}
	}

	// the card's border is the outline of the node it came from: its colour, at the weight it is drawn on screen (a dashed
	// 'soon' node's card gets the solid outline the other nodes have)
	let edge = { stroke: '', width: 1 };
	function setEdge(item) {
		const soon = item.g.classList.contains('st--soon');
		const glyph = getComputedStyle((soon ? document.querySelector('.st:not(.st--soon) .st-glyph') : null) || item.g.querySelector('.st-glyph'));
		// whole pixels, as browsers draw borders, so the moving outline and the card's border are the same weight
		const width = Math.max(1, Math.round(parseFloat(getComputedStyle(item.g.querySelector('.st-glyph')).strokeWidth) * 1.22 * cam.k));
		edge = { stroke: glyph.stroke, width };
		pop.style.setProperty('--map-card-edge', edge.stroke);
		pop.style.setProperty('--map-card-edge-w', width + 'px');
	}

	// instant skips the morph, for when another card takes its place
	function closePop(returnFocus, instant) {
		if (!openItem) {
			return;
		}
		const item = openItem;
		openItem = null;
		item.g.classList.remove('is-open');
		item.g.setAttribute('aria-expanded', 'false');
		if (!instant) {
			playMorph(item, true);
		} else {
			hideCard();
		}
		if (returnFocus) {
			item.g.focus({ preventScroll: true });
		}
	}

	// the card stays centred on its shape as the map moves, held on screen between the name and the dock
	function placePop() {
		if (!openItem) {
			return;
		}
		const [sx, sy] = toScreen(openItem.x, openItem.y);
		const roof = popRoof();
		const floor = popFloor();
		pop.style.maxHeight = Math.round(floor - roof) + 'px'; // a card taller than that scrolls
		const w = pop.offsetWidth;
		const h = pop.offsetHeight;
		popAt = [Math.round(clamp(sx - w / 2, 16, vw - 16 - w)), Math.round(clamp(sy - h / 2, roof, floor - h))];
		pop.style.transform = 'translate(' + popAt[0] + 'px,' + popAt[1] + 'px)';
	}

	popClose.addEventListener('click', () => closePop(true));

	// ---------- list fallback ----------
	function openList() {
		list.classList.add('is-open');
		closePop(false);
		list.focus();
	}
	function closeList() {
		list.classList.remove('is-open');
		view.focus({ preventScroll: true });
	}
	document.querySelectorAll('[data-list="open"]').forEach((b) => b.addEventListener('click', openList));
	document.querySelectorAll('[data-list="close"]').forEach((b) => b.addEventListener('click', closeList));
	if (location.hash === '#list' || location.hash === '#metro-list') {
		list.classList.add('is-open');
	}

	// ---------- intro ----------
	const intro = { on: false, t: 0, dur: 2600 };
	const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
	const clamp01 = (t) => Math.max(0, Math.min(1, t));

	function introFrame() {
		const p = clamp01(intro.t / intro.dur);
		const rest = restView();
		const k = rest.k * (2.4 - 1.4 * ease(p));
		setCam(k, HUB[0] + (rest.cx - HUB[0]) * ease(p), HUB[1] + (rest.cy - HUB[1]) * ease(p));
		const draw = ease(clamp01(intro.t / 1800));
		drawables.forEach((d) => {
			const q = clamp01((draw - d.delay) / (1 - d.delay));
			d.el.style.strokeDashoffset = String(d.len * (1 - q));
			d.reach = q * d.len;
		});
		stationEls.forEach((item) => {
			const r = drawables.find((d) => d.el === routes[item.line].path);
			const a = item.st.soon ? clamp01((intro.t - 500) / 400) : clamp01((r.reach - item.along + 20) / 60);
			item.g.style.opacity = a;
			item.label.style.opacity = a;
		});
		const late = clamp01((intro.t - 1700) / 700);
		fadeIns.forEach((n) => {
			n.style.opacity = late;
		});
		hubName.style.opacity = late;
		hubRole.style.opacity = late;
		gLive.style.opacity = clamp01((intro.t - 1900) / 700);
		if (p >= 1) {
			endIntro();
		}
	}

	function startIntro() {
		intro.on = true;
		intro.t = 0;
		drawables.forEach((d) => {
			d.el.style.strokeDasharray = d.len + ' ' + d.len;
		});
		introFrame();
	}

	function endIntro() {
		if (!intro.on) {
			return;
		}
		intro.on = false;
		drawables.forEach((d) => {
			d.el.style.strokeDasharray = '';
			d.el.style.strokeDashoffset = '';
		});
		stationEls.forEach((item) => {
			item.g.style.opacity = '';
			item.label.style.opacity = '';
		});
		fadeIns.concat([hubName, hubRole, gLive]).forEach((n) => {
			n.style.opacity = '';
		});
		const rest = restView();
		setCam(rest.k, rest.cx, rest.cy);
	}

	// ---------- live layer: trains, passengers, pulses ----------
	const PAX_POOL = 64;
	const pool = [];
	const gPax = el('g', {}, gLive);
	const gTrains = el('g', {}, gLive);
	const gPulse = el('g', {}, gLive);
	for (let i = 0; i < PAX_POOL; i++) {
		pool.push(el('path', { class: 'm-pax', d: '', visibility: 'hidden' }, gPax));
	}
	const pulses = [];
	for (let i = 0; i < 10; i++) {
		pulses.push({ node: el('circle', { class: 'm-pulse', r: 0, opacity: 0 }, gPulse), t: 1, x: 0, y: 0 });
	}

	const shapeKeys = ['circle', 'square', 'triangle', 'diamond'];
	let seed = 7;
	const rand = () => {
		seed = (seed * 16807) % 2147483647;
		return (seed - 1) / 2147483646;
	};

	function paxSlot(item, i) {
		const [, , dx, dy] = item.st.place;
		let dir = PAX_SIDE[item.st.id];
		if (!dir) {
			const len = Math.hypot(dx, dy) || 1;
			dir = [-dx / len, -dy / len];
		}
		const perp = [-dir[1] || 1, dir[0]];
		const bx = item.x + dir[0] * 20;
		const by = item.y + dir[1] * 20;
		const off = (i - 1.5) * 9;
		return [bx + perp[0] * off, by + perp[1] * off];
	}

	function relayout(item) {
		item.waiting.forEach((node, i) => {
			const [x, y] = paxSlot(item, i);
			node.setAttribute('d', glyphPath(node.dataset.shape, x, y, 6));
		});
	}

	function spawnAt(item) {
		if (item.waiting.length >= 4 || !pool.length) {
			return false;
		}
		const node = pool.pop();
		let shape = shapeKeys[Math.floor(rand() * 4)];
		if (shape === SHAPES[item.line]) {
			shape = shapeKeys[(shapeKeys.indexOf(shape) + 1) % 4];
		}
		node.dataset.shape = shape;
		node.setAttribute('visibility', 'visible');
		item.waiting.push(node);
		relayout(item);
		return true;
	}

	function pulseAt(item, line) {
		const p = pulses.find((q) => q.t >= 1);
		if (!p) {
			return;
		}
		p.t = 0;
		p.node.setAttribute('cx', item.x);
		p.node.setAttribute('cy', item.y);
		p.node.setAttribute('class', 'm-pulse m-pulse--' + line);
	}

	const trains = [];
	for (const key in routes) {
		const r = routes[key];
		for (let i = 0; i < LINES[key].trains; i++) {
			const g = el('g', { class: 'm-train m-train--' + key }, gTrains);
			el('rect', { x: -15, y: -9, width: 30, height: 18, rx: 3 }, g);
			const seats = [];
			for (let j = 0; j < 6; j++) {
				seats.push(el('circle', { cx: -7 + (j % 3) * 7, cy: j < 3 ? -3 : 3, r: 2, class: 'm-pax', visibility: 'hidden' }, g));
			}
			const frac = (i + 0.35) / LINES[key].trains;
			trains.push({ g, seats, r, s: r.len * frac, dir: i % 2 ? -1 : 1, dwell: 0, load: Math.floor(rand() * 3), speed: 46 + rand() * 10 });
		}
	}

	function placeTrain(tr) {
		const r = tr.r;
		const i = Math.max(0, Math.min(r.xs.length - 1, Math.round(tr.s / 2)));
		const a = Math.max(0, i - 3);
		const b = Math.min(r.xs.length - 1, i + 3);
		const ang = Math.atan2(r.ys[b] - r.ys[a], r.xs[b] - r.xs[a]) * 57.2958;
		tr.g.setAttribute('transform', 'translate(' + r.xs[i].toFixed(1) + ' ' + r.ys[i].toFixed(1) + ') rotate(' + ang.toFixed(1) + ')');
	}

	function showLoad(tr) {
		tr.seats.forEach((seat, j) => seat.setAttribute('visibility', j < tr.load ? 'visible' : 'hidden'));
	}

	function arrive(tr, stop) {
		const item = stop.item;
		tr.dwell = 0.9;
		const off = Math.floor(rand() * (tr.load + 1));
		tr.load -= off;
		while (item.waiting.length && tr.load < 6) {
			const node = item.waiting.pop();
			node.setAttribute('visibility', 'hidden');
			pool.push(node);
			tr.load++;
		}
		relayout(item);
		showLoad(tr);
		pulseAt(item, tr.r.key);
	}

	function stepTrain(tr, dt) {
		if (tr.dwell > 0) {
			tr.dwell -= dt;
			return;
		}
		const from = tr.s;
		let to = from + tr.dir * tr.speed * dt;
		if (to >= tr.r.len || to <= 0) {
			to = Math.max(0, Math.min(tr.r.len, to));
			tr.dir = -tr.dir;
			tr.dwell = 1.2;
		}
		const lo = Math.min(from, to);
		const hi = Math.max(from, to);
		for (const stop of tr.r.stops) {
			if (stop.s > lo && stop.s <= hi && stop.s !== from) {
				to = stop.s;
				tr.s = to;
				arrive(tr, stop);
				placeTrain(tr);
				return;
			}
		}
		tr.s = to;
		placeTrain(tr);
	}

	// seed a calm starting state (also the frozen state under reduced motion)
	liveStops.forEach((item, i) => {
		const n = i % 3;
		for (let j = 0; j < n; j++) {
			spawnAt(item);
		}
	});
	trains.forEach((tr) => {
		placeTrain(tr);
		showLoad(tr);
	});

	let spawnIn = 0.6;
	let idlePulseIn = 1.4;

	function stepLive(dt) {
		trains.forEach((tr) => stepTrain(tr, dt));
		spawnIn -= dt;
		if (spawnIn <= 0) {
			spawnIn = 0.5 + rand() * 0.9;
			spawnAt(liveStops[Math.floor(rand() * liveStops.length)]);
		}
		idlePulseIn -= dt;
		if (idlePulseIn <= 0) {
			idlePulseIn = 1.2 + rand() * 1.6;
			const item = liveStops[Math.floor(rand() * liveStops.length)];
			pulseAt(item, item.line);
		}
		pulses.forEach((p) => {
			if (p.t >= 1) {
				return;
			}
			p.t = Math.min(1, p.t + dt / 1.4);
			p.node.setAttribute('r', (13 + 13 * p.t).toFixed(1));
			p.node.setAttribute('opacity', (0.45 * (1 - p.t)).toFixed(3));
		});
	}

	// ---------- the one loop ----------
	let raf = 0;
	let last = 0;

	function frame(now) {
		const dt = Math.min(0.05, (now - last) / 1000 || 0);
		last = now;
		if (intro.on) {
			intro.t += dt * 1000;
			introFrame();
		}
		stepLive(dt);
		raf = requestAnimationFrame(frame);
	}

	function startLoop() {
		if (raf || reduceQuery.matches || document.hidden) {
			return;
		}
		last = performance.now();
		raf = requestAnimationFrame(frame);
	}

	function stopLoop() {
		if (raf) {
			cancelAnimationFrame(raf);
		}
		raf = 0;
	}

	document.addEventListener('visibilitychange', () => (document.hidden ? stopLoop() : startLoop()));
	reduceQuery.addEventListener('change', () => {
		if (reduceQuery.matches) {
			endIntro();
			stopLoop();
			pulses.forEach((p) => {
				p.t = 1;
				p.node.setAttribute('opacity', 0);
			});
		} else {
			startLoop();
		}
	});

	// ---------- input ----------
	const pointers = new Map();
	let drag = null;

	function stationFrom(target) {
		const g = target && target.closest ? target.closest('.st[data-id]') : null;
		if (!g) {
			return null;
		}
		return g === hub ? hubItem : stationEls.get(g.dataset.id);
	}

	view.addEventListener('pointerdown', (e) => {
		endIntro();
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pointers.size === 1) {
			drag = { x: e.clientX, y: e.clientY, tx: cam.tx, ty: cam.ty, moved: false, item: stationFrom(e.target) };
		} else if (pointers.size === 2) {
			const [a, b] = Array.from(pointers.values());
			drag = { pinch: true, d: Math.hypot(a.x - b.x, a.y - b.y), k: cam.k, moved: true, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
		}
		view.setPointerCapture(e.pointerId);
	});

	view.addEventListener('pointermove', (e) => {
		if (!pointers.has(e.pointerId) || !drag) {
			return;
		}
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (drag.pinch && pointers.size >= 2) {
			const [a, b] = Array.from(pointers.values());
			const d = Math.hypot(a.x - b.x, a.y - b.y);
			const mx = (a.x + b.x) / 2;
			const my = (a.y + b.y) / 2;
			cam.tx += mx - drag.mx;
			cam.ty += my - drag.my;
			drag.mx = mx;
			drag.my = my;
			zoomAt((drag.k * d / drag.d) / cam.k, mx, my);
			return;
		}
		if (drag.pinch) {
			return;
		}
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		if (!drag.moved && Math.hypot(dx, dy) > 6) {
			drag.moved = true;
			view.classList.add('is-dragging');
		}
		if (drag.moved) {
			cam.tx = drag.tx + dx;
			cam.ty = drag.ty + dy;
			applyCam();
		}
	});

	function endPointer(e) {
		if (!pointers.has(e.pointerId)) {
			return;
		}
		pointers.delete(e.pointerId);
		if (drag && !drag.moved && e.type === 'pointerup') {
			if (drag.item) {
				openStation(drag.item, false);
			} else {
				closePop(false);
			}
		}
		if (pointers.size === 0) {
			drag = null;
			view.classList.remove('is-dragging');
		} else if (drag && drag.pinch) {
			drag = { x: 0, y: 0, tx: cam.tx, ty: cam.ty, moved: true, pinch: true };
		}
	}
	view.addEventListener('pointerup', endPointer);
	view.addEventListener('pointercancel', endPointer);

	view.addEventListener('wheel', (e) => {
		e.preventDefault();
		endIntro();
		const unit = e.deltaMode === 1 ? 16 : 1;
		const rate = e.ctrlKey ? 0.01 : 0.0018; // trackpad pinch arrives as ctrl + wheel
		zoomAt(Math.exp(-e.deltaY * unit * rate), e.clientX, e.clientY);
	}, { passive: false });

	// hover: highlight the station and show its label even when zoomed far out
	gStations.addEventListener('pointerover', (e) => {
		const item = stationFrom(e.target);
		if (item) {
			item.g.classList.add('is-hot');
			item.label.classList.add('is-hot');
		}
	});
	gStations.addEventListener('pointerout', (e) => {
		const item = stationFrom(e.target);
		if (item && !item.g.contains(e.relatedTarget)) {
			item.g.classList.remove('is-hot');
			item.label.classList.remove('is-hot');
		}
	});

	view.addEventListener('focusin', (e) => {
		const item = stationFrom(e.target);
		if (!item) {
			return;
		}
		item.label.classList.add('is-hot');
		const [sx, sy] = toScreen(item.x, item.y);
		if (sx < 80 || sy < 80 || sx > vw - 80 || sy > vh - 80) {
			cam.tx += vw / 2 - sx;
			cam.ty += vh / 2 - sy;
			applyCam();
		}
	});
	view.addEventListener('focusout', (e) => {
		const item = stationFrom(e.target);
		if (item) {
			item.label.classList.remove('is-hot');
		}
	});

	document.addEventListener('keydown', (e) => {
		if (intro.on) {
			endIntro();
		}
		if (e.key === 'Escape') {
			if (openItem) {
				closePop(true);
			} else if (list.classList.contains('is-open')) {
				closeList();
			}
			return;
		}
		const inMap = view.contains(document.activeElement);
		if (!inMap) {
			return;
		}
		const item = stationFrom(document.activeElement);
		if (item && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			openStation(item, true);
			return;
		}
		const pan = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[e.key];
		if (pan) {
			e.preventDefault();
			cam.tx += pan[0];
			cam.ty += pan[1];
			applyCam();
		} else if (e.key === '+' || e.key === '=') {
			zoomAt(1.25, vw / 2, vh / 2);
		} else if (e.key === '-' || e.key === '_') {
			zoomAt(0.8, vw / 2, vh / 2);
		} else if (e.key === '0') {
			const rest = restView();
			setCam(rest.k, rest.cx, rest.cy);
		}
	});

	document.addEventListener('pointerdown', (e) => {
		if (openItem && !pop.contains(e.target) && !view.contains(e.target)) {
			closePop(false);
		}
	});

	window.addEventListener('resize', () => {
		const cx = (vw / 2 - cam.tx) / cam.k;
		const cy = (vh / 2 - cam.ty) / cam.k;
		vw = view.clientWidth;
		vh = view.clientHeight;
		setCam(cam.k, cx, cy);
	});

	// ---------- the Online cursor: drift to a station, pause, drift on ----------
	let toStation = true;
	window.homeCursorTarget = function () {
		if (reduceQuery.matches || intro.on) {
			return null;
		}
		toStation = !toStation;
		if (toStation) {
			return null; // helix picks a random point and a random wait
		}
		const visible = liveStops.filter((item) => {
			const [sx, sy] = toScreen(item.x, item.y);
			return sx > 160 && sx < vw - 200 && sy > 100 && sy < vh - 160;
		});
		if (!visible.length) {
			return null;
		}
		const item = visible[Math.floor(Math.random() * visible.length)];
		const [sx, sy] = toScreen(item.x, item.y);
		return { left: sx - 6, top: sy - 4, delay: 3000 + 1200 + Math.random() * 1400 };
	};

	// ---------- start ----------
	if (reduceQuery.matches || location.hash === '#list' || new URLSearchParams(location.search).has('nointro')) {
		const rest = restView();
		setCam(rest.k, rest.cx, rest.cy);
	} else {
		startIntro();
	}
	startLoop();

	// test hook: a read-only view of state for the checks in the PR package
	window.__metro = { cam, stations: stationEls, open: (id) => openStation(id === 'hub' ? hubItem : stationEls.get(id), false), endIntro, restView, intro, trains };
});
