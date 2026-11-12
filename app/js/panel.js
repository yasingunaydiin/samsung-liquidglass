// Control Center: status and shortcuts in a panel on the right, opened from the toggle button
// in the top row. Only what a Samsung web app can actually read or do is here; Bluetooth,
// Do Not Disturb, sleep timer and power are not open to apps on Tizen.
(function (TH) {
  'use strict';

  var el = TH.el, KEY = TH.KEY;
  var root = null, rows = [], r = 0, c = 0, open = false;
  var mainGrid = null, mainRows = [], listGrid = null;  // the panel, and its Inputs page

  function capsule(icon, title) {
    var n = el('div', 'cap');
    n.innerHTML = TH.icon(icon);
    var txt = el('div', 'txt');
    txt.appendChild(el('b', '', title));
    txt.appendChild(el('span'));
    n.appendChild(txt);
    return n;
  }
  function say(item, text) { item.node.querySelector('.txt span').textContent = text; }

  function build() {
    root = document.getElementById('cc');
    var grid = mainGrid = el('div', 'grid');
    root.appendChild(grid);
    listGrid = root.appendChild(el('div', 'grid'));
    listGrid.hidden = true;

    var wifi = { node: capsule('wifi', 'Wi-Fi'), run: function () { TH.openSystem('settings'); },
      refresh: function () {
        TH.network(function (n) {
          say(wifi, n.type === 'WIFI' ? (n.ssid || 'Connected') : n.type === 'ETHERNET' ? 'Wired' :
            n.type === 'NONE' ? 'Offline' : 'Unknown');
        });
      } };

    var memory = { node: capsule('memory', 'Memory'), run: function () { memory.refresh(); },
      refresh: function () {
        var m = TH.memory();
        say(memory, m ? Math.round(m.used * 100) + '% in use' : 'Unavailable');
        memory.fill.style.width = m ? Math.round(m.used * 100) + '%' : '0';
      } };
    var track = memory.node.querySelector('.txt').appendChild(el('div', 'bar'));
    memory.fill = track.appendChild(el('i'));

    var audio = { node: capsule('audio', 'Audio'), run: function () { TH.audio.toggleMute(); audio.refresh(); },
      refresh: function () {
        var a = TH.audio.read();
        say(audio, !a ? 'Unavailable' : a.muted ? 'Muted · OK to unmute' : 'Volume ' + a.volume + ' · OK to mute');
        audio.node.classList.toggle('muted', !!(a && a.muted));
      } };

    var clock = { node: capsule('clock', 'Screensaver'), run: function () { close(); TH.idleNow(); },
      refresh: function () { say(clock, 'Show it now'); } };

    [wifi, memory, audio, clock].forEach(function (item) { grid.appendChild(item.node); });

    var round = el('div', 'round');
    grid.appendChild(round);
    var buttons = [['inputs', 'Inputs', showInputs],
      ['settings', 'Settings', function () { TH.openSystem('settings'); }],
      ['home', 'Samsung Home', function () { close(); TH.openSamsungHome(); }]].map(function (b) {
      var n = el('div', 'rbtn');
      n.innerHTML = TH.icon(b[0]);
      n.appendChild(el('span', '', b[1]));
      round.appendChild(n);
      return { node: n, run: b[2] };
    });

    rows = mainRows = [[wifi, memory], [audio, clock], buttons];
    // Art credit (TMDB asks for one when its art is used), kept here instead of on the home screen.
    grid.appendChild(el('p', 'note', TH.art.credit()));
  }

  // Inputs page: one capsule per connected input, two to a row; OK switches to it, Back returns.
  function showInputs() {
    TH.inputs(function (list) {
      listGrid.innerHTML = '';
      var items = list.map(function (input) {
        var item = { node: capsule('inputs', input.name), run: function () { close(); TH.switchInput(input); } };
        say(item, input.sub);
        return item;
      });
      if (!items.length) {
        var none = { node: capsule('inputs', 'No inputs found'), run: showMain };
        say(none, 'Is the device on?');
        items.push(none);
      }
      rows = [];
      items.forEach(function (item, i) {
        listGrid.appendChild(item.node);
        if (i % 2 === 0) { rows.push([]); }
        rows[rows.length - 1].push(item);
      });
      listGrid.appendChild(el('p', 'note', 'Inputs · Back returns to the Control Center'));
      mainGrid.hidden = true; listGrid.hidden = false;
      r = 0; c = 0; paint();
    });
  }
  function showMain() {
    if (!mainGrid) { return; }
    listGrid.hidden = true; mainGrid.hidden = false;
    rows = mainRows; r = rows.length - 1; c = 0; paint();
  }
  function onInputs() { return !!listGrid && !listGrid.hidden; }

  function paint() {
    rows.forEach(function (row, i) {
      row.forEach(function (item, j) { item.node.classList.toggle('on', i === r && j === c); });
    });
  }

  function refresh() {
    rows.forEach(function (row) { row.forEach(function (item) { if (item.refresh) { item.refresh(); } }); });
  }

  function close() {
    open = false;
    if (root) { root.classList.remove('open'); showMain(); }
  }

  TH.panel = {
    isOpen: function () { return open; },
    open: function () {
      if (!root) { build(); }
      showMain();
      refresh();
      r = 0; c = 0; paint();
      root.classList.add('open');
      open = true;
    },
    close: close,
    // Remote keys while the panel is open. Returns true when the key was used.
    key: function (k) {
      if (k === KEY.BACK || k === KEY.ESC) { if (onInputs()) { showMain(); } else { close(); } }
      else if (k === KEY.UP && r > 0) { r--; c = Math.min(c, rows[r].length - 1); }
      else if (k === KEY.DOWN && r < rows.length - 1) { r++; c = Math.min(c, rows[r].length - 1); }
      else if (k === KEY.LEFT && c > 0) { c--; }
      else if (k === KEY.RIGHT && c < rows[r].length - 1) { c++; }
      else if (k === KEY.ENTER) { rows[r][c].run(); }
      else if ([KEY.UP, KEY.DOWN, KEY.LEFT, KEY.RIGHT].indexOf(k) < 0) { return false; }
      paint();
      return true;
    }
  };
})(window.TH);
