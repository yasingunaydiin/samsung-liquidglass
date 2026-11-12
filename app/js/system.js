// Apps, HDMI inputs and the Home-button watcher. Launch and handoff rules follow
// AeroTizen 2.5.0, which was tested on this TV model.
(function (TH) {
  'use strict';

  var tz = TH.tz;

  // Preinstalled streamers are known to the TV's local API by store id; the watcher polls that API.
  var STORE_IDS = {
    'org.tizen.netflix-app': '3201907018807',
    'org.tizen.primevideo': '3201910019365',
    'com.samsung.tv.aria-video': '3201807016597'
  };
  var YOUTUBE_STORE_ID = '111299001912';
  var INPUTS = 'tvhome.inputs.v1';
  var HIDDEN = /service|emanual|companion|dummy|widget|klyq|DclHome001|TvHome0001/i;
  var ORDER = ['netflix', 'prime video', 'youtube', 'apple tv', 'xbox'];
  // Apps shown as tiles (brand keys below); HDMI devices are always shown. Other apps stay
  // installed and the watcher still tracks them, they just get no tile.
  var SHOWN = ['netflix', 'youtube', 'appletv', 'xbox'];
  // logo: a key in TH.LOGOS (logos.js, Simple Icons, CC0), drawn in fg. Prime Video's logo was withdrawn
  // from Simple Icons at Amazon's request, and Xbox's at Microsoft's, so they get typeset wordmarks instead.
  var BRAND = {
    netflix: { key: 'netflix', color: '#000000', fg: '#e50914', glow: '#e50914', logo: 'netflix' },
    'prime video': { key: 'prime', color: '#1a98ff', fg: '#ffffff', glow: '#1a98ff', wordmark: 'prime video' },
    youtube: { key: 'youtube', color: '#0f0f0f', fg: '#ff0000', glow: '#ff0000', logo: 'youtube' },
    'apple tv': { key: 'appletv', color: '#000000', fg: '#ffffff', glow: '#f1efe9', logo: 'appletv' },
    xbox: { key: 'xbox', color: '#107c10', fg: '#ffffff', glow: '#107c10', wordmark: 'XBOX' }
  };
  // The TV's own Settings and Source (input list) screens, found on this model with getAppsInfo.
  TH.SYSTEM_APPS = { settings: 'com.samsung.tv.coba.setting', inputs: 'org.tizen.SMSourceAPP' };

  function brandFor(name) {
    var lower = name.toLowerCase();
    for (var prefix in BRAND) { if (lower.indexOf(prefix) === 0) { return BRAND[prefix]; } }
    return { key: 'other', color: '#24312f' };
  }

  function rank(name) {
    var lower = name.toLowerCase();
    for (var i = 0; i < ORDER.length; i++) { if (lower.indexOf(ORDER[i]) === 0) { return i; } }
    return ORDER.length;
  }

  function appEntry(id, name, icon) {
    var b = brandFor(name);
    var storeId = STORE_IDS[id] || (/^youtube$/i.test(name) ? YOUTUBE_STORE_ID : null);
    return { kind: 'app', id: id, storeId: storeId, name: name, icon: icon || '', key: b.key, color: b.color,
      fg: b.fg, glow: b.glow, logo: b.logo, wordmark: b.wordmark };
  }

  function hdmiEntry(source) {
    var name = source.editName || ('HDMI ' + source.number);
    // A Fire TV stick names itself over HDMI-CEC; show it as the device, not the port.
    return { kind: 'hdmi', id: 'hdmi' + source.number, name: name, sub: 'HDMI ' + source.number,
      raw: source, key: 'hdmi', color: '#3d3217', glow: '#f2b134' };
  }

  TH.loadEntries = function (done) {
    if (!tz || !tz.application) {  // desktop preview
      var demo = ['Netflix', 'Prime Video', 'YouTube', 'Apple TV'].map(function (n, i) {
        return appEntry('demo' + i, n, '');
      }).filter(function (a) { return SHOWN.indexOf(a.key) >= 0; });
      demo.push(hdmiEntry({ type: 'HDMI', number: 1, editName: 'Fire TV' }));
      done(demo);
      return;
    }
    var apps = [];
    // A sleeping HDMI device drops out of VIDEOSOURCE, so keep the inputs seen before as tiles.
    function withInputs() {
      var seen = TH.load(INPUTS, []);
      function finish(connected) {
        connected.forEach(function (s) {
          seen = seen.filter(function (o) { return o.number !== s.number; }).concat([{ number: s.number, editName: s.editName }]);
        });
        TH.save(INPUTS, seen);
        seen.sort(function (a, b) { return a.number - b.number; }).forEach(function (o) {
          var live = connected.filter(function (s) { return s.number === o.number; })[0];
          apps.push(hdmiEntry(live || { type: 'HDMI', number: o.number, editName: o.editName }));
        });
        done(apps);
      }
      try {
        tz.systeminfo.getPropertyValue('VIDEOSOURCE', function (info) {
          finish((info.connected || []).filter(function (s) { return s.type === 'HDMI'; }));
        }, function () { finish([]); });
      } catch (e) { finish([]); }
    }
    try {
      tz.application.getAppsInfo(function (list) {
        var all = [];
        list.forEach(function (a) {
          if (a.show === false || !a.name || HIDDEN.test(a.id)) { return; }
          if (!/^[A-Za-z0-9]{10}$/.test(a.packageId || '') && !STORE_IDS[a.id]) { return; }
          all.push(appEntry(a.id, a.name, a.iconPath));
        });
        // The watcher gets every app, so it still stands aside for one opened elsewhere.
        TH.tell('/apps?ids=' + all.map(function (a) { return encodeURIComponent(a.storeId || a.id); }).join(','));
        all.forEach(function (a) { if (SHOWN.indexOf(a.key) >= 0) { apps.push(a); } });
        apps.sort(function (a, b) { return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name); });
        withInputs();
      }, withInputs);
    } catch (e) { withInputs(); }
  };

  // ---- watcher bridge ----
  TH.tell = function (path, ok, failed) {
    if (!tz) { return; }
    var x = new XMLHttpRequest();
    x.open('GET', TH.SERVICE_URL + path);
    x.timeout = 1500;
    x.onload = function () { if (x.status === 200) { if (ok) { ok(); } } else if (failed) { failed(); } };
    x.onerror = x.ontimeout = function () { if (failed) { failed(); } else { TH.startWatcher(); } };
    x.send();
  };
  TH.startWatcher = function () {
    if (!tz) { return; }
    try {
      tz.application.launchAppControl(new tz.ApplicationControl('http://tizen.org/appcontrol/operation/service'),
        TH.SERVICE_ID, null, null);
    } catch (e) { /* without the service, Home goes to Samsung's screen */ }
  };

  // ---- launching ----
  TH.launch = function (entry) {
    if (entry.kind === 'hdmi') { return showInput(entry); }
    if (entry.kind === 'samsung') { return TH.openSamsungHome(); }
    if (!tz || !tz.application) { return TH.toast('Would open ' + entry.name); }
    function failed() { TH.tell('/home'); TH.toast('Could not open ' + entry.name); }
    // Every app is watched, YouTube included: on the CU7172 (Tizen 9) YouTube reports itself
    // on screen, so Home pressed in it is caught like in any other app.
    TH.tell('/watch?id=' + encodeURIComponent(entry.storeId || entry.id));
    try { tz.application.launch(entry.id, null, failed); } catch (e) { failed(); }
  };

  TH.openSamsungHome = function () {
    if (!tz || !tz.application) { return TH.toast('Would open Samsung Home'); }
    TH.tell('/leave', function () {
      try { tz.application.launch('com.samsung.tv.csfs', null, function () { TH.tell('/home'); }); }
      catch (e) { TH.tell('/home'); }
    }, function () { TH.toast('Samsung Home is unavailable'); });
  };

  // Settings and the input list draw over TV Home, so the watcher keeps guarding the Home button.
  TH.openSystem = function (which) {
    if (!tz || !tz.application) { return TH.toast('Would open ' + which); }
    try { tz.application.launch(TH.SYSTEM_APPS[which], null, function () { TH.toast('Could not open ' + which); }); }
    catch (e) { TH.toast('Could not open ' + which); }
  };

  // Wi-Fi strength 0..1, or null when wired, offline or unknown.
  TH.wifi = function (done) {
    if (!tz || !tz.systeminfo) { return done(0.8); }
    try {
      tz.systeminfo.getPropertyValue('NETWORK', function (n) {
        if (n.networkType !== 'WIFI') { return done(n.networkType === 'NONE' ? 0 : null); }
        tz.systeminfo.getPropertyValue('WIFI_NETWORK', function (w) { done(w.signalStrength); }, function () { done(null); });
      }, function () { done(null); });
    } catch (e) { done(null); }
  };

  // Network for the Control Center: { type: 'WIFI' | 'ETHERNET' | 'NONE' | ..., ssid, strength }.
  TH.network = function (done) {
    if (!tz || !tz.systeminfo) { return done({ type: 'WIFI', ssid: 'Home Wi-Fi', strength: 0.8 }); }
    try {
      tz.systeminfo.getPropertyValue('NETWORK', function (n) {
        if (n.networkType !== 'WIFI') { return done({ type: n.networkType }); }
        tz.systeminfo.getPropertyValue('WIFI_NETWORK', function (w) {
          done({ type: 'WIFI', ssid: w.ssid, strength: w.signalStrength });
        }, function () { done({ type: 'WIFI' }); });
      }, function () { done({ type: 'UNKNOWN' }); });
    } catch (e) { done({ type: 'UNKNOWN' }); }
  };

  // Share of the TV's memory in use, 0..1, or null if the TV doesn't say.
  TH.memory = function () {
    if (!tz || !tz.systeminfo) { return { used: 0.42 }; }  // desktop preview
    try {
      var total = tz.systeminfo.getTotalMemory(), free = tz.systeminfo.getAvailableMemory();
      return total > 0 ? { used: Math.min(1, Math.max(0, 1 - free / total)) } : null;
    } catch (e) { return null; }
  };

  // TV volume and mute (needs the tv.audio privilege in config.xml).
  var demoMuted = false;
  TH.audio = {
    read: function () {
      if (!tz) { return { volume: 18, muted: demoMuted }; }  // desktop preview
      try { return { volume: tz.tvaudiocontrol.getVolume(), muted: tz.tvaudiocontrol.isMute() }; }
      catch (e) { return null; }
    },
    toggleMute: function () {
      if (!tz) { demoMuted = !demoMuted; return; }
      try { tz.tvaudiocontrol.setMute(!tz.tvaudiocontrol.isMute()); }
      catch (e) { TH.toast('Could not change the sound'); }
    }
  };

  var watchingInput = false;
  // setSource only takes the TV's own source objects. For a sleeping device that is the main
  // window's current source when it is still on that port; switching to it wakes the device (CEC).
  function sourceFor(entry, done) {
    tz.systeminfo.getPropertyValue('VIDEOSOURCE', function (info) {
      var live = (info.connected || []).filter(function (s) { return s.type === 'HDMI' && s.number === entry.raw.number; })[0];
      var main = tz.tvwindow.getSource('MAIN');
      done(live || (main && main.type === 'HDMI' && main.number === entry.raw.number ? main : null));
    }, function () { done(null); });
  }

  function showInput(entry) {
    if (!tz || !tz.tvwindow) { return TH.toast('Would switch to ' + entry.name); }
    try {
      sourceFor(entry, function (source) {
        if (!source) { return TH.toast(entry.name + ' is asleep. Wake it with its own remote.'); }
        switchTo(entry, source);
      });
    } catch (e) { TH.toast('Could not switch input'); }
  }

  function switchTo(entry, source) {
    try {
      tz.tvwindow.setSource(source, function () {
        tz.tvwindow.show(function () {
          watchingInput = true;
          document.body.classList.add('input');
          document.getElementById('hdmi').hidden = false;
        }, function () { TH.toast('Could not show ' + entry.name); }, ['0px', '0px', '1920px', '1080px'], 'MAIN');
      }, function () { TH.toast('Could not switch input'); }, 'MAIN');
    } catch (e) { TH.toast('Could not switch input'); }
  }
  // The TV's connected inputs for the Control Center's list: [{ name, sub, source }].
  // Samsung's own input screen doesn't open from a web app on Tizen 9, so the list is built here.
  TH.inputs = function (done) {
    if (!tz || !tz.systeminfo) {  // desktop preview
      return done([{ name: 'Fire TV', sub: 'HDMI 1', source: null }, { name: 'TV', sub: 'Antenna', source: null }]);
    }
    try {
      tz.systeminfo.getPropertyValue('VIDEOSOURCE', function (info) {
        // A device that is off shows as disconnected; list it anyway, since switching can wake it (CEC).
        function item(s, on) {
          var port = s.type + (s.number ? ' ' + s.number : '');
          return { name: s.editName || (s.type === 'TV' ? 'TV' : port),
            sub: s.type === 'TV' ? 'Antenna / cable' : s.editName ? port + (on ? '' : ' · off') : on ? 'Connected' : 'Nothing on', source: s };
        }
        done((info.connected || []).map(function (s) { return item(s, true); })
          .concat((info.disconnected || []).filter(function (s) { return s.type === 'HDMI'; }).map(function (s) { return item(s, false); })));
      }, function () { done([]); });
    } catch (e) { done([]); }
  };
  TH.switchInput = function (input) {
    if (!input.source) { return TH.toast('Would switch to ' + input.name); }
    switchTo({ name: input.name }, input.source);
  };
  TH.watchingInput = function () { return watchingInput; };
  TH.leaveInput = function () {
    watchingInput = false;
    document.body.classList.remove('input');
    document.getElementById('hdmi').hidden = true;
    try { tz.tvwindow.hide(function () {}, function () {}, 'MAIN'); } catch (e) { /* already hidden */ }
  };
})(window.TH);
