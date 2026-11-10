// The home screen (Glass). It builds its DOM once, then only updates classes and art
// on focus changes, so remote presses stay fast on the TV's chip.
//   rows(st)        -> number of items in each focus row (row 0 is the header, owned by main.js)
//   build(st)       -> fill #stage
//   focus(st)       -> reflect st.row / st.col / st.app
//   activate(st)    -> entry to open, or null
(function (TH) {
  'use strict';

  var el = TH.el;
  var bg = { front: null, back: null, url: '' };

  // Two stacked layers crossfade; the new image is decoded before it is shown.
  function showArt(url) {
    if (!bg.front) {
      bg.front = document.getElementById('bgA');
      bg.back = document.getElementById('bgB');
    }
    if (!url || url === bg.url) { return; }
    bg.url = url;
    var img = new Image();
    img.onload = function () {
      if (bg.url !== url) { return; }
      bg.back.style.backgroundImage = 'url("' + url + '")';
      bg.back.classList.add('on');
      bg.front.classList.remove('on');
      var t = bg.front; bg.front = bg.back; bg.back = t;
    };
    img.src = url;
  }

  function tile(entry) {
    var t = el('div', 'tile');
    t.style.backgroundColor = entry.color;
    if (entry.glow) { t.style.setProperty('--glow', entry.glow); }
    if (entry.logo || entry.wordmark) {
      t.classList.add('brand');
      t.style.color = entry.fg;
      var mark = el('span', entry.logo ? 'logo' : 'wordmark', entry.wordmark || '');
      if (entry.logo) {
        mark.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="' + TH.LOGOS[entry.logo] + '"/></svg>';
      }
      t.appendChild(mark);
      return t;
    }
    if (entry.icon) {
      var img = el('img', 'icon');
      img.src = entry.icon;
      img.onerror = function () { img.remove(); };
      t.appendChild(img);
    }
    var label = el('span', 'name', entry.name);
    if (entry.sub) { label.appendChild(el('small', '', entry.sub)); }
    t.appendChild(label);
    return t;
  }

  function current(st) { var items = TH.art.items(st.entries[st.app], st.app); return items[st.item % items.length]; }

  function copyBlock() {
    var box = el('div', 'copy');
    box.appendChild(el('span', 'kicker'));
    box.appendChild(el('p', 'big'));
    box.appendChild(el('span', 'meta'));
    return box;
  }
  function fillCopy(box, kicker, title, meta) {
    box.children[0].textContent = kicker;
    box.children[1].textContent = title;
    box.children[2].textContent = meta;
  }

  // ---------- Glass ----------
  // Full-screen art with the title top left, and the apps in a see-through dock along the bottom.
  // The dock is a tint, not a live blur: blurring the art behind it costs too much on a TV chip.
  // The dock scrolls so the focused app is always on screen, however many apps there are.
  var DOCK_STEP = 278, DOCK_VISIBLE = 6;  // tile width + gap, and how many tiles fit in the dock

  // Clock at the top: greeting, date with the weather, and the time.
  var widget = null;
  function greeting(hour) {
    return hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' :
      hour < 23 ? 'Good evening' : 'Good night';
  }
  function paintWidget() {
    if (!widget || !widget.parentNode) { return; }
    var now = new Date(), name = (window.TVHOME_ME || {}).name, weather = TH.weather();
    widget.children[0].textContent = greeting(now.getHours()) + (name ? ', ' + name : '');
    widget.children[1].textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) +
      (weather ? '  ·  ' + weather : '');
    widget.children[2].textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
  }
  setInterval(function () {
    if (!widget || !widget.parentNode) { return; }
    TH.refreshWeather(paintWidget);  // does nothing while the reading is fresh
    paintWidget();
  }, 10000);

  var glass = {
    name: 'Glass',
    rows: function (st) { return [st.entries.length]; },
    build: function (st, stage) {
      widget = el('div', 'widget');
      widget.appendChild(el('span', 'greet'));
      widget.appendChild(el('span', 'date'));
      widget.appendChild(el('b', 'time'));
      stage.appendChild(widget);
      paintWidget();
      TH.refreshWeather(paintWidget);
      this.copy = copyBlock();
      var chevron = el('div', 'chevron');
      chevron.innerHTML = '<svg viewBox="0 0 44 16" fill="none" stroke="currentColor" stroke-width="3.5" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M4 13 22 4l18 9"/></svg>';
      var dock = el('div', 'glassdock');
      this.track = el('div', 'row apps track');
      this.tiles = st.entries.map(function (e) { var t = tile(e); this.track.appendChild(t); return t; }, this);
      dock.appendChild(this.track);
      [chevron, this.copy, dock].forEach(function (n) { stage.appendChild(n); });
    },
    focus: function (st) {
      var it = current(st), entry = st.entries[st.app], n = st.entries.length;
      this.tiles.forEach(function (t, i) { t.classList.toggle('on', st.row === 1 && i === st.app); });
      var first = Math.max(0, Math.min(st.app - (DOCK_VISIBLE - 2), n - DOCK_VISIBLE));
      this.track.style.transform = 'translateX(' + (-first * DOCK_STEP) + 'px)';
      fillCopy(this.copy, entry.name + (entry.sub ? ' · ' + entry.sub : ''), it.title, it.sub);
      showArt(it.backdrop);
    },
    activate: function (st) { return st.entries[st.app]; }
  };

  TH.styles = { glass: glass };
})(window.TH);
