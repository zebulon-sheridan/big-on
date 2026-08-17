import { LitElement, html, css } from "https://unpkg.com/lit@2.8.0/index.js?module";

const CATALOG_URL = "https://heavycomforter.com/audio/catalog.json";
const VERSION = "0.1.0";

class BigOnCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _catalog: { type: Object, state: true },
      _current: { type: Object, state: true },
      _playing: { type: Boolean, state: true },
      _audio: { type: Object, state: true },
    };
  }

  static get styles() {
    return css`
      :host { display: block; }
      .bo { font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif); color: var(--primary-text-color); }
      .bo-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
      .bo-art { width: 64px; height: 64px; border-radius: 6px; background: var(--secondary-background-color); display: grid; place-items: center; overflow: hidden; }
      .bo-title { font-weight: 600; }
      .bo-sub { color: var(--secondary-text-color); font-size: 0.9em; }
      .bo-list { max-height: 320px; overflow-y: auto; border: 1px solid var(--divider-color); border-radius: 8px; }
      .bo-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--divider-color); }
      .bo-row:last-child { border-bottom: none; }
      .bo-row:hover { background: var(--secondary-background-color); }
      .bo-row.playing { background: var(--primary-color); color: var(--text-primary-color, #fff); }
      .bo-row .idx { width: 24px; text-align: right; color: var(--secondary-text-color); flex-shrink: 0; }
      .bo-controls { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
      button.bo-btn { border: none; background: var(--primary-color); color: var(--text-primary-color, #fff); padding: 8px 16px; border-radius: 6px; cursor: pointer; }
    `;
  }

  setConfig(config) {
    this.config = { entity: "", ...config };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._catalog) this._loadCatalog();
  }

  get hass() {
    return this._hass;
  }

  async _loadCatalog() {
    try {
      const r = await fetch(CATALOG_URL);
      this._catalog = await r.json();
    } catch (e) {
      this._catalog = { tracks: [] };
    }
  }

  _play(track) {
    this._current = track;

    // 1. If a target media player is configured, hand the URL to it.
    const entity = this.config && this.config.entity;
    if (entity) {
      this._hass.callService("media_player", "play_media", {
        entity_id: entity,
        media_content_id: track.url,
        media_content_type: "music",
      });
      this._playing = true;
      return;
    }

    // 2. Fallback: play in the dashboard itself.
    if (!this._audio) this._audio = new Audio();
    this._audio.src = track.url;
    this._audio.play();
    this._playing = true;
  }

  _stop() {
    if (this._audio) this._audio.pause();
    this._playing = false;
  }

  render() {
    const tracks = (this._catalog && this._catalog.tracks) || [];
    return html`
      <ha-card>
        <div class="bo" style="padding:16px;">
          <div class="bo-head">
            <div class="bo-art">${this._current ? html`<span>♪</span>` : html`<span>HC</span>`}</div>
            <div>
              <div class="bo-title">${this._current ? this._current.title : "Big On"}</div>
              <div class="bo-sub">${this._catalog ? this._catalog.name + " · " + tracks.length + " tracks" : "Loading catalog..."}</div>
            </div>
          </div>

          <div class="bo-list">
            ${tracks.map((t, i) => html`
              <div class="bo-row ${this._current === t ? "playing" : ""}" @click=${() => this._play(t)}>
                <span class="idx">${i + 1}</span>
                <span>${t.title}</span>
              </div>
            `)}
          </div>

          <div class="bo-controls">
            <button class="bo-btn" @click=${() => (this._playing ? this._stop() : this._current && this._play(this._current))}>
              ${this._playing ? "Stop" : "Play"}
            </button>
            <span class="bo-sub">${this.config && this.config.entity ? "Playing on " + this.config.entity : "No player selected"}</span>
          </div>
        </div>
      </ha-card>
    `;
  }

  getCardSize() {
    return 6;
  }

  static getStubConfig() {
    return { entity: "" };
  }
}

customElements.define("big-on-card", BigOnCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "big-on-card", name: "Big On", description: "Music player for Home Assistant, pre loaded with Heavy Comforter." });
