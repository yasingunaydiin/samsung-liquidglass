# Clean TV Home for Samsung

Your Samsung TV's home screen, rebuilt around what is actually on. The app you are on fills the screen with its newest shows. No ad row, no TV Plus, no root.

## The home screen

The show's art fills the screen. A greeting, the date with the weather and a big clock sit at the top, the show's title above a see-through dock of your apps at the bottom. The dock scrolls, so the app you are on is always in view.

Press Up for the top row: Samsung Home, and the Control Center button on the right. The Control Center shows your Wi-Fi network, memory in use and the volume (OK mutes), and has shortcuts to the clock screen, Inputs, Settings and Samsung Home. Back closes it.

## What it does

- **Art from each service's own shows.** Netflix, Prime Video and Apple TV show their own series that aired in the last 60 days, plus movies released on them in the last year. YouTube and HDMI show what is trending.
- **It keeps changing.** The art moves to the next title every 20 seconds. Each day a different 8 of the top 16 come up. The list is fetched fresh every 12 hours (checked every hour and whenever you come back to Home).
- **Your HDMI device is a tile.** A Fire TV stick or console shows up next to the apps, and selecting it switches input and wakes it over HDMI-CEC.
- **Only the apps you use get a tile.** Netflix, YouTube and Apple TV (the `SHOWN` list in `app/js/system.js`); everything else stays installed and reachable from Samsung Home.
- **An idle clock.** After 3 minutes without a key press, a big clock over the current show, with a new show every 30 seconds. Any key wakes it.
- **Home comes back here.** The Home button on the remote opens TV Home, and Samsung Home is one press away in the top row.

## What it sends

Only requests to TMDB for art: `api.themoviedb.org` with your own key, and images from `image.tmdb.org`. If `app/js/me.js` has coordinates, the clock also asks `api.open-meteo.com` for the current weather there (just the coordinates, every 30 minutes). No analytics, no account, nothing else leaves the TV. The Home-button watcher only talks to the app on `127.0.0.1`.

Without a key, public-domain paintings from the Art Institute of Chicago (CC0) stand in, and nothing is fetched at all.

## Install

Needs [AeroTizen's CLI](https://github.com/helalaou/AeroTizen) with signing certificates made for your TV, and Developer Mode on.

```sh
aerotizen --tv <tv-ip> certs                  # once
echo YOUR_KEY > ~/.config/tv-home/tmdb.key    # optional, a free TMDB "API Key" or "API Read Access Token"
tools/install.sh <tv-ip>                      # build, sign, install and open
```

The install script copies the key into the build in `dist/` only; it is never committed. Only one launcher with a Home watcher should be installed at a time.

## Tested on

Samsung UN65CU7000DXZA (2023), Tizen 8.0. Plain JavaScript and CSS with no build step. Other Tizen TVs are untested; open an issue if yours works or does not.

## Check

```sh
node tools/screens.cjs <path-to-playwright> <out-dir>      # desktop, 1920x1080, all looks
aerotizen --tv <tv-ip> inspect TvHome0001.Home             # then, in another shell:
node tools/tv-check.mjs <out-dir>                           # on the TV: errors, key timing, screenshots
```

## Credits

- `app/service/` is the Home-button watcher from AeroTizen 2.5.0 by Hamza El Alaoui, MIT (`app/service/LICENSE-AeroTizen`), with the app ID and port changed.
- Fonts: Big Shoulders Display, Hanken Grotesk, JetBrains Mono, SIL Open Font License.
- Fallback art: Art Institute of Chicago public-domain images, CC0.
- App logos (Netflix, YouTube, Apple TV): Simple Icons 16.35.0, CC0 (`app/js/logos.js`). The marks are trademarks of their owners and are used only to label the apps. Prime Video is a typeset wordmark because Amazon had its logo withdrawn from Simple Icons.
- Trending art and data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
- Screenshots and the demo in `docs/` show the earlier four looks, with TMDB images and app marks for illustration; they belong to their owners.
- The demo's soundtrack is made entirely in code with [earshot](https://github.com/Leonxlnx/earshot) 0.4.0 (MIT): its kalimba and glockenspiel voices for the music and its launch kit for the effects. No recordings or samples.
