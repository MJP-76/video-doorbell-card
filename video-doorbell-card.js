/**
 * Video Doorbell Card — a Home Assistant Lovelace card (v1)
 *
 * An intercom-styled panel: status header, a live video screen (an embedded
 * Advanced Camera Card, so two-way talk keeps working), and a filmstrip of the
 * most recent doorbell screenshots.
 *
 * Config:
 *   type: custom:video-doorbell-card
 *   title: Back Door
 *   camera_entity: camera.backdoor      # used for the embedded video card
 *   go2rtc_stream: back_door            # go2rtc stream name (talk-capable)
 *   screenshots_sensor: sensor.doorbell_files   # optional FileTrack sensor
 *   ring_entity: event.backdoor_dp_154  # optional, drives the status chip
 *   connected_entity: binary_sensor.front_door_connected  # optional chip
 *   max_snapshots: 6
 *
 * Local/derivative: the embedded video card remains property of its authors;
 * this file only composes it. Install: place in /config/www/intercom-card/
 * and register as a dashboard resource (/local/intercom-card/intercom-card.js).
 */

class VideoDoorbellCard extends HTMLElement {
  setConfig(config) {
    if (!config || (!config.camera_entity && !config.acc)) {
      throw new Error("intercom-card: camera_entity (or an acc passthrough) is required");
    }
    this._config = Object.assign(
      {
        title: "Intercom",
        max_snapshots: 6,
      },
      config
    );
    this._hass = null;
    this._buildShell();
  }

