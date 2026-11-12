// State, header, remote navigation and boot.
(function (TH) {
  'use strict';

  var KEY = TH.KEY, el = TH.el;
  var PREFS = 'tvhome.prefs.v1';
  var prefs = TH.load(PREFS, { app: 0 });
  var st = { entries: [], style: 'glass', row: 1, col: 0, app: 0, item: 0 };
  var header = [];  // { label, run }

  function style() { return TH.styles.glass; }
  function rows() { return [header.length].concat(style().rows(st)); }

  function buildHeader() {
    var nav = document.getElementById('header');
    nav.innerHTML = '';
    // The top row is just the Control Center button (Samsung Home, Inputs, Settings and the
    // rest live in the panel it opens), next to a Wi-Fi strength indicator.
    header = [];
    var status = document.getElementById('status');
    status.innerHTML = '<span class="wifi">' + TH.icon('wifi') + '</span>';
    var controls = { key: null, run: function () { TH.panel.open(); } };
    controls.node = status.appendChild(el('span', 'ibtn'));
    controls.node.innerHTML = TH.icon('controls');
    header.push(controls);
  }

  function paintWifi() {
    TH.wifi(function (s) {
      var w = document.querySelector('#status .wifi');
      w.hidden = s === null;
      w.setAttribute('data-bars', s === null ? 0 : s > .66 ? 3 : s > .33 ? 2 : s > 0 ? 1 : 0);
    });
  }

  function paintHeader() {
    // The top row stays hidden until the remote goes up to it.
    document.body.classList.toggle('at-top', st.row === 0);
    header.forEach(function (h, i) {
      h.node.classList.toggle('on', st.row === 0 && i === st.col);
    });
  }

  function build() {
    var stage = document.getElementById('stage');
    stage.innerHTML = '';
    document.body.className = 'style-' + st.style;
    style().build(st, stage);
    render();
  }

  function render() {
    var r = rows();
    st.row = Math.max(0, Math.min(st.row, r.length - 1));
    st.col = Math.max(0, Math.min(st.col, r[st.row] - 1));
    if (st.row === 1) { st.app = st.col; }
    paintHeader();
    style().focus(st);
  }

  function move(dRow, dCol) {
    var r = rows();
    if (dRow) {
      var next = st.row + dRow;
      if (next < 0 || next >= r.length) { return; }
      st.row = next;
      // Keep the column on the selected app when coming back to the app row.
      if (st.row === 1) { st.col = st.app; }
      else if (st.row === 0) { st.col = 0; }
    } else {
      st.col += dCol;
      if (st.col < 0 || st.col >= r[st.row]) { st.col -= dCol; return; }
    }
    if (st.row === 1) { st.item = 0; }
    prefs.app = st.app;
    TH.save(PREFS, prefs);
    render();
  }

  function activate() {
    if (st.row === 0) { header[st.col].run(); return; }
    var entry = style().activate(st);
    if (entry) { TH.launch(entry); }
  }

  // ---- screensaver: after 3 minutes without a key, the home screen without its dock ----
  // The clock stays and the art keeps changing every 20 s (see below); only the dock and the
  // top row fade out, and the show's title moves down into the dock's place.
  var IDLE_MS = 180000, idleTimer = 0;
  function showIdle() {
    if (document.hidden || TH.watchingInput() || !st.entries.length) { return resetIdle(); }
    TH.panel.close();
    st.row = 1; st.col = st.app; render();
    document.body.classList.add('idle');
  }
  function resetIdle() {
    clearTimeout(idleTimer);
    document.body.classList.remove('idle');
    idleTimer = setTimeout(showIdle, IDLE_MS);
  }
  // The Control Center's "Clock screen" opens it straight away.
  TH.idleNow = function () { clearTimeout(idleTimer); showIdle(); };

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    var wasIdle = document.body.classList.contains('idle');
    resetIdle();
    if (wasIdle) { e.preventDefault(); return; }  // the first key only wakes the screen
    if (TH.watchingInput()) {
      if (k === KEY.BACK || k === KEY.ESC) { e.preventDefault(); TH.leaveInput(); }
      return;
    }
    if (TH.panel.isOpen()) {
      if (TH.panel.key(k)) { e.preventDefault(); }
      return;
    }
    if (k === KEY.LEFT) { move(0, -1); }
    else if (k === KEY.RIGHT) { move(0, 1); }
    else if (k === KEY.UP) { move(-1, 0); }
    else if (k === KEY.DOWN) { move(1, 0); }
    else if (k === KEY.ENTER) { activate(); }
    else if (k === KEY.BACK || k === KEY.ESC) { st.row = 1; st.col = st.app; render(); }
    else { return; }
    e.preventDefault();
  });

  // TV Home can stay suspended for days, so check for new art (12 h TTL) hourly and on every return.
  function refreshArt() {
    if (!st.entries.length) { return; }
    TH.art.refresh(st.entries, function (changed) {
      if (changed) { build(); }
      TH.art.preload(st.entries);
    });
  }
  setInterval(refreshArt, 3600 * 1000);

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { TH.tell('/home'); refreshArt(); paintWifi(); resetIdle(); }
  });

  // Every 20 s the art moves on to the next trending title for the focused app.
  setInterval(function () {
    if (document.hidden) { return; }
    st.item = (st.item + 1) % 8;
    style().focus(st);
  }, 20000);

  TH.startWatcher();
  TH.startClock();
  buildHeader();
  paintWifi();
  setInterval(paintWifi, 60000);
  resetIdle();
  TH.loadEntries(function (entries) {
    st.entries = entries.length ? entries : [{ kind: 'samsung', name: 'Samsung Home', key: 'other', color: '#2a2d33' }];
    st.app = Math.min(prefs.app || 0, st.entries.length - 1);
    st.col = st.app;
    document.body.classList.remove('loading');
    build();
    TH.tell('/home');
    refreshArt();
  });
})(window.TH);
