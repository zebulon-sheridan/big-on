import { LitElement, html, css } from "https://unpkg.com/lit@2.8.0/index.js?module";

const CATALOG_URL = "https://heavycomforter.com/audio/catalog.json";
const VERSION = "0.3.0";

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function artFor(item) {
  if (item.artwork || item.image_url || item.image) return item.artwork || item.image_url || item.image;
  const seed = item.album || item.name || item.title || "x";
  const h = hashStr(seed);
  return `linear-gradient(135deg, hsl(${h % 360} 45% 22%), hsl(${(h + 40) % 360} 50% 12%))`;
}

function artistStr(item) {
  if (item.artist) return item.artist;
  if (item.artists && item.artists.length) return item.artists.map(a => a.name || a).join(", ");
  return "";
}

class BigOnCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _catalog: { state: true },
      _queue: { state: true },
      _current: { state: true },
      _playing: { state: true },
      _showList: { state: true },
      _progress: { state: true },
      _duration: { state: true },
      _shuffle: { state: true },
      _ma: { state: true },
      _players: { state: true },
      _player: { state: true },
      _mode: { state: true },
      _query: { state: true },
      _results: { state: true },
      _busy: { state: true },
    };
  }

  static get styles() {
    return css`
      :host { display: block; --bo-bg: #12141c; --bo-ink: #f2eee6; --bo-mut: #8b8f9d; --bo-amber: #e8a848; }
      .bo { border-radius: 14px; overflow: hidden; background: var(--bo-bg); color: var(--bo-ink); font-family: -apple-system, "Segoe UI", Roboto, sans-serif; }
      .topbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px 4px; }
      .tabs { display: flex; gap: 6px; }
      .tab { background: none; border: 1px solid rgba(255,255,255,0.12); color: var(--bo-mut); font-size: 12px; padding: 5px 12px; border-radius: 20px; cursor: pointer; letter-spacing: 0.3px; }
      .tab.on { color: #12141c; background: var(--bo-amber); border-color: var(--bo-amber); font-weight: 600; }
      select.players { background: rgba(255,255,255,0.06); color: var(--bo-ink); border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; font-size: 12px; padding: 6px 8px; max-width: 150px; }
      .art { position: relative; height: 200px; display: flex; align-items: flex-end; }
      .art-bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
      .art-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(18,20,28,0.15) 0%, rgba(18,20,28,0.55) 55%, rgba(18,20,28,0.98) 100%); }
      .art-text { position: relative; padding: 16px 18px; z-index: 1; }
      .badge { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--bo-amber); font-weight: 700; margin-bottom: 6px; }
      .title { font-size: 22px; font-weight: 700; line-height: 1.15; }
      .sub { font-size: 13px; color: var(--bo-mut); margin-top: 3px; }
      .progress { padding: 10px 18px 0; }
      .bar { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.14); cursor: pointer; position: relative; }
      .bar-fill { height: 100%; width: 0%; border-radius: 2px; background: var(--bo-amber); }
      .times { display: flex; justify-content: space-between; font-size: 11px; color: var(--bo-mut); margin-top: 6px; font-variant-numeric: tabular-nums; }
      .controls { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px 16px; }
      .ctl-btn { background: none; border: none; color: var(--bo-ink); cursor: pointer; padding: 8px; border-radius: 50%; display: grid; place-items: center; }
      .ctl-btn:hover { color: var(--bo-amber); }
      .ctl-btn.primary { background: var(--bo-amber); color: #12141c; width: 48px; height: 48px; }
      .ctl-btn.off { color: var(--bo-mut); }
      .searchwrap { display: flex; gap: 8px; padding: 10px 18px; }
      input.search { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; color: var(--bo-ink); padding: 8px 12px; font-size: 14px; }
      input.search::placeholder { color: var(--bo-mut); }
      .hint { padding: 4px 18px 8px; font-size: 12px; color: var(--bo-mut); }
      .list { border-top: 1px solid rgba(255,255,255,0.08); max-height: 280px; overflow-y: auto; }
      .row { display: flex; align-items: center; gap: 12px; padding: 11px 18px; cursor: pointer; }
      .row:hover { background: rgba(255,255,255,0.04); }
      .row.now { background: rgba(232,168,72,0.12); }
      .row .rt { flex: 1; min-width: 0; }
      .row .rt .t { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .row .rt .a { font-size: 12px; color: var(--bo-mut); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .row .eq { color: var(--bo-amber); font-size: 13px; flex-shrink: 0; }
      .row .idx { color: var(--bo-mut); font-size: 12px; width: 20px; text-align: right; flex-shrink: 0; }
      .group { padding: 8px 18px 4px; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--bo-amber); font-weight: 700; }
      .head { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px 8px; }
      .head .brand { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: var(--bo-amber); font-weight: 700; }
      .head .count { font-size: 12px; color: var(--bo-mut); }
      .thumb { width: 40px; height: 40px; border-radius: 6px; flex-shrink: 0; background-size: cover; background-position: center; }
      svg { width: 20px; height: 20px; fill: currentColor; }
    `;
  }

  constructor() {
    super();
    this._catalog = null;
    this._queue = [];
    this._current = null;
    this._playing = false;
    this._showList = true;
    this._progress = 0;
    this._duration = 0;
    this._shuffle = false;
    this._ma = false;
    this._players = [];
    this._player = "";
    this._mode = "hc";
    this._query = "";
    this._results = null;
    this._busy = false;
    this._audio = new Audio();
    this._audio.addEventListener("timeupdate", () => {
      this._progress = this._audio.currentTime || 0;
      this._duration = this._audio.duration || 0;
    });
    this._audio.addEventListener("ended", () => this._step(1));
    this._audio.addEventListener("playing", () => { this._playing = true; });
    this._audio.addEventListener("pause", () => { this._playing = false; });
  }

  setConfig(config) {
    this.config = { entity: "", title: "Heavy Comforter", ...config };
  }

  set hass(h) {
    this._hass = h;
    this._detect();
    if (!this._catalog) this._loadCatalog();
  }

  get hass() { return this._hass; }

  _detect() {
    const svc = this._hass && this._hass.services;
    this._ma = !!(svc && svc.music_assistant);
    const states = this._hass && this._hass.states;
    this._players = states ? Object.keys(states).filter(e => e.startsWith("media_player.")).sort() : [];
    if (!this._player && this._players.length) this._player = this._players[0];
    if (this.config && this.config.entity) this._player = this.config.entity;
  }

  async _loadCatalog() {
    try {
      const r = await fetch(CATALOG_URL);
      const m = await r.json();
      this._catalog = m;
      this._queue = (m.tracks || []).slice();
    } catch (e) {
      this._catalog = { name: "Heavy Comforter", tracks: [] };
    }
  }

  _play(item) {
    this._current = item;

    // Music Assistant path: item has a provider URI and MA is available + a player is chosen
    if (this._ma && this._player && item.uri) {
      this._hass.callService("music_assistant", "play_media", {
        media_id: item.uri,
        media_type: item.media_type || "track",
        enqueue: "play",
        target: { entity_id: this._player },
      });
      this._playing = true;
      return;
    }

    // Plain HA media_player path
    if (this._player && this._hass && (item.url || item.uri)) {
      this._hass.callService("media_player", "play_media", {
        entity_id: this._player,
        media_content_id: item.url || item.uri,
        media_content_type: "music",
      });
      this._playing = true;
      return;
    }

    // Browser fallback
    if (item.url) {
      this._audio.src = item.url;
      this._audio.play();
    }
  }

  _toggle() {
    if (!this._current) { if (this._queue.length) this._play(this._queue[0]); return; }
    if (this._player && this._hass) {
      this._hass.callService("media_player", this._playing ? "media_pause" : "media_play", { entity_id: this._player });
      this._playing = !this._playing;
      return;
    }
    if (this._playing) { this._audio.pause(); } else { this._audio.play(); }
  }

  _step(dir) {
    if (!this._queue.length) return;
    const idx = this._current ? this._queue.indexOf(this._current) : -1;
    const n = this._queue.length;
    const next = idx < 0 ? 0 : (idx + dir + n) % n;
    this._play(this._queue[next]);
  }

  _seek(e) {
    if (!this._audio || !this._duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    this._audio.currentTime = ratio * this._duration;
  }

  _toggleShuffle() {
    if (!this._catalog) return;
    this._shuffle = !this._shuffle;
    const tracks = this._catalog.tracks.slice();
    if (this._shuffle) {
      for (let i = tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
      }
    }
    this._queue = tracks;
  }

  _setMode(m) { this._mode = m; }

  async _search() {
    if (!this._ma || !this._query || !this._query.trim()) return;
    this._busy = true;
    this._results = null;
    try {
      const r = await this._hass.callService("music_assistant", "search", {
        name: this._query.trim(),
        limit: 20,
      });
      this._results = r || {};
    } catch (e) {
      this._results = { error: true };
    }
    this._busy = false;
  }

  _onQuery(e) {
    this._query = e.target.value;
  }

  _fmt(s) {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  _resultRows() {
    if (this._busy) return html`<div class="hint">Searching...</div>`;
    if (!this._results) return html`<div class="hint">Search your library and streaming providers.</div>`;
    if (this._results.error) return html`<div class="hint">Search failed. Is Music Assistant connected?</div>`;
    const groups = [];
    const add = (label, items, type) => {
      if (items && items.length) groups.push({ label, items, type });
    };
    add("Tracks", this._results.tracks, "track");
    add("Albums", this._results.albums, "album");
    add("Artists", this._results.artists, "artist");
    add("Playlists", this._results.playlists, "playlist");
    if (!groups.length) return html`<div class="hint">No results.</div>`;
    return groups.map(g => html`
      <div class="group">${g.label}</div>
      ${g.items.map(it => html`
        <div class="row" @click=${() => this._play({ ...it, media_type: it.media_type || g.type })}>
          <div class="thumb" style="background:${artFor(it)}"></div>
          <div class="rt">
            <div class="t">${it.name}</div>
            <div class="a">${artistStr(it)}</div>
          </div>
        </div>
      `)}
    `);
  }

  render() {
    const tracks = this._queue || [];
    const cur = this._current;
    const pct = this._duration ? (this._progress / this._duration) * 100 : 0;

    return html`
      <div class="bo">
        <div class="topbar">
          <div class="tabs">
            <button class="tab ${this._mode === "hc" ? "on" : ""}" @click=${() => this._setMode("hc")}>Heavy Comforter</button>
            ${this._ma ? html`<button class="tab ${this._mode === "search" ? "on" : ""}" @click=${() => this._setMode("search")}>Search</button>` : ""}
          </div>
          ${this._players.length ? html`
            <select class="players" @change=${(e) => (this._player = e.target.value)}>
              ${this._players.map(p => html`<option value="${p}" ?selected=${p === this._player}>${p.replace("media_player.", "")}</option>`)}
            </select>
          ` : ""}
        </div>

        ${this._mode === "search" ? html`
          <div class="searchwrap">
            <input class="search" type="text" placeholder="Artist, album, track, playlist..." .value=${this._query}
              @input=${this._onQuery} @keydown=${(e) => { if (e.key === "Enter") this._search(); }}>
            <button class="ctl-btn" @click=${this._search} title="Search">
              <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>
            </button>
          </div>
          <div class="list">${this._resultRows()}</div>
        ` : html`
          <div class="art">
            <div class="art-bg" style="background:${cur ? artFor(cur) : "linear-gradient(135deg, #1c1f2b, #12141c)"};"></div>
            <div class="art-scrim"></div>
            <div class="art-text">
              <div class="badge">${this.config && this.config.title ? this.config.title : "Big On"}</div>
              <div class="title">${cur ? cur.title || cur.name : "Nothing playing"}</div>
              <div class="sub">${cur ? (artistStr(cur) + (cur.album ? " · " + cur.album : "")) : "Pick a track below"}</div>
            </div>
          </div>
          <div class="progress">
            <div class="bar" @click=${this._seek}><div class="bar-fill" style="width:${pct}%"></div></div>
            <div class="times"><span>${this._fmt(this._progress)}</span><span>${this._fmt(this._duration)}</span></div>
          </div>
          <div class="controls">
            <button class="ctl-btn ${this._shuffle ? "" : "off"}" @click=${this._toggleShuffle} title="Shuffle">
              <svg viewBox="0 0 24 24"><path d="M10.6 9.6 8.4 7.4A5.99 5.99 0 0 0 4 6v2a4 4 0 0 1 2.6.9l2.2 2.2L10.6 9.6Zm9.4-.6V5l-2.4 2.4A6 6 0 0 0 13 4v2a4 4 0 0 1 3 1.2L18 9.2 20 9Zm0 6-2-2-2 2h4ZM13 18v-2a4 4 0 0 1-3-1.2L8.4 16a6 6 0 0 0 4.6 2Zm-9.4-2.4L5.8 17 8 17.6l2.2-2.2L8 13.2l-2.4 2.4Z"/></svg>
            </button>
            <button class="ctl-btn" @click=${() => this._step(-1)} title="Previous">
              <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
            </button>
            <button class="ctl-btn primary" @click=${this._toggle} title="Play / Pause">
              ${this._playing
                ? html`<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`
                : html`<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`}
            </button>
            <button class="ctl-btn" @click=${() => this._step(1)} title="Next">
              <svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>
            </button>
            <button class="ctl-btn ${this._showList ? "" : "off"}" @click=${() => (this._showList = !this._showList)} title="Track list">
              <svg viewBox="0 0 24 24"><path d="M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z"/></svg>
            </button>
          </div>
          ${this._showList ? html`
            <div class="head">
              <span class="brand">${this._catalog ? this._catalog.name : "Heavy Comforter"}</span>
              <span class="count">${tracks.length} tracks</span>
            </div>
            <div class="list">
              ${tracks.map((t, i) => html`
                <div class="row ${cur === t ? "now" : ""}" @click=${() => this._play(t)}>
                  <span class="idx">${cur === t ? "" : i + 1}</span>
                  ${cur === t ? html`<span class="eq">♫</span>` : ""}
                  <div class="rt">
                    <div class="t">${t.title}</div>
                    <div class="a">${t.album || ""}</div>
                  </div>
                </div>
              `)}
            </div>
          ` : ""}
        `}
      </div>
    `;
  }

  getCardSize() {
    return this._showList ? 9 : 6;
  }

  static getStubConfig() {
    return { entity: "", title: "Heavy Comforter" };
  }
}

customElements.define("big-on-card", BigOnCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "big-on-card", name: "Big On", description: "Music player for Home Assistant, pre loaded with Heavy Comforter. Drives Music Assistant for your library and streams." });
