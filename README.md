# Video Doorbell Card

A Home Assistant Lovelace card for **video doorbells** that looks and behaves like a video intercom:
status header with a live "ringing" state, a video screen with answer/hangup
controls, and a filmstrip of the most recent doorbell screenshots.

Designed for small always-on screens — iPhone and Echo Show class devices —
as well as desktop dashboards.


## How it works

The video screen **embeds the [Advanced Camera Card](https://github.com/dermotduffy/advanced-camera-card)**
through Home Assistant's official `loadCardHelpers()` API, so all of its
streaming, WebRTC and two-way talk/answer logic works unmodified. This card
adds the intercom experience around it:

- 🚪 Title + connection chip (green = online)
- 🟢 Pulsing **Ringing…** chip while a ring is fresh *and* the doorbell is connected (red stays reserved for hang up; reconnect replays can't flash it)
- 🎞 Screenshot filmstrip from a FileTrack sensor (tap → fullscreen lightbox)
- 📡 Footer with the last ring time and snapshot count

## Installation

### Manual (recommended for trying it out)

1. Copy `video-doorbell-card.js` into `/config/www/video-doorbell-card/video-doorbell-card.js`.
2. Open a dashboard → **⋮ → Resources → Add Resource**
3. URL: `/local/video-doorbell-card/video-doorbell-card.js`, type **JavaScript Module**
4. Save.

### HACS

Add this repository as a custom repository (category: *Lovelace*), install,
then restart Home Assistant.

## Configuration

```yaml
type: custom:video-doorbell-card
title: Back Door
camera_entity: camera.backdoor        # camera entity for the video screen
go2rtc_stream: back_door              # go2rtc stream name (enables two-way talk)
ring_entity: event.front_door_dp_154  # ring event entity (drives the ringing chip)
connected_entity: binary_sensor.front_door_connected   # optional online chip
screenshots_sensor: sensor.doorbell_files              # FileTrack sensor with fileList
max_snapshots: 6
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `title` | `Intercom` | Header title. |
| `camera_entity` | — | The camera entity shown on the video screen (required unless `acc` is given). |
| `go2rtc_stream` | — | go2rtc stream name; enables WebRTC live view and two-way talk. |
| `acc` | — | Pass-through: a complete Advanced Camera Card config object, used verbatim instead of building one from the options above. |
| `ring_entity` | — | Event entity (device class `doorbell`) driving the "Ringing…" chip and last-ring footer. |
| `connected_entity` | — | Binary sensor showing the green online chip while `on`. |
| `screenshots_sensor` | — | A [FileTrack](https://github.com/TheScubaDiver/FileTrack) sensor whose `fileList` attribute lists snapshot files under `/config/www` (served as `/local`). |
| `max_snapshots` | `6` | How many screenshots to show in the filmstrip. |

Snapshot filenames should contain a timestamp such as
`backdoor_2026_10_25_17-30-00.jpg` — the filmstrip parses it for sorting and
labels.

## Two-way talk

Talk/answer requires the embedded card's conditions: HTTPS access to Home
Assistant, a go2rtc stream with a talk-capable source, and a camera that
supports a talk backchannel. See the
[Advanced Camera Card 2-way audio docs](https://github.com/dermotduffy/advanced-camera-card/blob/main/docs/usage/2-way-audio.md).

## Credits

- [Advanced Camera Card](https://github.com/dermotduffy/advanced-camera-card) by dermotduffy — embedded for the video screen (MIT).
- [FileTrack](https://github.com/TheScubaDiver/FileTrack) by TheScubaDiver — supplies the screenshot list.

## License

MIT © MJP-76
