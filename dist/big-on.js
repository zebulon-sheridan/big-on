import { LitElement, html, css } from "https://unpkg.com/lit@2.8.0/index.js?module";

const CATALOG_URL = "https://heavycomforter.com/audio/catalog.json";
const VERSION = "0.6.0";
const ADDON_SLUG = "d5369777_music_assistant";
const MA_REPO_URL = "https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fmusic-assistant%2Fhome-assistant-addon";
const SQUEEZELITE_REPO_URL = "https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fpssc%2Fha-addon-squeezelite";

const PROVIDERS = [
  { name: "Spotify", sub: "Streaming" },
  { name: "YouTube Music", sub: "Streaming" },
  { name: "Tidal", sub: "Streaming" },
  { name: "Apple Music", sub: "Streaming" },
  { name: "Qobuz", sub: "Streaming" },
  { name: "Deezer", sub: "Streaming" },
  { name: "SoundCloud", sub: "Streaming" },
  { name: "Local files", sub: "SMB / NFS shares" },
];

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
      _setup: { state: true },
      _consented: { state: true },
      _consentOk: { state: true },
      _supervisor: { state: true },
      _legacyMass: { state: true },
      _installing: { state: true },
      _installErr: { state: true },
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

      /* setup */
      .setup { padding: 18px; }
      .setup h2 { margin: 0 0 10px; font-size: 18px; }
      .setup p { margin: 0 0 12px; font-size: 13px; color: var(--bo-mut); line-height: 1.5; }
      .consent { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid rgba(232,168,72,0.4); border-radius: 8px; margin: 12px 0; background: rgba(232,168,72,0.06); }
      .consent input { margin-top: 2px; }
      .consent label { font-size: 12.5px; color: var(--bo-ink); line-height: 1.45; }
      .btn { display: inline-block; background: var(--bo-amber); color: #12141c; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; }
      .btn:disabled { background: rgba(255,255,255,0.08); color: var(--bo-mut); cursor: not-allowed; }
      .btn.ghost { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: var(--bo-ink); font-weight: 400; }
      .step { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
      .step:last-child { border-bottom: none; }
      .step .num { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.08); color: var(--bo-ink); display: grid; place-items: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
      .step.done .num { background: var(--bo-amber); color: #12141c; }
      .step .st { flex: 1; min-width: 0; }
      .step .st .t { font-size: 14px; font-weight: 600; }
      .step .st .d { font-size: 12px; color: var(--bo-mut); margin-top: 3px; line-height: 1.5; }
      .step .st a { color: var(--bo-amber); }
      .provgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
      .prov { display: flex; flex-direction: column; gap: 3px; padding: 10px; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; background: rgba(255,255,255,0.03); }
      .pv-n { font-size: 13px; font-weight: 600; }
      .pv-d { font-size: 11px; color: var(--bo-mut); }
      .banner { margin: 8px 14px; padding: 10px 14px; border: 1px solid rgba(232,168,72,0.35); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: rgba(232,168,72,0.05); }
      .banner .bt { font-size: 13px; font-weight: 600; }
      .banner .bs { font-size: 11.5px; color: var(--bo-mut); margin-top: 2px; }
      .warn { margin: 0 0 14px; padding: 10px 14px; border: 1px solid rgba(224,90,90,0.4); border-radius: 8px; background: rgba(224,90,90,0.08); font-size: 12px; color: #e8c9c9; line-height: 1.5; }
      .warn b { color: #f2d0d0; }
      .code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 4px; font-size: 11px; }
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
    this._setup = false;
    this._consented = false;
    this._supervisor = false;
    this._legacyMass = false;
    this._installing = false;
    this._installErr = false;
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
    this.config = { entity: "", title: "Heavy Comforter", ma_url: "", ...config };
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
    this._supervisor = !!(svc && svc.hassio);
    this._legacyMass = !!(svc && svc.mass);
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
    if (this._player && this._hass && (item.url || item.uri)) {
      this._hass.callService("media_player", "play_media", {
        entity_id: this._player,
        media_content_id: item.url || item.uri,
        media_content_type: "music",
      });
      this._playing = true;
      return;
    }
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

  _onQuery(e) { this._query = e.target.value; }

  async _installAddon() {
    this._installing = true;
    this._installErr = false;
    try {
      await this._hass.callService("hassio", "addon_install", { slug: ADDON_SLUG });
      await this._hass.callService("hassio", "addon_start", { slug: ADDON_SLUG });
    } catch (e) {
      this._installErr = true;
    }
    this._installing = false;
    this._detect();
  }

  _maUrl() {
    return (this.config && this.config.ma_url) ? this.config.ma_url : "/music-assistant";
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
    const add = (label, items, type) => { if (items && items.length) groups.push({ label, items, type }); };
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

  _renderSetup() {
    if (!this._consented) {
      return html`
        <div class="bo"><div class="setup">
          <div class="badge">Big On</div>
          <h2>Set up Music Assistant</h2>
          <p>Big On plays your music through Music Assistant. This adds two things to your system: the Music Assistant server, and a link between Home Assistant and that server.</p>
          <p>Music Assistant is a separate, open-source service. After it is running, you add your own music sources and sign in with your own accounts. Nothing is sent to Big On or to Heavy Comforter.</p>
          <div class="consent">
            <input type="checkbox" id="bo-consent" @change=${(e) => (this._consentOk = e.target.checked)}>
            <label for="bo-consent">I understand this installs the Music Assistant server and a Home Assistant integration, and that I will add my own music sources and log in with my own accounts.</label>
          </div>
          <button class="btn" ?disabled=${!this._consentOk} @click=${() => (this._consented = true)}>Continue</button>
          <button class="btn ghost" style="margin-left:8px;" @click=${() => (this._setup = false)}>Cancel</button>
        </div></div>
      `;
    }

    const installed = this._ma;
    return html`
      <div class="bo"><div class="setup">
        <div class="badge">Big On</div>
        <h2>Set up Music Assistant</h2>

        ${this._legacyMass ? html`
          <div class="warn"><b>Old Music Assistant integration found.</b> You have the deprecated "Music Assistant" (mass) custom integration installed. It conflicts with the current one. Remove it under Settings, then Devices and services, then restart Home Assistant.</div>
        ` : ""}

        <div class="step ${this._supervisor && !this._installErr ? "done" : ""}">
          <div class="num">1</div>
          <div class="st">
            <div class="t">Install the Music Assistant server</div>
            ${this._supervisor
              ? html`
                <div class="d">You are on Home Assistant OS or Supervised, so this can run here. Add the repository, then install.</div>
                <div style="margin-top:8px;">
                  <a class="btn ghost" style="text-decoration:none;" href=${MA_REPO_URL} target="_blank" rel="noopener">Add Music Assistant repository</a>
                  <button class="btn" style="margin-left:8px;" ?disabled=${this._installing} @click=${this._installAddon}>${this._installing ? "Installing..." : "Install add-on"}</button>
                </div>
                ${this._installErr ? html`<div class="d" style="margin-top:6px;">Could not install automatically. Open the add-on store, find Music Assistant, and install it there.</div>` : ""}
                <div style="margin-top:6px;"><a class="btn ghost" style="text-decoration:none;" href="/hassio/store">Open add-on store</a></div>`
              : html`
                <div class="d">The add-on store isn't available here, so the card can't install Music Assistant for you. This needs Home Assistant OS or Supervised. Install Music Assistant yourself, then come back and connect it. <a href="https://www.music-assistant.io/installation/" target="_blank">Installation guide</a>.</div>`}
          </div>
        </div>

        <div class="step">
          <div class="num">2</div>
          <div class="st">
            <div class="t">Show Music Assistant in the sidebar</div>
            ${this._supervisor
              ? html`
                <div class="d">This is the step most people miss. On the Music Assistant add-on, enable "Show in sidebar" and "Start on boot". That puts the Music Assistant panel where you can reach it.</div>
                <div style="margin-top:8px;"><a class="btn ghost" style="text-decoration:none;" href="/hassio/addon/${ADDON_SLUG}/info">Open add-on settings</a></div>`
              : html`
                <div class="d">You run Music Assistant outside Home Assistant, so there is no add-on sidebar. Open its web interface directly instead.</div>`}
          </div>
        </div>

        <div class="step ${installed ? "done" : ""}">
          <div class="num">3</div>
          <div class="st">
            <div class="t">Connect Home Assistant to Music Assistant</div>
            <div class="d">Add the Music Assistant integration. It is usually auto-discovered once the server is running.</div>
            <div style="margin-top:8px;"><a class="btn ghost" style="text-decoration:none;" href="/config/integrations">Open integrations</a></div>
          </div>
        </div>

        <div class="step">
          <div class="num">4</div>
          <div class="st">
            <div class="t">Connect your music services</div>
            <div class="d">Open Music Assistant and log in to each service you use. Big On never sees your passwords. The login happens inside Music Assistant.</div>
            <div style="margin-top:10px;">
              <a class="btn" href=${this._maUrl()} target="_blank" rel="noopener" style="text-decoration:none;">Open Music Assistant</a>
            </div>
            <div class="provgrid">
              ${PROVIDERS.map(p => html`
                <div class="prov">
                  <span class="pv-n">${p.name}</span>
                  <span class="pv-d">${p.sub}</span>
                </div>
              `)}
            </div>
            ${!this.config.ma_url ? html`<div class="d" style="margin-top:8px;">If this doesn't open Music Assistant, set its web address in the card options (ma_url).</div>` : ""}
          </div>
        </div>

        <div class="step ${this._players.length ? "done" : ""}">
          <div class="num">5</div>
          <div class="st">
            <div class="t">Add a speaker or player</div>
            <div class="d">Big On plays through Music Assistant players. If you have no player yet, a Raspberry Pi with a headphone jack or USB DAC works great.</div>
            ${this._supervisor
              ? html`
                <div class="d" style="margin-top:6px;">On Home Assistant OS, add the Squeezelite add-on and point it at your sound card.</div>
                <div style="margin-top:8px;"><a class="btn ghost" style="text-decoration:none;" href=${SQUEEZELITE_REPO_URL} target="_blank" rel="noopener">Add Squeezelite repository</a></div>
                <div class="d" style="margin-top:6px;">In the add-on, set the sound card to your USB DAC. Try <span class="code">hw:CARD=Audio,DEV=0</span>, or <span class="code">plughw:1,0</span> if that is silent. If audio stutters, use the <span class="code">alsa</span> build and add <span class="code">-a 150ms</span>.</div>`
              : html`
                <div class="d" style="margin-top:6px;">On a separate Linux box, install Squeezelite and point it at your sound card.</div>`}
            <div style="margin-top:8px;">
              <a class="btn ghost" style="text-decoration:none;" href=${this._maUrl()} target="_blank" rel="noopener">Open Music Assistant players</a>
              <button class="btn ghost" style="margin-left:8px;" @click=${this._detect}>Re-check</button>
            </div>
            ${this._players.length
              ? html`<div class="d" style="margin-top:6px;">${this._players.length} player${this._players.length === 1 ? "" : "s"} found. Pick one from the dropdown up top.</div>`
              : html`<div class="d" style="margin-top:6px;">No players found yet. After you start Squeezelite, hit Re-check.</div>`}
          </div>
        </div>

        <div class="step ${installed ? "done" : ""}">
          <div class="num">6</div>
          <div class="st">
            <div class="t">${installed ? "Connected" : "Waiting for Music Assistant"}</div>
            <div class="d">${installed ? "Music Assistant is connected. Search and players are now available." : "Once it is connected, this card will notice and turn on Search automatically."}</div>
            ${!installed ? html`<div style="margin-top:8px;"><button class="btn ghost" @click=${this._detect}>Re-check</button></div>` : ""}
          </div>
        </div>

        <div style="margin-top:14px;">
          <button class="btn" @click=${() => (this._setup = false)}>${installed ? "Done" : "Close"}</button>
        </div>
      </div></div>
    `;
  }

  render() {
    if (this._setup) return this._renderSetup();

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

        ${!this._ma ? html`
          <div class="banner">
            <div>
              <div class="bt">Play your own music</div>
              <div class="bs">Connect Music Assistant to search your library and streams.</div>
            </div>
            <button class="btn" @click=${() => (this._setup = true)}>Set up</button>
          </div>
        ` : ""}

        ${this._ma && !this._players.length ? html`
          <div class="banner">
            <div>
              <div class="bt">Add a speaker</div>
              <div class="bs">Music Assistant is connected but has no players yet.</div>
            </div>
            <button class="btn" @click=${() => (this._setup = true)}>Set up</button>
          </div>
        ` : ""}

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
    return { entity: "", title: "Heavy Comforter", ma_url: "" };
  }
}

customElements.define("big-on-card", BigOnCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "big-on-card", name: "Big On", description: "Music player for Home Assistant, pre loaded with Heavy Comforter. Drives Music Assistant for your library and streams." });
