// 効果音（WebAudio合成）
// 外部音源ファイルなしで、ブラウザで音を合成する。
// - 弾発射: 高めの短いビープ + クイックディケイ
// - 剣の振り: ホワイトノイズ + バンドパス
// - ヒット: 低音ボン + ノイズ
// - 死亡/勝敗: 短いメロディ
// 初回はユーザー操作が必要なので、最初のキー押下で resume() する。

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._ready = false;
  }

  // 最初の入力で呼ぶ
  ensureStarted() {
    if (this._ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    this._ready = true;
  }

  setMuted(v) {
    this.muted = !!v;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
  }

  // --- 個別SE ---
  fire() {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.08);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  sword() {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    // ホワイトノイズを短時間
    const dur = 0.22;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    // バンドパスでシャッという音に
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3500, t);
    bp.frequency.exponentialRampToValueAtTime(900, t + dur);
    bp.Q.value = 1.2;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  hit() {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    // ボン（サイン低音）+ノイズ
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);
    const g1 = this.ctx.createGain();
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(g1).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.3);

    // ノイズ
    const dur = 0.15;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 600;
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.25, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(hp).connect(g2).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  // プレイヤー被弾（鈍く重め）
  hurt() {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  // 撃破（敵）
  enemyDown() {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    // 下降グリッサンド + ノイズ爆発
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.55);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.65);

    // 爆音ノイズ
    const dur = 0.4;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2000, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + dur);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.5, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(lp).connect(g2).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  // 勝利ジングル
  win() {
    this._melody([
      { f: 523.25, d: 0.12 }, // C5
      { f: 659.25, d: 0.12 }, // E5
      { f: 783.99, d: 0.12 }, // G5
      { f: 1046.5, d: 0.28 }, // C6
    ]);
  }

  // 敗北ジングル
  lose() {
    this._melody([
      { f: 392.0, d: 0.18 }, // G4
      { f: 349.23, d: 0.18 }, // F4
      { f: 311.13, d: 0.18 }, // Eb4
      { f: 261.63, d: 0.5 },  // C4
    ]);
  }

  // カウントダウンビープ
  countdown(isGo = false) {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = isGo ? 880 : 440;
    const g = this.ctx.createGain();
    const dur = isGo ? 0.35 : 0.12;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _melody(notes) {
    if (!this._ready || this.muted) return;
    let t = this.ctx.currentTime;
    for (const n of notes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = n.f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + n.d);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + n.d + 0.02);
      t += n.d;
    }
  }

  // ===== 武器・盾・乗り物 特有効果音 ========================================

  // 短いノイズバースト用ヘルパー
  _noiseBurst(dur, freqStart, freqEnd, qVal, gainVal, filterType = 'bandpass') {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, Math.max(64, this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.2);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.setValueAtTime(freqStart, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + dur);
    filt.Q.value = qVal;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  // 短いサイン/三角/矩形ピン
  _tonePing(type, freqStart, freqEnd, dur, gainVal) {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gainVal, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // 武器IDから属性をざっくり推定（'fire'|'frost'|'thunder'|'holy'|'dark'|'rainbow'|null）
  _weaponElement(weapon) {
    const id = weapon?.id || '';
    if (id.includes('fire') || id.includes('flame') || id.includes('rocket') || id.includes('dragon')) return 'fire';
    if (id.includes('frost') || id.includes('ice')) return 'frost';
    if (id.includes('thunder') || id.includes('laser') || id.includes('plasma') || id.includes('rail')) return 'thunder';
    if (id.includes('holy') || id.includes('star')) return 'holy';
    if (id.includes('demon') || id.includes('dark') || id.includes('void') || id.includes('chaos')) return 'dark';
    if (id.includes('rainbow') || id.includes('prism')) return 'rainbow';
    return null;
  }

  // --- 剣の振り（武器ごとに音色を変える） ---
  swordSwing(weapon) {
    if (!this._ready || this.muted) return;
    // ベース: 風切り音（ホワイトノイズ + バンドパス）
    const elem = this._weaponElement(weapon);
    // 重い剣ほど低い周波数、軽い剣ほど高い
    const dmgMul = weapon?.dmgMul ?? 1;
    const heavy = dmgMul >= 2.3;
    const baseStart = heavy ? 2800 : 4200;
    const baseEnd = heavy ? 700 : 1100;
    const baseGain = heavy ? 0.5 : 0.4;
    this._noiseBurst(heavy ? 0.28 : 0.22, baseStart, baseEnd, 1.2, baseGain, 'bandpass');
    // 属性で短い金属/魔法トーンを重ねる
    if (elem === 'fire') {
      this._noiseBurst(0.18, 1800, 400, 1.6, 0.25, 'bandpass');
    } else if (elem === 'frost') {
      this._tonePing('triangle', 1800, 900, 0.18, 0.18);
    } else if (elem === 'thunder') {
      this._tonePing('square', 1200, 200, 0.1, 0.22);
    } else if (elem === 'holy') {
      this._tonePing('sine', 2400, 1200, 0.25, 0.18);
      this._tonePing('sine', 3200, 1600, 0.25, 0.12);
    } else if (elem === 'dark') {
      this._tonePing('sawtooth', 220, 80, 0.25, 0.22);
    } else if (elem === 'rainbow') {
      this._tonePing('sine', 880, 1760, 0.18, 0.15);
      this._tonePing('triangle', 1320, 2640, 0.18, 0.12);
    }
  }

  // --- 銃の発射（種類で音色を変える） ---
  gunFire(weapon) {
    if (!this._ready || this.muted) return;
    const id = weapon?.id || '';
    const t = this.ctx.currentTime;
    // 共通: ショートクリック
    const click = () => {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.05);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.08);
    };

    if (id === 'gun_shotgun') {
      // 重い破裂音
      this._noiseBurst(0.35, 2200, 200, 1.0, 0.55, 'lowpass');
      this._tonePing('sawtooth', 90, 40, 0.25, 0.45);
    } else if (id === 'gun_sniper' || id === 'gun_railgun') {
      // 鋭く乾いた高音 + 長い残響感
      click();
      this._noiseBurst(0.5, 5000, 600, 2.0, 0.3, 'bandpass');
      this._tonePing('square', 2200, 800, 0.18, 0.18);
    } else if (id === 'gun_rocket') {
      // 長い噴射 + 低音ブーム
      this._noiseBurst(0.6, 800, 80, 0.8, 0.55, 'lowpass');
      this._tonePing('sawtooth', 60, 30, 0.5, 0.4);
    } else if (id === 'gun_plasma' || id === 'gun_laser') {
      // ピュッ系 (高音グリッサンド)
      this._tonePing('square', 2200, 700, 0.12, 0.32);
      this._tonePing('triangle', 4000, 1200, 0.1, 0.18);
    } else if (id === 'gun_minigun' || id === 'gun_smg') {
      // 軽いポップ
      click();
      this._noiseBurst(0.08, 2400, 800, 1.5, 0.25, 'bandpass');
    } else {
      // ピストル/ライフル
      click();
      this._noiseBurst(0.18, 3000, 500, 1.2, 0.35, 'bandpass');
    }
  }

  // --- 杖の魔法詠唱 ---
  wandCast(weapon) {
    if (!this._ready || this.muted) return;
    const elem = this._weaponElement(weapon);
    // ベース: 倍音のあるベル系
    if (elem === 'fire') {
      this._tonePing('sawtooth', 600, 200, 0.25, 0.25);
      this._noiseBurst(0.2, 1400, 400, 1.2, 0.2, 'bandpass');
    } else if (elem === 'frost') {
      this._tonePing('triangle', 1800, 1100, 0.3, 0.22);
      this._tonePing('sine', 2600, 1800, 0.25, 0.15);
    } else if (elem === 'thunder') {
      this._tonePing('square', 900, 200, 0.18, 0.3);
      this._tonePing('sawtooth', 1400, 300, 0.12, 0.2);
    } else if (elem === 'holy') {
      this._tonePing('sine', 880, 1320, 0.35, 0.25);
      this._tonePing('sine', 1320, 1760, 0.35, 0.18);
    } else if (elem === 'dark') {
      this._tonePing('sawtooth', 180, 70, 0.4, 0.3);
      this._tonePing('square', 360, 140, 0.3, 0.15);
    } else if (elem === 'rainbow') {
      this._tonePing('sine', 660, 990, 0.2, 0.18);
      this._tonePing('triangle', 990, 1320, 0.2, 0.15);
      this._tonePing('square', 1320, 1980, 0.2, 0.12);
    } else {
      this._tonePing('triangle', 1000, 500, 0.25, 0.22);
      this._tonePing('sine', 1500, 750, 0.25, 0.15);
    }
  }

  // --- 盾で防いだ時の金属音 ---
  shieldBlock(shieldCfg) {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    // 主要: ベル系の金属音
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1600, t);
    osc1.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    const g1 = this.ctx.createGain();
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.exponentialRampToValueAtTime(0.45, t + 0.008);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc1.connect(g1).connect(this.master);
    osc1.start(t);
    osc1.stop(t + 0.32);
    // 重ねる金属ノイズ
    this._noiseBurst(0.12, 4000, 1500, 2.0, 0.25, 'bandpass');
  }

  // --- ドラゴンの火の玉（発射音）: 低音の爆発ドスン + 炎のヒュオッ ---
  dragonFireball() {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    // (1) 低音の爆発(サブベースのドスン)
    const boom = this.ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(150, t);
    boom.frequency.exponentialRampToValueAtTime(42, t + 0.3);
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(0.55, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    boom.connect(bg).connect(this.master);
    boom.start(t); boom.stop(t + 0.36);
    // (2) 炎の噴出「ヒュオッ」(下降するバンドパスノイズ)
    this._noiseBurst(0.3, 2600, 500, 1.2, 0.4, 'bandpass');
    // (3) 火の粉のパチッ(高域の短いノイズ)
    this._noiseBurst(0.1, 5200, 2800, 2.5, 0.16, 'highpass');
  }

  // --- ドラゴンの火炎放射（ポケモン風・1.5秒） ---
  // 構成: 噴射の轟音(roar) + 燃え盛るホワイトノイズ + 不規則パチパチ + 低音うなり
  dragonFire() {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    const dur = 1.4;

    // (1) ベースの大規模ノイズ（炎の身体）
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * dur, sr);
    const data = buf.getChannelData(0);
    // ピンクノイズ風: ローパスを通すノイズに揺らぎを与える
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // 0.05秒周期のうねり（噴射の波）
      const wob = 0.5 + 0.5 * Math.sin((i / sr) * Math.PI * 2 * 7);
      // ピンクノイズ近似（連続ステップ）
      const white = Math.random() * 2 - 1;
      last = 0.96 * last + 0.04 * white;
      const env = Math.min(1, (i / sr) / 0.06) * (1 - Math.max(0, ((i / sr) - (dur - 0.2)) / 0.2));
      data[i] = (last * 6.0) * (0.55 + 0.45 * wob) * env;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    // 帯域分割: ローパス(燃え盛る重み) + バンドパス(炎のシャー音)
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + dur);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, t);
    bp.frequency.exponentialRampToValueAtTime(1600, t + dur);
    bp.Q.value = 0.9;
    const gLow = this.ctx.createGain();
    gLow.gain.setValueAtTime(0.0001, t);
    gLow.gain.exponentialRampToValueAtTime(0.6, t + 0.06);
    gLow.gain.setValueAtTime(0.6, t + dur - 0.25);
    gLow.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const gHi = this.ctx.createGain();
    gHi.gain.setValueAtTime(0.0001, t);
    gHi.gain.exponentialRampToValueAtTime(0.35, t + 0.08);
    gHi.gain.setValueAtTime(0.35, t + dur - 0.25);
    gHi.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(lp).connect(gLow).connect(this.master);
    src.connect(bp).connect(gHi).connect(this.master);
    src.start(t);
    src.stop(t + dur);

    // (2) 噴射初動の轟音（ボッ）
    this._noiseBurst(0.12, 400, 80, 0.6, 0.55, 'lowpass');
    // (3) 低音うなり（ドラゴンの咆哮）
    const roar = this.ctx.createOscillator();
    roar.type = 'sawtooth';
    roar.frequency.setValueAtTime(90, t);
    roar.frequency.exponentialRampToValueAtTime(55, t + dur);
    const roarG = this.ctx.createGain();
    roarG.gain.setValueAtTime(0.0001, t);
    roarG.gain.exponentialRampToValueAtTime(0.28, t + 0.1);
    roarG.gain.setValueAtTime(0.28, t + dur - 0.3);
    roarG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    // サブベース
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(45, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + dur);
    const subG = this.ctx.createGain();
    subG.gain.setValueAtTime(0.0001, t);
    subG.gain.exponentialRampToValueAtTime(0.32, t + 0.08);
    subG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    roar.connect(roarG).connect(this.master);
    sub.connect(subG).connect(this.master);
    roar.start(t); roar.stop(t + dur);
    sub.start(t); sub.stop(t + dur);

    // (4) パチパチ（不規則クラックル・10〜18回）
    const crackleCount = 12 + Math.floor(Math.random() * 7);
    for (let i = 0; i < crackleCount; i++) {
      const tt = t + 0.06 + Math.random() * (dur - 0.15);
      const cdur = 0.02 + Math.random() * 0.04;
      const cbuf = this.ctx.createBuffer(1, sr * cdur, sr);
      const cd = cbuf.getChannelData(0);
      for (let j = 0; j < cd.length; j++) cd[j] = (Math.random() * 2 - 1);
      const csrc = this.ctx.createBufferSource();
      csrc.buffer = cbuf;
      const cbp = this.ctx.createBiquadFilter();
      cbp.type = 'bandpass';
      cbp.frequency.value = 2800 + Math.random() * 2200;
      cbp.Q.value = 4;
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.0001, tt);
      cg.gain.exponentialRampToValueAtTime(0.18 + Math.random() * 0.12, tt + 0.002);
      cg.gain.exponentialRampToValueAtTime(0.0001, tt + cdur);
      csrc.connect(cbp).connect(cg).connect(this.master);
      csrc.start(tt);
      csrc.stop(tt + cdur);
    }
  }

  // --- UFO の落雷（リアル系・1.0秒） ---
  // 構成: 前駆チャージ → シャープな雷鳴インパルス → 太い雷鳴(thunder) + 残響シズル
  ufoLightning() {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    const sr = this.ctx.sampleRate;

    // (1) 前駆: 高音シズル（電荷溜め）0.08秒
    const preDur = 0.08;
    const preBuf = this.ctx.createBuffer(1, sr * preDur, sr);
    const pre = preBuf.getChannelData(0);
    for (let i = 0; i < pre.length; i++) pre[i] = (Math.random() * 2 - 1);
    const preSrc = this.ctx.createBufferSource();
    preSrc.buffer = preBuf;
    const preBp = this.ctx.createBiquadFilter();
    preBp.type = 'bandpass';
    preBp.frequency.setValueAtTime(6000, t);
    preBp.frequency.exponentialRampToValueAtTime(9000, t + preDur);
    preBp.Q.value = 6;
    const preG = this.ctx.createGain();
    preG.gain.setValueAtTime(0.0001, t);
    preG.gain.exponentialRampToValueAtTime(0.32, t + 0.04);
    preG.gain.exponentialRampToValueAtTime(0.001, t + preDur);
    preSrc.connect(preBp).connect(preG).connect(this.master);
    preSrc.start(t);
    preSrc.stop(t + preDur);

    // (2) 雷鳴インパルス（バチッ！）
    const strikeT = t + preDur;
    const click = this.ctx.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(2400, strikeT);
    click.frequency.exponentialRampToValueAtTime(120, strikeT + 0.06);
    const clickG = this.ctx.createGain();
    clickG.gain.setValueAtTime(0.0001, strikeT);
    clickG.gain.exponentialRampToValueAtTime(0.55, strikeT + 0.003);
    clickG.gain.exponentialRampToValueAtTime(0.001, strikeT + 0.18);
    click.connect(clickG).connect(this.master);
    click.start(strikeT);
    click.stop(strikeT + 0.2);

    // (3) 太い雷鳴（ゴロゴロ）: ロー帯ノイズで包む 0.8秒
    const rumbDur = 0.85;
    const rumbBuf = this.ctx.createBuffer(1, sr * rumbDur, sr);
    const rd = rumbBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < rd.length; i++) {
      const w = Math.random() * 2 - 1;
      last = 0.985 * last + 0.015 * w;
      const env = Math.exp(-((i / sr) / 0.6));
      // 揺らぎ
      const wob = 0.7 + 0.3 * Math.sin((i / sr) * Math.PI * 2 * 11);
      rd[i] = last * 12.0 * env * wob;
    }
    const rumbSrc = this.ctx.createBufferSource();
    rumbSrc.buffer = rumbBuf;
    const rumbLp = this.ctx.createBiquadFilter();
    rumbLp.type = 'lowpass';
    rumbLp.frequency.setValueAtTime(380, strikeT);
    rumbLp.frequency.exponentialRampToValueAtTime(120, strikeT + rumbDur);
    const rumbG = this.ctx.createGain();
    rumbG.gain.setValueAtTime(0.0001, strikeT);
    rumbG.gain.exponentialRampToValueAtTime(0.5, strikeT + 0.02);
    rumbG.gain.exponentialRampToValueAtTime(0.001, strikeT + rumbDur);
    rumbSrc.connect(rumbLp).connect(rumbG).connect(this.master);
    rumbSrc.start(strikeT);
    rumbSrc.stop(strikeT + rumbDur);

    // (4) 後続シズル（残留放電）: バンドパスノイズ 0.4秒
    const sizzleT = strikeT + 0.02;
    const sizDur = 0.42;
    const sizBuf = this.ctx.createBuffer(1, sr * sizDur, sr);
    const sd = sizBuf.getChannelData(0);
    for (let i = 0; i < sd.length; i++) sd[i] = Math.random() * 2 - 1;
    const sizSrc = this.ctx.createBufferSource();
    sizSrc.buffer = sizBuf;
    const sizBp = this.ctx.createBiquadFilter();
    sizBp.type = 'bandpass';
    sizBp.frequency.setValueAtTime(4200, sizzleT);
    sizBp.frequency.exponentialRampToValueAtTime(1400, sizzleT + sizDur);
    sizBp.Q.value = 3;
    const sizG = this.ctx.createGain();
    sizG.gain.setValueAtTime(0.0001, sizzleT);
    sizG.gain.exponentialRampToValueAtTime(0.28, sizzleT + 0.01);
    sizG.gain.exponentialRampToValueAtTime(0.001, sizzleT + sizDur);
    sizSrc.connect(sizBp).connect(sizG).connect(this.master);
    sizSrc.start(sizzleT);
    sizSrc.stop(sizzleT + sizDur);

    // (5) サブベース（地響き）
    const subT = strikeT;
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(60, subT);
    subOsc.frequency.exponentialRampToValueAtTime(28, subT + 0.6);
    const subG2 = this.ctx.createGain();
    subG2.gain.setValueAtTime(0.0001, subT);
    subG2.gain.exponentialRampToValueAtTime(0.5, subT + 0.02);
    subG2.gain.exponentialRampToValueAtTime(0.001, subT + 0.7);
    subOsc.connect(subG2).connect(this.master);
    subOsc.start(subT);
    subOsc.stop(subT + 0.75);
  }

  // --- 乗り物に乗り込む時のエンジン/起動音 ---
  vehicleMount(vehicleId) {
    if (!this._ready || this.muted) return;
    const id = vehicleId || '';
    if (id === 'veh_ufo') {
      // ヒューンと上昇する電子音
      this._tonePing('sine', 200, 1200, 0.5, 0.3);
      this._tonePing('triangle', 400, 1800, 0.4, 0.2);
    } else if (id === 'veh_dragon') {
      // ガオォ系の低音ロード
      this._tonePing('sawtooth', 100, 220, 0.4, 0.35);
      this._noiseBurst(0.35, 1200, 300, 0.8, 0.3, 'lowpass');
    } else if (id === 'veh_hoverBike') {
      // ホバーバイク: エンジン点火 + 上昇する浮遊音
      this._tonePing('sawtooth', 80, 220, 0.3, 0.32);
      this._tonePing('square', 320, 600, 0.25, 0.18);
    } else if (id === 'veh_skyBoard') {
      // スカイボード: ふわっと浮く電子音
      this._tonePing('sine', 600, 900, 0.4, 0.22);
      this._tonePing('triangle', 1100, 1500, 0.3, 0.15);
    } else if (id === 'veh_jetSkate') {
      // ジェットスケート: 短いジェット噴射
      this._noiseBurst(0.25, 1800, 500, 1.0, 0.32, 'bandpass');
      this._tonePing('sawtooth', 280, 480, 0.2, 0.2);
    } else {
      // 汎用
      this._tonePing('triangle', 400, 700, 0.25, 0.25);
    }
  }

  // FPS用: 命中インパクト（打撃感の強いボディ着弾音）
  //   構成: 鋭いクリック + 低音ドスン + 高域ノイズシズル
  impactHit() {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    // (1) 短いクリック（先端の"バン"）
    const click = this.ctx.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(1800, t);
    click.frequency.exponentialRampToValueAtTime(300, t + 0.04);
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.0001, t);
    cg.gain.exponentialRampToValueAtTime(0.38, t + 0.003);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    click.connect(cg).connect(this.master);
    click.start(t); click.stop(t + 0.07);
    // (2) 低音のドスン（ボディインパクト）
    const boom = this.ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(220, t);
    boom.frequency.exponentialRampToValueAtTime(70, t + 0.15);
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.exponentialRampToValueAtTime(0.42, t + 0.008);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    boom.connect(bg).connect(this.master);
    boom.start(t); boom.stop(t + 0.22);
    // (3) 高域ノイズ（血飛沫的シズル）
    this._noiseBurst(0.12, 5200, 1200, 1.4, 0.22, 'highpass');
  }

  // FPS用: ヘッドショットの光る"チーン"音
  //   構成: 高音の鋭いピン + 二段のベル倍音 + 短い金属残響
  headshotPing() {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    // (1) 主音: 高音の一撃
    const bell = this.ctx.createOscillator();
    bell.type = 'triangle';
    bell.frequency.setValueAtTime(2400, t);
    bell.frequency.exponentialRampToValueAtTime(3200, t + 0.05);
    bell.frequency.exponentialRampToValueAtTime(2200, t + 0.3);
    const bellG = this.ctx.createGain();
    bellG.gain.setValueAtTime(0.0001, t);
    bellG.gain.exponentialRampToValueAtTime(0.45, t + 0.005);
    bellG.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    bell.connect(bellG).connect(this.master);
    bell.start(t); bell.stop(t + 0.36);
    // (2) 倍音（キラッ感）
    const harm = this.ctx.createOscillator();
    harm.type = 'sine';
    harm.frequency.setValueAtTime(4800, t);
    harm.frequency.exponentialRampToValueAtTime(3600, t + 0.25);
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0.0001, t);
    hg.gain.exponentialRampToValueAtTime(0.22, t + 0.005);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    harm.connect(hg).connect(this.master);
    harm.start(t); harm.stop(t + 0.3);
    // (3) 前振りのバン（インパクト分も混ぜる）
    this._noiseBurst(0.05, 4000, 1200, 1.2, 0.28, 'bandpass');
  }

  // スコープアイテム取得: 金属的な短いピキン + 高域チャイム
  scopePickup(zoom = 1) {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    // ベース: 金属クリック（BPノイズ）
    this._noiseBurst(0.06, 4200, 1600, 2.0, 0.28, 'bandpass');
    // 高域チャイム: ズーム倍率が高いほど高く長く鳴る
    const base = 1600 + Math.min(2400, zoom * 220);
    const dur = 0.22 + Math.min(0.25, zoom * 0.03);
    this._tonePing('sine', base, base * 2.0, dur, 0.18);
    this._tonePing('triangle', base * 0.75, base * 1.5, dur * 0.8, 0.10);
  }

  // FPS用: スコープのズームイン/アウト（ソフトなカチッ + サブ低音）
  scopeZoom(zoom = 1, on = true) {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    // メカニカルクリック
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    const f0 = on ? 900 : 700;
    const f1 = on ? 320 : 220;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + 0.05);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
    // サブ: 倍率に応じた低音のブーン
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    const sf = on ? Math.max(80, 220 - zoom * 12) : 60;
    sub.frequency.setValueAtTime(sf * 1.4, t);
    sub.frequency.exponentialRampToValueAtTime(sf, t + 0.18);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    sub.connect(sg).connect(this.master);
    sub.start(t);
    sub.stop(t + 0.24);
  }

  // FPS用: 足音（軽い低域ノイズ）
  footstep() {
    if (!this._ready || this.muted) return;
    const t = this.ctx.currentTime;
    const dur = 0.09;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const e = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * e * e;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    lp.Q.value = 0.9;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(lp).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.01);
  }
}
