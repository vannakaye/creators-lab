// Creators Lab: the little bit of JavaScript the site needs. Everything works without it
// except the player, filters and search.
(() => {
  const C = window.CL_CONFIG || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rpc = async (fn, body) => {
    if (!C.supabaseUrl || !C.supabaseKey) throw new Error('offline');
    const r = await fetch(`${C.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: C.supabaseKey, Authorization: `Bearer ${C.supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) { const t = await r.json().catch(() => ({})); throw new Error(t.message || 'Something went wrong'); }
    return r.status === 204 ? null : r.json().catch(() => null);
  };

  // ---------- Menu ----------
  const menu = $('#site-menu');
  const openBtn = $('[data-menu-open]');
  const setMenu = (open) => {
    if (!menu) return;
    menu.hidden = !open;
    openBtn?.setAttribute('aria-expanded', String(open));
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open) $('input', menu)?.focus(); else openBtn?.focus();
  };
  openBtn?.addEventListener('click', () => setMenu(true));
  $('[data-menu-close]')?.addEventListener('click', () => setMenu(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu && !menu.hidden) setMenu(false); });

  // ---------- Effects helpers ----------
  document.documentElement.classList.add('fx');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Puts the hand-drawn ellipse around a target, relative to its positioned wrapper
  const placeInk = (wrap, target, ink, padX = 14, padY = 2, tilt = -4) => {
    if (!target || !ink) return false;
    const r = target.getBoundingClientRect(); const w = wrap.getBoundingClientRect();
    ink.style.width = `${r.width + padX * 2}px`;
    ink.style.height = `${r.height + padY * 2}px`;
    ink.style.transform = `translate(${r.left - w.left - padX}px, ${r.top - w.top - padY}px) rotate(${tilt}deg)`;
    return true;
  };

  // ---------- Photographs develop as they load ----------
  const develop = (img) => {
    if (img.complete && img.naturalWidth) return;
    img.classList.add('is-pending');
    const done = () => img.classList.remove('is-pending');
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  };
  $$('img.img').forEach(develop);

  // ---------- Lines: every rendered line rises from behind its own mask ----------
  // The timing follows the Codrops Superfluid layout: 1.2s expo out, 40ms apart, from a 15 degree tilt.
  const EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)'; const SOFT = 'cubic-bezier(0.33, 1, 0.68, 1)';
  const fontsReady = () => Promise.race([document.fonts?.ready || Promise.resolve(), wait(1200)]);
  const splitEls = new Set();
  // Wraps one element so it can rise as a single line
  const mask = (el) => {
    if (!el) return null;
    if (el.parentElement?.classList.contains('ln__i')) return el.parentElement;
    const o = document.createElement('span'); o.className = 'ln ln--unit';
    const inner = document.createElement('span'); inner.className = 'ln__i';
    el.replaceWith(o); inner.append(el); o.append(inner);
    return inner;
  };
  // Breaks an element's plain text into one masked span per line, as the browser laid it out
  const split = (el) => {
    if (!el) return [];
    const w = el.clientWidth;
    if (el._lines && el._w === w) return el._lines;
    const text = el._text ?? (el._text = el.textContent.replace(/\s+/g, ' ').trim());
    el.style.setProperty('--ln-indent', getComputedStyle(el).textIndent);
    el.textContent = '';
    const words = text.split(' ').map((t, k) => { const sp = document.createElement('span'); sp.textContent = t; if (k) el.append(' '); el.append(sp); return sp; });
    const lines = []; let top = null;
    for (const sp of words) { if (sp.offsetTop !== top) { lines.push([]); top = sp.offsetTop; } lines[lines.length - 1].push(sp.textContent); }
    el.textContent = '';
    el._lines = lines.map((ws) => {
      const o = document.createElement('span'); o.className = 'ln';
      const inner = document.createElement('span'); inner.className = 'ln__i'; inner.textContent = ws.join(' ');
      o.append(inner); el.append(o); return inner;
    });
    el._w = w; splitEls.add(el);
    return el._lines;
  };
  let resplitT;
  addEventListener('resize', () => { clearTimeout(resplitT); resplitT = setTimeout(() => splitEls.forEach(split), 150); });
  const rise = (els, { delay = 0, stagger = 40 } = {}) => els.filter(Boolean).forEach((el, k) => el.animate(
    [{ transform: 'translateY(150%) rotate(15deg)' }, { transform: 'none' }],
    { duration: 1200, delay: delay + k * stagger, easing: EXPO, fill: 'backwards' }));
  const sink = (els, { stagger = 20 } = {}) => els.filter(Boolean).map((el, k) => el.animate(
    [{ transform: 'none' }, { transform: 'translateY(-150%) rotate(-5deg)' }],
    { duration: 700, delay: k * stagger, easing: SOFT, fill: 'forwards' }));
  // The image is drawn up like a blind: the frame rises while the picture inside holds still
  const curtain = (media, delay = 0) => {
    if (!media) return;
    const o = { duration: 1200, delay, easing: EXPO, fill: 'backwards' };
    media.animate([{ transform: 'translateY(101%)' }, { transform: 'none' }], o);
    Array.from(media.children).forEach((c) => c.animate([{ transform: 'translateY(-101%)' }, { transform: 'none' }], o));
  };

  // ---------- Lead story: lines and image reveal on load, and between stories ----------
  const lead = $('[data-lead]');
  if (lead) {
    const slides = $$('.lead__slide', lead);
    const n = slides.length; let i = 0; let moving = false;
    const lines = (sl) => [mask($('.label', sl)), ...split($('.lead__hl', sl)), mask($('.lead__foot', sl))];
    const show = (sl, delay = 0) => {
      curtain($('.lead__media', sl), delay);
      rise(lines(sl), { delay: delay + 150 });
      $('.progress', sl)?.animate([{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 1200, delay: delay + 350, easing: EXPO, fill: 'backwards' });
      $('.sticker', sl)?.animate([{ transform: 'scale(0) rotate(-30deg)' }, { transform: 'none' }], { duration: 1200, delay: delay + 450, easing: EXPO, fill: 'backwards' });
    };
    const setActive = (next) => {
      const prev = i;
      slides.forEach((sl, k) => {
        const on = k === next;
        sl.classList.toggle('is-active', on);
        sl.toggleAttribute('aria-hidden', !on);
        $$('a, button', sl).forEach((el) => (on ? el.removeAttribute('tabindex') : el.setAttribute('tabindex', '-1')));
      });
      const track = $('.odo__track', slides[next]);
      if (track) { track.style.transition = 'none'; track.style.setProperty('--k', prev); void track.offsetHeight; track.style.transition = ''; track.style.setProperty('--k', next); }
      i = next;
    };
    const go = async (next) => {
      if (moving || next === i || n < 2) return;
      if (reduced) { setActive(next); return; }
      moving = true;
      const prev = slides[i];
      const outs = sink(lines(prev));
      outs.push($('.progress', prev)?.animate([{ transform: 'none' }, { transform: 'scaleX(0)' }], { duration: 500, easing: SOFT, fill: 'forwards' }));
      outs.push($('.sticker', prev)?.animate([{ transform: 'none' }, { transform: 'scale(0)' }], { duration: 500, easing: SOFT, fill: 'forwards' }));
      outs.push($('.lead__media img', prev)?.animate([{ transform: 'none' }, { transform: 'translateY(-6%)' }], { duration: 1200, delay: 250, easing: EXPO, fill: 'forwards' }));
      prev.classList.add('is-leaving');
      setActive(next);
      show(slides[next], 250);
      await wait(250 + 1200);
      prev.classList.remove('is-leaving');
      outs.forEach((a) => a?.cancel());
      moving = false;
    };
    if (reduced) lead.classList.add('is-ready');
    else {
      let started = false;
      const start = async () => {
        if (started) return; started = true;
        await fontsReady();
        slides.forEach(lines); // split every slide now, while nothing is moving
        lead.classList.add('is-ready');
        show(slides[0]);
      };
      const img = $('.lead__slide.is-active img', lead);
      if (!img || (img.complete && img.naturalWidth)) start();
      else { img.addEventListener('load', start, { once: true }); img.addEventListener('error', start, { once: true }); setTimeout(start, 1200); }
    }
    if (n > 1 && !reduced) {
      lead.classList.add('is-auto');
      lead.addEventListener('animationend', (e) => { if (e.animationName === 'cl-tick') go((i + 1) % n); });
      if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => lead.classList.toggle('is-paused', !en.isIntersecting)).observe(lead);
      document.addEventListener('visibilitychange', () => lead.classList.toggle('is-paused', document.hidden));
    }
    $$('[data-go]', lead).forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.go))));
    lead.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') go((i + 1) % n);
      if (e.key === 'ArrowLeft') go((i - 1 + n) % n);
    });
  }

  // ---------- Article headline and standfirst rise line by line ----------
  const head = $('.a-head');
  if (head && !reduced) {
    fontsReady().then(() => {
      const ls = $$(':scope > .a-title, :scope > .a-dek', head).flatMap(split);
      head.classList.add('is-ready');
      rise(ls);
    });
  }

  // ---------- The ellipse travels between tabs ----------
  $$('[data-ink]').forEach((wrap) => {
    const ink = $('.tabs__ink', wrap);
    const place = () => placeInk(wrap, $('.tab[aria-current], .tab[aria-pressed="true"]', wrap), ink);
    ink.style.transition = 'none';
    if (place()) wrap.classList.add('has-ink');
    void ink.offsetHeight; ink.style.transition = '';
    wrap.addEventListener('click', (e) => { if (e.target.closest('button.tab')) requestAnimationFrame(place); });
    addEventListener('resize', place);
    document.fonts?.ready?.then(place);
  });

  // ---------- Filterable, staggered grids ----------
  $$('[data-filter-grid]').forEach((wrap) => {
    const tpl = $('template[data-cards]', wrap);
    if (!tpl) return;
    const cards = Array.from(tpl.content.children);
    const by = wrap.dataset.filterBy || 'format';
    const limit = Number(wrap.dataset.limit || 6);
    const page = Number(wrap.dataset.page || 0);
    const more = $('[data-more]', wrap);
    // one filterable grid per page, so every filter button on the page drives it
    const buttons = $$('.tabs [data-filter]');
    let filter = 'all'; let shown = limit;
    const render = () => {
      const pool = cards.filter((c) => filter === 'all' || c.dataset[by] === filter);
      const items = pool.slice(0, shown).map((c, n) => {
        const el = c.cloneNode(true);
        el.classList.toggle('card--featured', n === 0 && !page);
        return el;
      });
      const grid = document.createElement('div'); grid.className = 'grid';
      items.forEach((el) => grid.appendChild(el));
      const old = $('.grid', wrap) || $('.empty', wrap);
      if (old) old.replaceWith(grid); else wrap.prepend(grid);
      $$('img.img', grid).forEach(develop);
      if (!items.length) grid.outerHTML = '<p class="empty">Nothing in this section yet.</p>';
      if (more) more.parentElement.hidden = pool.length <= shown;
    };
    buttons.forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.filter; shown = limit;
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      render();
    }));
    more?.addEventListener('click', () => { shown += page || limit; render(); });
  });

  // ---------- Read counts (one per story per browser session) ----------
  const story = $('[data-story]');
  if (story) {
    const key = `cl-read-${story.dataset.story}`;
    try {
      if (!sessionStorage.getItem(key)) {
        setTimeout(() => { rpc('track_view', { p_code: Number(story.dataset.story) }).catch(() => {}); }, 4000);
        sessionStorage.setItem(key, '1');
      }
    } catch { /* private mode */ }
  }

  // ---------- Copy link ----------
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Done'; setTimeout(() => { b.textContent = 'Link'; }, 1600); } catch { /* ignore */ }
  }));

  // ---------- Contents: the ellipse follows you down the article ----------
  const toc = $('[data-toc]');
  if (toc) {
    const ink = $('.toc__ink', toc);
    const links = $$('a', toc);
    const targets = links.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
    let cur = null;
    const set = (a) => {
      if (a === cur) return; cur = a;
      links.forEach((l) => l.classList.toggle('is-current', l === a));
      if (a && placeInk(toc, $('span', a), ink, 9, 2, -3)) toc.classList.add('has-ink'); else toc.classList.remove('has-ink');
    };
    let ticking = false;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        let best = -1;
        targets.forEach((t, k) => { if (t && t.getBoundingClientRect().top < innerHeight * 0.35) best = k; });
        set(best >= 0 ? links[best] : null);
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', () => { const c = cur; cur = null; set(c); });
    onScroll();
  }

  // ---------- Reading progress, where CSS scroll timelines are not supported ----------
  const readbar = $('.readbar');
  if (readbar && !(window.CSS && CSS.supports('animation-timeline: scroll()'))) {
    const upd = () => { const h = document.documentElement.scrollHeight - innerHeight; readbar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`; };
    addEventListener('scroll', upd, { passive: true }); upd();
  }

  // ---------- Citations preview their source ----------
  const body = $('.body[data-story]');
  if (body && matchMedia('(hover: hover)').matches) {
    const pop = document.createElement('div');
    pop.className = 'cite-pop'; pop.id = 'cite-pop'; pop.setAttribute('role', 'tooltip');
    document.body.appendChild(pop);
    let hideT = null;
    const show = (a) => {
      const n = a.getAttribute('href').replace('#src-', '');
      const li = document.getElementById(`src-${n}`);
      if (!li) return;
      clearTimeout(hideT);
      pop.innerHTML = `<b>[ Source ${n} ]</b>${li.lastElementChild.innerHTML}`;
      a.setAttribute('aria-describedby', 'cite-pop');
      const r = a.getBoundingClientRect();
      const pw = pop.offsetWidth; const ph = pop.offsetHeight;
      const x = Math.max(16, Math.min(r.left + scrollX + r.width / 2 - pw / 2, document.documentElement.clientWidth - pw - 16));
      const above = r.top - ph - 12 > 70;
      pop.style.left = `${x}px`;
      pop.style.top = `${(above ? r.top - ph - 10 : r.bottom + 10) + scrollY}px`;
      pop.classList.add('on');
    };
    const hide = (a) => { a.removeAttribute('aria-describedby'); hideT = setTimeout(() => pop.classList.remove('on'), 60); };
    $$('sup a[href^="#src-"]', body).forEach((a) => {
      a.addEventListener('mouseenter', () => show(a)); a.addEventListener('mouseleave', () => hide(a));
      a.addEventListener('focus', () => show(a)); a.addEventListener('blur', () => hide(a));
    });
  }

  // ---------- The card image becomes the article hero (cross-document view transitions) ----------
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
    let box = a.querySelector('.card__img[data-vt]');
    if (!box && a.dataset.vtLink) box = a.closest('.lead__slide')?.querySelector('img');
    if (!box && a.matches('.mostread__img')) box = a;
    if (!box) return;
    $$('.vt-hero').forEach((h) => { h.style.viewTransitionName = 'none'; });
    box.style.viewTransitionName = 'story-hero';
  });
  addEventListener('pagereveal', (e) => {
    try {
      const from = window.navigation?.activation?.from?.url;
      if (!e.viewTransition || !from || document.querySelector('.vt-hero')) return;
      const norm = (u) => new URL(u, location.href).pathname.replace(/index\.html$/, '').replace(/\/$/, '');
      const path = norm(from);
      const card = $$('a.card').find((c) => norm(c.href) === path);
      const box = card?.querySelector('.card__img');
      if (box) { box.style.viewTransitionName = 'story-hero'; e.viewTransition.finished.finally(() => { box.style.viewTransitionName = ''; }); }
    } catch { /* not supported */ }
  });
  addEventListener('pageshow', () => { $$('.card__img[data-vt], .lead__slide img, .mostread__img').forEach((b) => { b.style.viewTransitionName = ''; }); $$('.vt-hero').forEach((h) => { h.style.viewTransitionName = ''; }); });

  // ---------- Press G for the layout grid ----------
  addEventListener('keydown', (e) => {
    if ((e.key !== 'g' && e.key !== 'G') || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = document.activeElement;
    if (el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)) return;
    let g = $('.gridlines');
    if (!g) {
      g = document.createElement('div'); g.className = 'gridlines'; g.setAttribute('aria-hidden', 'true');
      g.innerHTML = '<div class="gridlines__base"></div><div class="gridlines__cols"></div><div class="gridlines__read"></div>';
      document.body.appendChild(g);
    }
    const c = $('.content')?.getBoundingClientRect();
    if (c) {
      const pad = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pad')) || 64;
      const width = c.width - pad * 2; const col = (width - 24 * 11) / 12;
      g.style.setProperty('--gl', `${c.left + pad}px`); g.style.setProperty('--gw', `${width}px`); g.style.setProperty('--gc', `${col}px`);
      $('.gridlines__read', g).textContent = `[ Grid ] 12 columns of ${Math.round(col)}px, 24px gutters, 8px baseline. G to hide.`;
    }
    g.classList.toggle('on');
  });

  // ---------- Transcript ----------
  $$('[data-transcript]').forEach((b) => b.addEventListener('click', () => {
    const t = document.getElementById(b.getAttribute('aria-controls'));
    const open = t.hidden; t.hidden = !open; b.setAttribute('aria-expanded', String(open));
    b.textContent = open ? 'Hide the transcript' : 'Read the full transcript';
  }));

  // ---------- Podcast player ----------
  const audio = $('[data-audio]');
  const bar = $('[data-playerbar]');
  if (audio && bar) {
    const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`; };
    const playIcon = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M4 2l10 6-10 6z"/></svg>';
    const pauseIcon = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M4 2h3v12H4zM9 2h3v12H9z"/></svg>';
    let current = null; const rates = [1, 1.25, 1.5, 2, 0.75]; let ri = 0;
    const toggleBtn = $('[data-pb-toggle]', bar);
    const sync = () => {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      $('[data-pb-cur]', bar).textContent = fmt(audio.currentTime);
      $('[data-pb-dur]', bar).textContent = fmt(audio.duration || current?.dataset.duration);
      $('[data-pb-seek] span', bar).style.width = `${pct}%`;
      $('[data-pb-seek]', bar).setAttribute('aria-valuenow', String(Math.round(pct)));
      if (current) {
        $('[data-cur]', current).textContent = fmt(audio.currentTime);
        $('[data-seek] span', current).style.width = `${pct}%`;
      }
    };
    const setPlaying = (on) => {
      toggleBtn.innerHTML = on ? pauseIcon : playIcon; toggleBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
      $$('[data-player] [data-play]').forEach((b) => { const mine = b.closest('[data-player]') === current && on; b.innerHTML = mine ? pauseIcon : playIcon; b.setAttribute('aria-label', `${mine ? 'Pause' : 'Play'} ${b.closest('[data-player]').dataset.code}`); });
    };
    const load = (p) => {
      if (current !== p) {
        current = p; audio.src = p.dataset.src; audio.playbackRate = rates[ri];
        $('[data-pb-title]', bar).textContent = p.dataset.title;
        $('[data-pb-code]', bar).textContent = `[ ${p.dataset.code} ]`;
      }
      bar.hidden = false; requestAnimationFrame(() => bar.classList.add('is-open'));
    };
    $$('[data-player]').forEach((p) => {
      $('[data-play]', p).addEventListener('click', () => { if (current === p && !audio.paused) audio.pause(); else { load(p); audio.play(); } });
      $('[data-seek]', p).addEventListener('click', (e) => { load(p); const r = e.currentTarget.getBoundingClientRect(); const go = () => { audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; }; if (audio.duration) go(); else audio.addEventListener('loadedmetadata', go, { once: true }); audio.play(); });
    });
    $$('[data-seek-to]').forEach((b) => b.addEventListener('click', () => {
      const p = $('[data-player]'); if (!p) return; load(p);
      const t = Number(b.dataset.seekTo); const go = () => { audio.currentTime = t; audio.play(); };
      if (audio.readyState > 0) go(); else { audio.addEventListener('loadedmetadata', go, { once: true }); audio.load(); }
    }));
    toggleBtn.addEventListener('click', () => (audio.paused ? audio.play() : audio.pause()));
    $('[data-pb-seek]', bar).addEventListener('click', (e) => { const r = e.currentTarget.getBoundingClientRect(); if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; });
    $('[data-pb-rate]', bar).addEventListener('click', (e) => { ri = (ri + 1) % rates.length; audio.playbackRate = rates[ri]; e.currentTarget.textContent = `${rates[ri]}x`; });
    $('[data-pb-close]', bar).addEventListener('click', () => { audio.pause(); bar.classList.remove('is-open'); setTimeout(() => { bar.hidden = true; }, 220); });
    audio.addEventListener('timeupdate', sync); audio.addEventListener('loadedmetadata', sync);
    audio.addEventListener('play', () => setPlaying(true)); audio.addEventListener('pause', () => setPlaying(false));
    document.addEventListener('keydown', (e) => {
      if (!current || bar.hidden || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.target.closest?.('[data-pb-seek], [data-seek]') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { audio.currentTime += e.key === 'ArrowRight' ? 15 : -15; e.preventDefault(); }
    });
  }

  // ---------- Search ----------
  const form = $('[data-search-form]');
  if (form) {
    const input = $('input', form); const out = $('[data-search-results]');
    const params = new URLSearchParams(location.search);
    let index = null;
    const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const dateLabel = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' }).replace(/^(\w+) /, '$1, ');
    const run = async () => {
      const q = input.value.trim().toLowerCase();
      history.replaceState(null, '', q ? `?q=${encodeURIComponent(q)}` : location.pathname);
      if (!q) { out.innerHTML = ''; return; }
      if (!index) index = await fetch('../search-index.json').then((r) => r.json()).catch(() => []);
      const terms = q.split(/\s+/).filter(Boolean);
      const scored = index.map((it) => {
        const t = it.t.toLowerCase(), d = it.d.toLowerCase(), x = it.x.toLowerCase(), g = (it.g || '').toLowerCase();
        let score = 0;
        for (const term of terms) {
          if (!(t.includes(term) || d.includes(term) || x.includes(term) || g.includes(term) || (it.k || '').toLowerCase().includes(term))) return null;
          score += (t.includes(term) ? 10 : 0) + (d.includes(term) ? 4 : 0) + (g.includes(term) ? 3 : 0) + (x.split(term).length - 1);
        }
        return { it, score };
      }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 40);
      out.innerHTML = scored.length
        ? `<p class="label" style="margin-bottom:12px"><b>[ ${scored.length} result${scored.length === 1 ? '' : 's'} ]</b></p><ol class="list">${scored.map(({ it }) => `<li><span class="label"><b>[ ${esc(it.n)} ${esc(it.k)} ]</b>${esc(it.f)} · ${esc(dateLabel(it.p))}</span><a href="${esc(it.u)}">${esc(it.t)}</a><p class="card__dek">${esc(it.d)}</p></li>`).join('')}</ol>`
        : '<p class="empty">Nothing matches that yet.</p>';
    };
    let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 150); });
    form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
    if (params.get('q')) { input.value = params.get('q'); run(); }
    input.focus();
  }
})();
