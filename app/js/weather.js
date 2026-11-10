// Current weather for the clock on look 5, from Open-Meteo (free, no key, no account).
// Only the coordinates in me.js are sent. Without them nothing is fetched.
(function (TH) {
  'use strict';

  var ME = window.TVHOME_ME || {};
  var CACHE = 'tvhome.weather.v1';
  var TTL = 30 * 60 * 1000;       // fetch again after 30 minutes
  var RETRY = 5 * 60 * 1000;      // after a failure, wait 5 minutes before trying again
  var STALE = 3 * 3600 * 1000;    // stop showing a reading older than 3 hours
  var data = TH.load(CACHE, null), busy = false, lastTry = 0;

  // WMO weather codes, by the highest code in each group.
  var WORDS = [[0, 'Clear'], [1, 'Mostly clear'], [2, 'Partly cloudy'], [3, 'Cloudy'], [48, 'Foggy'],
    [57, 'Drizzle'], [67, 'Rain'], [77, 'Snow'], [82, 'Showers'], [86, 'Snow showers'], [99, 'Thunderstorms']];
  function words(code) {
    for (var i = 0; i < WORDS.length; i++) { if (code <= WORDS[i][0]) { return WORDS[i][1]; } }
    return '';
  }
  function here() { return isFinite(ME.lat) && isFinite(ME.lon); }

  // "8° Foggy", or '' when there is no recent reading for this place.
  TH.weather = function () {
    if (!here() || !data || data.lat !== ME.lat || data.lon !== ME.lon) { return ''; }
    if (Date.now() - data.at > STALE) { return ''; }
    return Math.round(data.temp) + '° ' + words(data.code);
  };

  // Calls done() only when a new reading arrived.
  TH.refreshWeather = function (done) {
    var now = Date.now();
    if (!here() || busy || now - lastTry < RETRY) { return; }
    if (data && data.lat === ME.lat && data.lon === ME.lon && now - data.at < TTL) { return; }
    busy = true; lastTry = now;
    var x = new XMLHttpRequest();
    x.open('GET', 'https://api.open-meteo.com/v1/forecast?latitude=' + ME.lat + '&longitude=' + ME.lon +
      '&current=temperature_2m,weather_code&timezone=auto');
    x.timeout = 8000;
    x.onload = function () {
      busy = false;
      try {
        var c = x.status === 200 && JSON.parse(x.responseText).current;
        if (!c || !isFinite(c.temperature_2m)) { return; }
        data = { at: Date.now(), lat: ME.lat, lon: ME.lon, temp: c.temperature_2m, code: c.weather_code };
        TH.save(CACHE, data);
        if (done) { done(); }
      } catch (e) { /* keep the last reading */ }
    };
    x.onerror = x.ontimeout = function () { busy = false; };
    x.send();
  };
})(window.TH);