  _buildShell() {
    if (this._root) return;
    this.attachShadow({ mode: "open" });
    this._root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; }
      .panel {
        background: var(--ha-card-background, var(--card-background-color, #1c1c1e));
        border: 1px solid var(--ha-card-border-color, rgba(0,0,0,.12));
        border-radius: 16px;
        overflow: hidden;
        color: var(--primary-text-color, #eee);
        font-family: var(--primary-font-family, sans-serif);
      }
      .header {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 16px;
        background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,0));
        border-bottom: 1px solid rgba(255,255,255,.07);
      }
      .title { font-size: 16px; font-weight: 600; flex: 1; }
      .chip {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12px; padding: 3px 10px; border-radius: 999px;
        background: rgba(255,255,255,.08);
      }
      .dot { width: 8px; height: 8px; border-radius: 50%; background: #777; }
      .dot.on { background: #2ecc71; box-shadow: 0 0 6px #2ecc71; }
      .dot.ring { background: #e74c3c; box-shadow: 0 0 8px #e74c3c; animation: pulse 1s infinite; }
      @keyframes pulse { 50% { opacity: .35; } }
      .screen { position: relative; background: #000; }
      .placeholder {
        display: flex; align-items: center; justify-content: center;
        min-height: 200px; color: #666; font-size: 14px;
      }
      .filmstrip {
        display: flex; gap: 8px; padding: 10px 12px;
        overflow-x: auto; scrollbar-width: thin;
        border-top: 1px solid rgba(255,255,255,.07);
      }
      .filmstrip:empty { display: none; }
      .shot {
        position: relative; flex: 0 0 auto;
        width: 96px; height: 54px; border-radius: 8px;
        overflow: hidden; background: #000; cursor: pointer;
        border: 1px solid rgba(255,255,255,.12);
      }
      .shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .shot .ts {
        position: absolute; left: 0; right: 0; bottom: 0;
        font-size: 10px; text-align: center; padding: 1px 0;
        background: rgba(0,0,0,.65); color: #fff;
      }
      .footer {
        display: flex; justify-content: space-between; gap: 8px;
        padding: 8px 14px; font-size: 12px; opacity: .8;
        border-top: 1px solid rgba(255,255,255,.07);
      }
      .empty { padding: 6px 12px; font-size: 11px; opacity: .5; }
    `;

    const header = document.createElement("div");
    header.className = "header";
    header.innerHTML = `
      <span class="title"></span>
      <span class="chip" data-role="ring" hidden><span class="dot ring"></span><span class="ring-text">Ringing…</span></span>
      <span class="chip" data-role="connected" hidden><span class="dot on"></span><span>Online</span></span>
    `;

    const screen = document.createElement("div");
    screen.className = "screen";

    const filmstrip = document.createElement("div");
    filmstrip.className = "filmstrip";

    const footer = document.createElement("div");
    footer.className = "footer";
    footer.innerHTML = `
      <span data-role="lastring">Last ring: —</span>
      <span data-role="shots"></span>
    `;

    this._root.append(style, this._mountPanel(header, screen, filmstrip, footer));
    this._els = { header, screen, filmstrip, footer };

    this._buildVideoCard();
  }

  _mountPanel(header, screen, filmstrip, footer) {
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.append(header, screen, filmstrip, footer);
    return panel;
  }

  _buildVideoCard() {
    const cfg = this._config.acc || {
      type: "custom:advanced-camera-card",
      cameras: [
        {
          camera_entity: this._config.camera_entity,
          live_provider: "go2rtc",
          go2rtc: Object.assign(
            { modes: ["webrtc"], metadata_fetch_timeout_seconds: 10 },
            this._config.go2rtc_stream ? { stream: this._config.go2rtc_stream } : {}
          ),
          capabilities: { force: ["2-way-audio"] },
        },
      ],
      menu: { style: "outside" },
      view: {
        triggers: {
          show_trigger_status: true,
          actions: { interaction_mode: "all", trigger: "call", untrigger: "call" },
        },
      },
      live: {
        controls: { call: { ringtone: { type: "chime" } } },
        microphone: { auto_unmute: ["call"] },
      },
    };

    const mount = () => {
      try {
        const helper = window.loadCardHelpers && window.loadCardHelpers();
        Promise.resolve(helper).then((helpers) => {
          const el = helpers.createCardElement(cfg);
          el.classList.add("video");
          this._els.screen.innerHTML = "";
          this._els.screen.appendChild(el);
          this._videoEl = el;
          if (this._hass) el.hass = this._hass;
        }).catch((e) => this._showPlaceholder("Video unavailable: " + e));
      } catch (e) {
        this._showPlaceholder("Video unavailable: " + e);
      }
    };
    mount();
  }

  _showPlaceholder(text) {
    this._els.screen.innerHTML = "";
    const p = document.createElement("div");
    p.className = "placeholder";
    p.textContent = text;
    this._els.screen.appendChild(p);
  }

  set hass(hass) {
    this._hass = hass;
    if (this._videoEl) this._videoEl.hass = hass;
    this._updateStatus();
    this._updateFilmstrip();
  }

  getCardSize() {
    return 5;
  }

  _stateOf(entityId) {
    return this._hass && this._hass.states[entityId] ? this._hass.states[entityId] : null;
  }

  _updateStatus() {
    if (!this._hass || !this._els) return;
    const cfg = this._config;

    this._els.header.querySelector(".title").textContent = cfg.title;

    // Connected chip
    const connChip = this._els.header.querySelector('[data-role="connected"]');
    if (cfg.connected_entity) {
      const st = this._stateOf(cfg.connected_entity);
      connChip.hidden = !(st && st.state === "on");
    } else {
      connChip.hidden = false;
    }

    // Ring chip: active while the ring event's state changed within the last 45s
    const ringChip = this._els.header.querySelector('[data-role="ring"]');
    if (cfg.ring_entity) {
      const st = this._stateOf(cfg.ring_entity);
      const fresh =
        st &&
        st.state !== "unknown" &&
        st.state !== "unavailable" &&
        Date.now() - Date.parse(st.last_updated || 0) < 45000;
      ringChip.hidden = !fresh;
    }

    // Footer: last ring timestamp
    if (cfg.ring_entity) {
      const st = this._stateOf(cfg.ring_entity);
      const ts = st && st.state && st.state !== "unknown" && st.state !== "unavailable" ? st.state : null;
      this._els.footer.querySelector('[data-role="lastring"]').textContent =
        "Last ring: " + (ts ? new Date(ts).toLocaleString() : "—");
    }
  }

  _updateFilmstrip() {
    if (!this._hass || !this._els) return;
    const sensorId = this._config.screenshots_sensor;
    const strip = this._els.filmstrip;
    const countEl = this._els.footer.querySelector('[data-role="shots"]');

    if (!sensorId) {
      strip.innerHTML = "";
      if (countEl) countEl.textContent = "";
      return;
    }
    const st = this._stateOf(sensorId);
    const list = st && st.attributes && Array.isArray(st.attributes.fileList) ? st.attributes.fileList : [];
    if (!list.length) {
      strip.innerHTML = "";
      if (countEl) countEl.textContent = "No screenshots yet";
      return;
    }

    // Sort newest first by parsing timestamps from the filename
    const parse = (p) => {
      const m = String(p).match(/(\d{4})_(\d{2})_(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
      return m ? Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`) : 0;
    };
    const sorted = list
      .slice()
      .sort((a, b) => parse(b) - parse(a))
      .slice(0, this._config.max_snapshots);

    const url = (p) =>
      String(p)
        .replace(/^\/config\/www/, "/local")
        .replace(/^\/www/, "/local");

    const html = sorted
      .map((p) => {
        const t = parse(p);
        const label = t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
        return `<div class="shot" data-src="${url(p)}"><img src="${url(p)}?v=${t}" loading="lazy"><span class="ts">${label}</span></div>`;
      })
      .join("");

    if (strip.innerHTML !== html) strip.innerHTML = html;
    if (countEl) countEl.textContent = `${list.length} snapshot${list.length === 1 ? "" : "s"}`;

    if (!this._clickBound) {
      strip.addEventListener("click", (ev) => {
        const src = ev.target && ev.target.closest(".shot");
        if (!src) return;
        this._openLightbox(src.getAttribute("data-src"));
      });
      this._clickBound = true;
    }
  }

  _openLightbox(src) {
    if (!src) return;
    if (this._lightbox) {
      this._lightbox.querySelector("img").src = src;
      this._lightbox.style.display = "flex";
      return;
    }
    const lb = document.createElement("div");
    lb.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer";
    lb.innerHTML = `<img src="${src}" style="max-width:96vw;max-height:96vh;border-radius:8px">`;
    lb.addEventListener("click", () => (lb.style.display = "none"));
    document.body.appendChild(lb);
    this._lightbox = lb;
  }
}

customElements.define("video-doorbell-card", VideoDoorbellCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "video-doorbell-card",
  name: "Video Doorbell Card",
  description: "Video doorbell intercom: live view, answer/hangup two-way talk, ring alerts and screenshot history. Works with any camera.",
  preview: true,
});
