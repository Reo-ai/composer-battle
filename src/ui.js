// シンプルなHUD（HPバー）
// プレイヤーは画面左下に固定表示、敵は頭上にワールド座標から投影して表示。

import * as THREE from 'three';
import { SWORDS, GUNS, WANDS } from './weapons.js';
import { VEHICLES } from './vehicles.js';
import { SHIELD_CATALOG, HEAL_CATALOG } from './items.js';
import { STAGE_BOUNDS, getTerrainHeightAt } from './stage.js';
import { CHARACTERS } from './characters.js';

// キャラごとの必殺技名
const ULTIMATE_NAMES = {
  cat_neko: '音符の嵐',
  sensei:   '蒼天和音柱',
  owl_oto:  '夜想曲ヴォルテックス',
};

// 各カテゴリの絵文字
const CATEGORY_EMOJI = {
  character: '🎭',
  sword: '⚔', gun: '🔫', wand: '✨',
  shield: '🛡', heal: '💖', vehicle: '🛞',
};

export class HUD {
  constructor() {
    this.root = document.createElement('div');
    this.root.style.position = 'fixed';
    this.root.style.left = '0';
    this.root.style.top = '0';
    this.root.style.width = '100%';
    this.root.style.height = '100%';
    this.root.style.pointerEvents = 'none';
    this.root.style.zIndex = '20';
    document.body.appendChild(this.root);

    // プレイヤーHPバー（画面下中央）
    this.playerBar = makeBar({ width: 320, height: 18, color: '#3ad13a', segments: 4 });
    this._playerBarSegments = 4;
    this.playerBar.wrapper.style.left = '50%';
    this.playerBar.wrapper.style.bottom = '30px';
    this.playerBar.wrapper.style.transform = 'translateX(-50%)';
    this.playerLabel = document.createElement('div');
    this.playerLabel.style.color = 'white';
    this.playerLabel.style.fontFamily = 'sans-serif';
    this.playerLabel.style.fontSize = '12px';
    this.playerLabel.style.textShadow = '0 1px 2px rgba(0,0,0,0.6)';
    this.playerLabel.style.textAlign = 'center';
    this.playerLabel.style.marginBottom = '4px';
    this.playerLabel.textContent = 'YOU';
    this.playerBar.wrapper.insertBefore(this.playerLabel, this.playerBar.wrapper.firstChild);
    this.root.appendChild(this.playerBar.wrapper);

    // 敵HPバー群
    this.enemyBars = new Map(); // enemy -> {wrapper, fill}

    // ピックアップトースト（画面上中央：回復/武器/乗り物の取得通知）
    this.pickup = document.createElement('div');
    this.pickup.style.position = 'fixed';
    this.pickup.style.left = '50%';
    this.pickup.style.top = '14%';
    this.pickup.style.transform = 'translateX(-50%) translateY(-8px)';
    this.pickup.style.padding = '8px 16px';
    this.pickup.style.background = 'rgba(0,0,0,0.55)';
    this.pickup.style.border = '1px solid rgba(255,255,255,0.25)';
    this.pickup.style.borderRadius = '999px';
    this.pickup.style.color = 'white';
    this.pickup.style.fontFamily = 'sans-serif';
    this.pickup.style.fontSize = '18px';
    this.pickup.style.fontWeight = 'bold';
    this.pickup.style.textShadow = '0 2px 6px rgba(0,0,0,0.6)';
    this.pickup.style.opacity = '0';
    this.pickup.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    this.pickup.style.pointerEvents = 'none';
    this.root.appendChild(this.pickup);
    this._pickupHideTimer = null;

    // 中央メッセージ（勝敗など）
    this.msg = document.createElement('div');
    this.msg.style.position = 'fixed';
    this.msg.style.left = '50%';
    this.msg.style.top = '40%';
    this.msg.style.transform = 'translate(-50%, -50%)';
    this.msg.style.color = 'white';
    this.msg.style.fontFamily = 'sans-serif';
    this.msg.style.fontSize = '48px';
    this.msg.style.fontWeight = 'bold';
    this.msg.style.textShadow = '0 2px 8px rgba(0,0,0,0.7)';
    this.msg.style.display = 'none';
    this.msg.style.pointerEvents = 'none';
    this.root.appendChild(this.msg);

    // カウントダウン用大型テキスト
    this.count = document.createElement('div');
    this.count.style.position = 'fixed';
    this.count.style.left = '50%';
    this.count.style.top = '45%';
    this.count.style.transform = 'translate(-50%, -50%)';
    this.count.style.color = 'white';
    this.count.style.fontFamily = 'sans-serif';
    this.count.style.fontSize = '160px';
    this.count.style.fontWeight = '900';
    this.count.style.textShadow = '0 4px 24px rgba(0,0,0,0.8), 0 0 40px rgba(255,255,255,0.4)';
    this.count.style.display = 'none';
    this.count.style.pointerEvents = 'none';
    this.count.style.transition = 'transform 0.15s ease-out, opacity 0.15s ease-out';
    this.root.appendChild(this.count);

    // ポーズ用オーバーレイ
    this.pause = document.createElement('div');
    this.pause.style.position = 'fixed';
    this.pause.style.inset = '0';
    this.pause.style.background = 'rgba(0,0,0,0.55)';
    this.pause.style.color = 'white';
    this.pause.style.fontFamily = 'sans-serif';
    this.pause.style.display = 'none';
    this.pause.style.alignItems = 'center';
    this.pause.style.justifyContent = 'center';
    this.pause.style.flexDirection = 'column';
    this.pause.style.pointerEvents = 'none';
    this.pause.style.zIndex = '25';
    const pTitle = document.createElement('div');
    pTitle.textContent = 'PAUSED';
    pTitle.style.fontSize = '72px';
    pTitle.style.fontWeight = '900';
    pTitle.style.letterSpacing = '6px';
    pTitle.style.textShadow = '0 4px 18px rgba(0,0,0,0.8)';
    const pHint = document.createElement('div');
    pHint.textContent = 'P または Esc で再開';
    pHint.style.marginTop = '18px';
    pHint.style.fontSize = '18px';
    pHint.style.opacity = '0.85';
    this.pause.appendChild(pTitle);
    this.pause.appendChild(pHint);
    this.root.appendChild(this.pause);

    // 左上：操作・コンボ説明パネル
    this.helpPanel = document.createElement('div');
    this.helpPanel.style.position = 'fixed';
    this.helpPanel.style.left = '12px';
    this.helpPanel.style.top = '48px'; // トグルボタン分の余白
    this.helpPanel.style.padding = '10px 12px';
    this.helpPanel.style.background = 'rgba(0,0,0,0.45)';
    this.helpPanel.style.border = '1px solid rgba(255,255,255,0.25)';
    this.helpPanel.style.borderRadius = '6px';
    this.helpPanel.style.color = 'white';
    this.helpPanel.style.fontFamily = 'sans-serif';
    this.helpPanel.style.fontSize = '11px';
    this.helpPanel.style.lineHeight = '1.55';
    // スクロール可能にするため、パネル本体は pointer-events を有効化する
    // (canvas 側の Pointer Lock が発火しないよう、内部でイベントを止める)
    this.helpPanel.style.pointerEvents = 'auto';
    this.helpPanel.style.touchAction = 'pan-y';
    this.helpPanel.style.webkitOverflowScrolling = 'touch';
    this.helpPanel.style.textShadow = '0 1px 2px rgba(0,0,0,0.7)';
    this.helpPanel.style.maxWidth = '280px';
    // STATUSパネル(左下)との重なりを防ぐ
    this.helpPanel.style.maxHeight = 'calc(100vh - 260px)';
    this.helpPanel.style.overflowY = 'auto';
    this.helpPanel.style.zIndex = '20';
    // パネル内でのタッチ/クリックが canvas へ伝播して Pointer Lock を要求しないようにする
    ['mousedown', 'click', 'touchstart', 'touchmove', 'touchend'].forEach((ev) => {
      this.helpPanel.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    });
    this.root.appendChild(this.helpPanel);

    // 操作パネル用トグルボタン(左上)
    this.helpToggle = document.createElement('button');
    this.helpToggle.type = 'button';
    this.helpToggle.setAttribute('aria-label', '操作パネル切替');
    this.helpToggle.textContent = '❓';
    Object.assign(this.helpToggle.style, {
      position: 'fixed', left: '12px', top: '12px',
      width: '32px', height: '32px', borderRadius: '8px',
      background: 'rgba(0,0,0,0.55)', color: '#fff',
      border: '1px solid rgba(255,255,255,0.35)',
      fontSize: '16px', lineHeight: '1', padding: '0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', pointerEvents: 'auto',
      touchAction: 'manipulation', userSelect: 'none',
      zIndex: '20',
    });
    const toggleHelp = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const hidden = this.helpPanel.style.display === 'none';
      this.helpPanel.style.display = hidden ? '' : 'none';
      this.helpToggle.style.background = hidden
        ? 'rgba(80,180,255,0.6)' : 'rgba(0,0,0,0.55)';
    };
    this.helpToggle.addEventListener('click', toggleHelp);
    this.helpToggle.addEventListener('touchend', toggleHelp, { passive: false });
    this.root.appendChild(this.helpToggle);
    // 現在のキャラ情報を保持(再描画用)
    this._currentCharName = null;
    this._currentLabels = null;
    this.renderHelp(null, null);

    // 被弾時の赤フラッシュ（画面全体）
    this.hurtFlash = document.createElement('div');
    this.hurtFlash.style.position = 'fixed';
    this.hurtFlash.style.inset = '0';
    this.hurtFlash.style.background =
      'radial-gradient(circle at center, rgba(255,0,0,0) 30%, rgba(255,0,0,0.55) 100%)';
    this.hurtFlash.style.opacity = '0';
    this.hurtFlash.style.transition = 'opacity 0.25s ease-out';
    this.hurtFlash.style.pointerEvents = 'none';
    this.hurtFlash.style.zIndex = '22';
    this.root.appendChild(this.hurtFlash);

    // ステータスパネル（画面左下：装備武器/盾/乗り物/必殺技ゲージ）
    this.statusPanel = document.createElement('div');
    this.statusPanel.style.position = 'fixed';
    this.statusPanel.style.left = '20px';
    this.statusPanel.style.bottom = '20px';
    this.statusPanel.style.minWidth = '460px';
    this.statusPanel.style.maxWidth = '520px';
    this.statusPanel.style.padding = '10px 16px';
    this.statusPanel.style.background = 'rgba(0,0,0,0.55)';
    this.statusPanel.style.border = '1px solid rgba(255,255,255,0.25)';
    this.statusPanel.style.borderRadius = '12px';
    this.statusPanel.style.color = 'white';
    this.statusPanel.style.fontFamily = 'sans-serif';
    this.statusPanel.style.fontSize = '13px';
    this.statusPanel.style.lineHeight = '1.6';
    this.statusPanel.style.textShadow = '0 1px 2px rgba(0,0,0,0.7)';
    this.statusPanel.style.pointerEvents = 'auto';
    this.statusPanel.style.zIndex = '21';
    // canvas への伝播を止めて Pointer Lock 誤発火を防ぐ
    ['mousedown', 'click', 'touchstart', 'touchmove', 'touchend'].forEach((ev) => {
      this.statusPanel.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    });
    this.statusPanel.innerHTML = `
      <div style="font-weight:bold;font-size:11px;letter-spacing:1px;opacity:0.75;margin-bottom:6px;">STATUS</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;column-gap:14px;row-gap:2px;">
        <!-- 左列: ステータス数値 -->
        <div>
          <div style="font-size:11px;opacity:0.7;letter-spacing:1px;margin-bottom:2px;">PARAMS</div>
          <div>❤ 最大HP: <span data-val="paramHp">-</span></div>
          <div>🏃 移動: <span data-val="paramSpd">-</span></div>
          <div>⚔ 攻撃: <span data-val="paramAtk">-</span></div>
          <div>🛡 防御: <span data-val="paramDef">-</span></div>
          <div>💨 連射: <span data-val="paramRate">-</span></div>
        </div>
        <!-- 右列: 装備・効果 -->
        <div>
          <div style="font-size:11px;opacity:0.7;letter-spacing:1px;margin-bottom:2px;">EQUIP / EFFECTS</div>
          <div data-row="weapon">🗡 武器: <span data-val="weapon">なし</span></div>
          <div data-row="shield">🛡 盾: <span data-val="shield">なし</span></div>
          <div data-row="vehicle">🛞 乗り物: <span data-val="vehicle">なし</span></div>
          <div data-row="boost" style="display:none;">⚡ 連射: <span data-val="boost"></span></div>
          <div data-row="atkBoost" style="display:none;">💥 攻撃UP: <span data-val="atkBoost"></span></div>
        </div>
      </div>
      <div style="margin-top:8px;">
        <div style="font-size:11px;opacity:0.75;">🔥 必殺技 (V)</div>
        <div data-val="ultName" style="font-weight:bold;color:#ffd070;font-size:13px;margin-top:1px;">-</div>
        <div data-bar="ult" style="position:relative;height:10px;background:rgba(255,255,255,0.12);border-radius:6px;overflow:hidden;margin-top:3px;">
          <div data-fill="ult" style="position:absolute;left:0;top:0;height:100%;width:0%;background:linear-gradient(90deg,#ff7a3c,#ffcf3c);transition:width 0.15s;"></div>
        </div>
      </div>
    `;
    this.root.appendChild(this.statusPanel);

    // ステータスパネル用トグルボタン(左下・パネル上部)
    this.statusToggle = document.createElement('button');
    this.statusToggle.type = 'button';
    this.statusToggle.setAttribute('aria-label', 'ステータスパネル切替');
    this.statusToggle.textContent = '📊';
    Object.assign(this.statusToggle.style, {
      position: 'fixed', left: '20px', bottom: '20px',
      width: '36px', height: '36px', borderRadius: '8px',
      background: 'rgba(80,180,255,0.6)', color: '#fff',
      border: '1px solid rgba(255,255,255,0.5)',
      fontSize: '18px', lineHeight: '1', padding: '0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', pointerEvents: 'auto',
      touchAction: 'manipulation', userSelect: 'none',
      zIndex: '22',
    });
    const toggleStatus = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const hidden = this.statusPanel.style.display === 'none';
      this.statusPanel.style.display = hidden ? '' : 'none';
      this.statusToggle.style.background = hidden
        ? 'rgba(80,180,255,0.6)' : 'rgba(0,0,0,0.55)';
      // 開いているときはボタンを重ねずパネルの直上へ、閉じているときは左下の定位置へ
      if (hidden) {
        this.statusToggle.style.bottom =
          (this.statusPanel.offsetHeight + 28) + 'px';
      } else {
        this.statusToggle.style.bottom = '20px';
      }
    };
    this.statusToggle.addEventListener('click', toggleStatus);
    this.statusToggle.addEventListener('touchend', toggleStatus, { passive: false });
    this.root.appendChild(this.statusToggle);
    // 初期状態(パネル表示)ではボタンをパネル上部に置く
    // レイアウト確定後に位置を再計算
    requestAnimationFrame(() => {
      if (this.statusPanel.style.display !== 'none') {
        this.statusToggle.style.bottom =
          (this.statusPanel.offsetHeight + 28) + 'px';
      }
    });

    this._statusWeapon = this.statusPanel.querySelector('[data-val="weapon"]');
    this._statusShield = this.statusPanel.querySelector('[data-val="shield"]');
    this._statusVehicle = this.statusPanel.querySelector('[data-val="vehicle"]');
    this._statusBoost = this.statusPanel.querySelector('[data-val="boost"]');
    this._statusBoostRow = this.statusPanel.querySelector('[data-row="boost"]');
    this._statusUltFill = this.statusPanel.querySelector('[data-fill="ult"]');
    this._statusUltBar = this.statusPanel.querySelector('[data-bar="ult"]');
    this._statusUltName = this.statusPanel.querySelector('[data-val="ultName"]');
    this._statusAtkBoost = this.statusPanel.querySelector('[data-val="atkBoost"]');
    this._statusAtkBoostRow = this.statusPanel.querySelector('[data-row="atkBoost"]');
    this._statusParamHp = this.statusPanel.querySelector('[data-val="paramHp"]');
    this._statusParamSpd = this.statusPanel.querySelector('[data-val="paramSpd"]');
    this._statusParamAtk = this.statusPanel.querySelector('[data-val="paramAtk"]');
    this._statusParamDef = this.statusPanel.querySelector('[data-val="paramDef"]');
    this._statusParamRate = this.statusPanel.querySelector('[data-val="paramRate"]');

    // ===== インフォアイコン + アイテム図鑑モーダル =====
    this._buildInfoPanel();
    // ===== ミニマップ（右上） =====
    this._buildMinimap();
  }

  // 右上のミニマップ（ステージ全体の俯瞰 + プレイヤー/敵/アイテム位置）
  _buildMinimap() {
    const size = 200;
    this.minimapSize = size;
    // 外枠
    this.minimapWrapper = document.createElement('div');
    Object.assign(this.minimapWrapper.style, {
      position: 'fixed', right: '16px', top: '60px',
      width: size + 'px', height: size + 'px',
      background: 'rgba(0,0,0,0.55)',
      border: '2px solid rgba(255,255,255,0.55)',
      borderRadius: '12px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '21',
    });
    // 地形プレビュー用キャンバス（事前生成・固定）
    this.minimapTerrainCanvas = document.createElement('canvas');
    this.minimapTerrainCanvas.width = size;
    this.minimapTerrainCanvas.height = size;
    Object.assign(this.minimapTerrainCanvas.style, {
      position: 'absolute', left: '0', top: '0',
      width: '100%', height: '100%', opacity: '0.92',
    });
    // 動的レイヤー：プレイヤー/敵/アイテム/必殺技用
    this.minimapDynCanvas = document.createElement('canvas');
    this.minimapDynCanvas.width = size;
    this.minimapDynCanvas.height = size;
    Object.assign(this.minimapDynCanvas.style, {
      position: 'absolute', left: '0', top: '0',
      width: '100%', height: '100%',
    });
    // ラベル
    const label = document.createElement('div');
    label.textContent = 'MAP';
    Object.assign(label.style, {
      position: 'absolute', left: '8px', top: '6px',
      color: '#ffd27a', fontFamily: 'sans-serif',
      fontSize: '10px', fontWeight: 'bold', letterSpacing: '2px',
      textShadow: '0 1px 2px rgba(0,0,0,0.9)',
    });

    this.minimapWrapper.appendChild(this.minimapTerrainCanvas);
    this.minimapWrapper.appendChild(this.minimapDynCanvas);
    this.minimapWrapper.appendChild(label);
    this.root.appendChild(this.minimapWrapper);

    // インフォアイコンをミニマップの下に移動して衝突を避ける
    if (this.infoIcon) {
      this.infoIcon.style.top = (60 + size + 10) + 'px';
    }

    // 地形プレビューを描画（高さに応じた疑似カラーマップ）
    this._renderMinimapTerrain();
  }

  _renderMinimapTerrain() {
    const size = this.minimapSize;
    const ctx = this.minimapTerrainCanvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    const half = STAGE_BOUNDS.half;
    // 高さの範囲を概算（サンプリング）
    let hMin = Infinity, hMax = -Infinity;
    for (let py = 0; py < size; py += 4) {
      for (let px = 0; px < size; px += 4) {
        const wx = ((px / size) - 0.5) * 2 * half;
        const wz = ((py / size) - 0.5) * 2 * half;
        const h = getTerrainHeightAt(wx, wz);
        if (h < hMin) hMin = h;
        if (h > hMax) hMax = h;
      }
    }
    const hRange = Math.max(1, hMax - hMin);
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const wx = ((px / size) - 0.5) * 2 * half;
        const wz = ((py / size) - 0.5) * 2 * half;
        const h = getTerrainHeightAt(wx, wz);
        const t = Math.max(0, Math.min(1, (h - hMin) / hRange));
        // 暗い谷→温かい高地のグラデ
        let r, g, b;
        if (t < 0.4) {
          // 谷～平地：紫～ダークオレンジ
          const k = t / 0.4;
          r = Math.floor(36 + k * 80);
          g = Math.floor(20 + k * 30);
          b = Math.floor(46 + k * 10);
        } else if (t < 0.75) {
          // 中域：オレンジ～朱
          const k = (t - 0.4) / 0.35;
          r = Math.floor(116 + k * 100);
          g = Math.floor(50 + k * 40);
          b = Math.floor(56 - k * 30);
        } else {
          // 高地：黄白
          const k = (t - 0.75) / 0.25;
          r = Math.floor(216 + k * 30);
          g = Math.floor(90 + k * 100);
          b = Math.floor(26 + k * 60);
        }
        const i = (py * size + px) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // 中央アリーナの円を強調
    ctx.strokeStyle = 'rgba(255,220,120,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const cr = (STAGE_BOUNDS.arenaRadius / half) * (size / 2);
    ctx.arc(size / 2, size / 2, cr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 動的レイヤーを毎フレーム更新
  updateMinimap(player, enemies, items) {
    if (!this.minimapDynCanvas) return;
    const size = this.minimapSize;
    const ctx = this.minimapDynCanvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const half = STAGE_BOUNDS.half;
    const worldToMap = (wx, wz) => ({
      x: (wx / (2 * half) + 0.5) * size,
      y: (wz / (2 * half) + 0.5) * size,
    });

    // アイテム/乗り物スポーン共通の描画関数（通常: 黄緑 / 伝説: 赤紫で大きめ + 発光リング）
    const drawPickup = (obj) => {
      if (!obj || !obj.object) return;
      if (obj.consumed) return;
      // 乗り物スポーンは alive フラグで判定
      if (obj.alive === false) return;
      const p = obj.object.position;
      const m = worldToMap(p.x, p.z);
      if (m.x < 0 || m.x > size || m.y < 0 || m.y > size) return;
      // it.cfg.legendary（アイテム）または vehicleCfg.legendary（乗り物スポーン）を判定
      const isLegendary = !!(
        (obj.cfg && obj.cfg.legendary) ||
        (obj.vehicleCfg && obj.vehicleCfg.legendary) ||
        obj._legendary
      );
      if (isLegendary) {
        // 外周の赤紫グロー
        const grd = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 7);
        grd.addColorStop(0, 'rgba(255,90,220,0.95)');
        grd.addColorStop(0.5, 'rgba(220,80,255,0.55)');
        grd.addColorStop(1, 'rgba(180,60,255,0.0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 7, 0, Math.PI * 2);
        ctx.fill();
        // 中心の濃い赤紫ドット
        ctx.fillStyle = 'rgba(255,120,240,1.0)';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (obj.kind === 'vehicle_ground') {
        // 伝説以外の乗り物スポーンは「めちゃ濃い青」で表示（大きめグロー＋濃い中心ドット）
        const grd = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 8);
        grd.addColorStop(0, 'rgba(0,30,255,1.0)');
        grd.addColorStop(0.5, 'rgba(0,20,200,0.85)');
        grd.addColorStop(1, 'rgba(0,10,120,0.0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 8, 0, Math.PI * 2);
        ctx.fill();
        // 中心の極めて濃い青ドット
        ctx.fillStyle = 'rgba(0,20,200,1.0)';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 3.0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(120,255,180,0.95)';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    if (items && items.items) {
      for (const it of items.items) drawPickup(it);
    }
    if (items && items.spawns) {
      for (const sp of items.spawns) drawPickup(sp);
    }

    // 敵（赤の三角形・向き付き）
    if (enemies) {
      for (const e of enemies) {
        if (!e || !e.alive || !e.object) continue;
        const p = e.object.position;
        const m = worldToMap(p.x, p.z);
        if (m.x < -8 || m.x > size + 8 || m.y < -8 || m.y > size + 8) continue;
        const yaw = e.object.rotation ? e.object.rotation.y : 0;
        drawTriangle(ctx, m.x, m.y, yaw, 5.5, '#ff5050', '#ffffff');
      }
    }

    // プレイヤー（黄の三角形・向き付き）
    if (player && player.object) {
      const p = player.object.position;
      const m = worldToMap(p.x, p.z);
      // 視野方向（カメラのyaw想定）
      const yaw = player.object.rotation ? player.object.rotation.y : 0;
      // 視野扇形
      ctx.fillStyle = 'rgba(255,224,102,0.18)';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      const fov = Math.PI / 3;
      const r = 22;
      ctx.arc(m.x, m.y, r, -Math.PI / 2 - yaw - fov / 2, -Math.PI / 2 - yaw + fov / 2);
      ctx.closePath();
      ctx.fill();
      drawTriangle(ctx, m.x, m.y, yaw, 7, '#ffe066', '#222');
    }
  }

  // インフォ(i)アイコンと、武器/盾/回復/乗り物の図鑑モーダルを構築
  _buildInfoPanel() {
    // 右上の (i) アイコン (タップ可能なのでこれだけは pointerEvents:auto)
    this.infoIcon = document.createElement('div');
    this.infoIcon.textContent = 'i';
    this.infoIcon.title = 'アイテム図鑑';
    Object.assign(this.infoIcon.style, {
      position: 'fixed', right: '16px', top: '16px',
      width: '36px', height: '36px',
      borderRadius: '50%',
      background: 'rgba(0,0,0,0.55)',
      border: '2px solid rgba(255,255,255,0.7)',
      color: 'white', fontFamily: 'serif', fontWeight: 'bold',
      fontSize: '22px', lineHeight: '32px', textAlign: 'center',
      cursor: 'pointer', pointerEvents: 'auto', zIndex: '30',
      textShadow: '0 1px 2px rgba(0,0,0,0.7)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
      userSelect: 'none',
    });
    this.infoIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleInfoPanel();
    });
    this.root.appendChild(this.infoIcon);

    // 図鑑モーダル本体
    this.infoModal = document.createElement('div');
    Object.assign(this.infoModal.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,0.75)',
      display: 'none', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'auto', zIndex: '40',
    });
    this.infoModal.addEventListener('click', (e) => {
      // 背景クリックで閉じる
      if (e.target === this.infoModal) this.hideInfoPanel();
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      width: 'min(92vw, 820px)', maxHeight: '88vh',
      background: 'linear-gradient(180deg, rgba(30,30,40,0.96), rgba(20,20,30,0.96))',
      border: '1px solid rgba(255,255,255,0.25)',
      borderRadius: '14px',
      color: 'white', fontFamily: 'sans-serif',
      boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column',
    });
    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.15);">
        <div style="font-size:18px;font-weight:bold;letter-spacing:2px;">📖 アイテム図鑑</div>
        <div data-act="close" style="cursor:pointer;font-size:22px;line-height:1;opacity:0.85;padding:4px 10px;">✕</div>
      </div>
      <div data-tabs style="display:flex;gap:6px;padding:10px 14px 0;flex-wrap:wrap;"></div>
      <div data-body style="overflow-y:auto;padding:12px 18px 18px;font-size:13px;line-height:1.55;"></div>
    `;
    this.infoModal.appendChild(box);
    this.root.appendChild(this.infoModal);

    box.querySelector('[data-act="close"]').addEventListener('click', () => this.hideInfoPanel());

    this._infoTabsRoot = box.querySelector('[data-tabs]');
    this._infoBody = box.querySelector('[data-body]');
    // キャラ図鑑用にCHARACTERSをカード形式に正規化
    const characterEntries = Object.entries(CHARACTERS).map(([id, c]) => ({
      id,
      name: c.name,
      color: c.color,
      desc: c.desc,
      ultName: c.ultName,
      ultDesc: c.ultDesc,
      statsText: [
        `最大HP: ${c.maxHp}（${c.baseSegmentHp} × 4メモリ）`,
        `移動速度: ${c.moveSpeed}`,
        `基礎攻撃: ${c.attack}`,
      ],
    }));
    this._infoCategories = [
      { id: 'character', label: '🎭 キャラ', items: characterEntries },
      { id: 'sword',   label: '⚔ 剣',     items: SWORDS },
      { id: 'gun',     label: '🔫 銃',     items: GUNS },
      { id: 'wand',    label: '✨ 杖',     items: WANDS },
      { id: 'shield',  label: '🛡 盾',     items: SHIELD_CATALOG },
      { id: 'heal',    label: '💖 回復',   items: HEAL_CATALOG },
      { id: 'vehicle', label: '🛞 乗り物', items: VEHICLES },
    ];
    this._infoActiveTab = 'character';
    this._renderInfoTabs();
    this._renderInfoBody();
  }

  _renderInfoTabs() {
    this._infoTabsRoot.innerHTML = '';
    for (const c of this._infoCategories) {
      const btn = document.createElement('div');
      btn.textContent = c.label;
      const active = c.id === this._infoActiveTab;
      Object.assign(btn.style, {
        padding: '7px 12px',
        background: active ? 'rgba(255,210,120,0.22)' : 'rgba(255,255,255,0.07)',
        border: '1px solid ' + (active ? 'rgba(255,210,120,0.7)' : 'rgba(255,255,255,0.18)'),
        borderRadius: '999px', cursor: 'pointer', fontSize: '12px',
        color: active ? '#ffd27a' : 'white', userSelect: 'none',
      });
      btn.addEventListener('click', () => {
        this._infoActiveTab = c.id;
        this._renderInfoTabs();
        this._renderInfoBody();
      });
      this._infoTabsRoot.appendChild(btn);
    }
  }

  _renderInfoBody() {
    const cat = this._infoCategories.find(c => c.id === this._infoActiveTab);
    if (!cat) return;
    const emoji = CATEGORY_EMOJI[cat.id] || '•';

    // キャラタブ: desc / 必殺技 を含む詳細カード
    if (cat.id === 'character') {
      const rows = (cat.items || []).map((it) => {
        const stats = (it.statsText || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');
        const color = (it.color !== undefined)
          ? '#' + ('000000' + (it.color & 0xffffff).toString(16)).slice(-6)
          : '#888';
        return `
          <div style="padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:10px;">
            <div style="display:flex;gap:12px;align-items:center;">
              <div style="flex:0 0 52px;width:52px;height:52px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:28px;background:${color}33;border:1px solid ${color};box-shadow:0 0 10px ${color}66 inset;">${emoji}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:bold;color:${color};font-size:15px;">${escapeHtml(it.name)}</div>
                <div style="opacity:0.85;font-size:12px;line-height:1.5;margin-top:2px;">${escapeHtml(it.desc || '')}</div>
              </div>
            </div>
            <ul style="margin:8px 0 0;padding-left:18px;opacity:0.88;font-size:12px;line-height:1.5;">${stats}</ul>
            <div style="margin-top:10px;padding:8px 10px;background:rgba(255,210,120,0.10);border:1px solid rgba(255,210,120,0.35);border-radius:6px;">
              <div style="color:#ffd27a;font-weight:bold;font-size:12px;">💥 必殺技: ${escapeHtml(it.ultName || '-')}</div>
              <div style="opacity:0.9;font-size:12px;line-height:1.5;margin-top:3px;">${escapeHtml(it.ultDesc || '')}</div>
            </div>
          </div>`;
      }).join('');
      this._infoBody.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
          ${rows || '<div style="opacity:0.7;">キャラがいません</div>'}
        </div>`;
      return;
    }

    const rows = (cat.items || []).map((it) => {
      const stats = (it.statsText || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');
      const color = (it.color !== undefined)
        ? '#' + ('000000' + (it.color & 0xffffff).toString(16)).slice(-6)
        : '#888';
      const isLegendary = !!it.legendary;
      const cardStyle = isLegendary
        ? `display:flex;gap:12px;padding:10px;background:linear-gradient(135deg,rgba(255,180,80,0.18),rgba(255,80,200,0.18));border:1.5px solid #ffb84d;border-radius:8px;box-shadow:0 0 16px rgba(255,140,80,0.35),inset 0 0 12px rgba(255,200,120,0.18);`
        : `display:flex;gap:12px;padding:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;`;
      const badge = isLegendary
        ? `<span style="display:inline-block;margin-left:6px;padding:1px 7px;font-size:10px;font-weight:bold;color:#fff;background:linear-gradient(90deg,#ff5a5a,#ff66cc,#b84dff);border-radius:999px;box-shadow:0 0 6px rgba(255,120,180,0.7);vertical-align:middle;">★ 伝説</span>`
        : '';
      const descLine = it.desc
        ? `<div style="opacity:0.85;font-size:12px;line-height:1.5;margin-top:3px;">${escapeHtml(it.desc)}</div>`
        : '';
      return `
        <div style="${cardStyle}">
          <div style="flex:0 0 48px;width:48px;height:48px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:26px;background:${color}33;border:1px solid ${color};box-shadow:0 0 8px ${color}66 inset;">${emoji}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:bold;color:${color};font-size:14px;">${escapeHtml(it.name || it.id)}${badge}</div>
            ${descLine}
            <ul style="margin:4px 0 0;padding-left:18px;opacity:0.88;font-size:12px;line-height:1.4;">${stats || '<li style="opacity:0.6;">（効果情報なし）</li>'}</ul>
          </div>
        </div>`;
    }).join('');
    this._infoBody.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;">
        ${rows || '<div style="opacity:0.7;">アイテムがありません</div>'}
      </div>`;
  }

  showInfoPanel() { this.infoModal.style.display = 'flex'; }
  hideInfoPanel() { this.infoModal.style.display = 'none'; }
  toggleInfoPanel() {
    if (this.infoModal.style.display === 'none' || !this.infoModal.style.display) {
      this.showInfoPanel();
    } else {
      this.hideInfoPanel();
    }
  }

  // プレイヤー被弾時の画面赤フラッシュ
  flashHurt() {
    this.hurtFlash.style.transition = 'opacity 0.05s ease-out';
    this.hurtFlash.style.opacity = '1';
    setTimeout(() => {
      this.hurtFlash.style.transition = 'opacity 0.4s ease-out';
      this.hurtFlash.style.opacity = '0';
    }, 60);
  }

  showMessage(text) {
    this.msg.textContent = text;
    this.msg.style.display = 'block';
  }
  hideMessage() {
    this.msg.style.display = 'none';
  }

  // 短い取得通知トーストを表示（1.4 秒で自動フェードアウト）
  showPickupMessage(text) {
    this.pickup.textContent = text;
    this.pickup.style.opacity = '1';
    this.pickup.style.transform = 'translateX(-50%) translateY(0)';
    if (this._pickupHideTimer) clearTimeout(this._pickupHideTimer);
    this._pickupHideTimer = setTimeout(() => {
      this.pickup.style.opacity = '0';
      this.pickup.style.transform = 'translateX(-50%) translateY(-8px)';
    }, 1400);
  }

  showCountdown(text) {
    this.count.textContent = text;
    this.count.style.display = 'block';
    // 出現時に小さくスケール→拡大して目立たせる
    this.count.style.opacity = '0';
    this.count.style.transform = 'translate(-50%, -50%) scale(0.6)';
    // 次フレームでアニメ
    requestAnimationFrame(() => {
      this.count.style.opacity = '1';
      this.count.style.transform = 'translate(-50%, -50%) scale(1)';
    });
  }
  hideCountdown() {
    this.count.style.display = 'none';
  }

  showPause() {
    this.pause.style.display = 'flex';
  }
  hidePause() {
    this.pause.style.display = 'none';
  }

  showHelp() { this.helpPanel.style.display = 'block'; }
  hideHelp() { this.helpPanel.style.display = 'none'; }
  toggleHelp() {
    this.helpPanel.style.display =
      this.helpPanel.style.display === 'none' ? 'block' : 'none';
  }

  // キャラ切替時に呼ばれる。labels は player.getAttackLabels() の結果。
  // 例: { jab1:'爪', jab2:'逆爪', jab3:'音符斬り', side:'キャットスピン', up:'ジャンプ爪',
  //       down:'尻尾払い', air:'エアスクラッチ', smashSide:'音符バースト',
  //       smashUp:'ハイノート', smashDown:'ローグルーヴ' }
  updateCharacterHelp(labels, charName) {
    if (labels) this._currentLabels = labels;
    if (charName !== undefined) this._currentCharName = charName;
    this.renderHelp(this._currentLabels, this._currentCharName);
  }

  // ヘルプパネルの中身を組み立てる。labels が null なら汎用表示。
  renderHelp(labels, charName) {
    const L = labels || {};
    // 未定義のラベルは「-」表示(セットに存在しない技は出さない用)
    const lbl = (k, fallback = '-') => L[k] || fallback;
    const title = charName ? `操作・技 - ${escapeHtml(charName)}` : '操作・技';
    this.helpPanel.innerHTML = `
      <div style="font-weight:bold;font-size:13px;margin-bottom:6px;letter-spacing:1px;color:#ffd27a;">${title}</div>
      <div style="margin-bottom:4px;"><b style="color:#9ad7ff;">移動</b> WASD / ↑上昇 / ↓下降 / ←→ 左右</div>
      <div style="margin-bottom:4px;"><b style="color:#9ad7ff;">視点</b> マウス（画面クリックでロック / Escで解除）</div>
      <div style="margin-bottom:4px;"><b style="color:#9ad7ff;">ダッシュ</b> Shift（方向入力で突進）</div>
      <div style="margin-bottom:4px;"><b style="color:#9ad7ff;">射撃</b> Z（音符弾） / <b style="color:#c8a0ff;">特殊技</b> B（飛び道具）</div>
      <div style="margin-top:6px;margin-bottom:2px;"><b style="color:#ffb070;">弱攻撃</b> X</div>
      <div style="padding-left:10px;color:#ddd;">　X連打: ${escapeHtml(lbl('jab1','ジャブ1'))} → ${escapeHtml(lbl('jab2','ジャブ2'))} → ${escapeHtml(lbl('jab3','フィニッシュ'))}</div>
      <div style="padding-left:10px;color:#ddd;">　X+A/D: ${escapeHtml(lbl('side','横強'))}</div>
      <div style="padding-left:10px;color:#ddd;">　X+↑: ${escapeHtml(lbl('up','上強'))}</div>
      <div style="padding-left:10px;color:#ddd;">　X+↓: ${escapeHtml(lbl('down','下強'))}</div>
      <div style="padding-left:10px;color:#ddd;">　空中X+↑: ${escapeHtml(lbl('airUp','空上'))}</div>
      <div style="padding-left:10px;color:#ddd;">　空中X+↓: ${escapeHtml(lbl('airDown','空下'))}</div>
      <div style="padding-left:10px;color:#ddd;">　空中X+逆方向: ${escapeHtml(lbl('airBack','空後'))}</div>
      <div style="margin-top:4px;margin-bottom:2px;"><b style="color:#ff7050;">強攻撃</b> C（スマッシュ）</div>
      <div style="padding-left:10px;color:#ddd;">　C+A/D: ${escapeHtml(lbl('smashSide','横スマ'))}</div>
      <div style="padding-left:10px;color:#ddd;">　C+↑: ${escapeHtml(lbl('smashUp','上スマ'))}</div>
      <div style="padding-left:10px;color:#ddd;">　C+↓: ${escapeHtml(lbl('smashDown','下スマ'))}</div>
      <div style="padding-left:10px;color:#ddd;">　C単体: ${escapeHtml(lbl('air','空中攻撃'))}</div>
      <div style="margin-top:4px;margin-bottom:2px;"><b style="color:#c8a0ff;">特殊技</b> B</div>
      <div style="padding-left:10px;color:#ddd;">　${escapeHtml(lbl('special','飛び道具'))}</div>
      <div style="margin-top:6px;"><b style="color:#a0e0a0;">その他</b> 1/2/3 切替 / P or Esc ポーズ / R リスタート</div>
      <div style="margin-top:4px;opacity:0.7;font-size:11px;">※乗り物の詳細はミニマップ下の 🛈 で確認</div>
    `;
  }

  updatePlayer(player) {
    const rawRatio = player.hp / player.maxHp;
    const ratio = Math.max(0, Math.min(1, rawRatio));
    this.playerBar.fill.style.width = (ratio * 100) + '%';
    // メモリ数が変わった時だけティックを再生成
    const segs = Math.max(1, player.maxSegments || 4);
    if (segs !== this._playerBarSegments) {
      this.playerBar.setSegments(segs);
      this._playerBarSegments = segs;
      // 5メモリ時のみ右端 1/segs をピンクオーバーレイで表示
      if (this.playerBar.pinkOverlay) {
        if (segs >= 5) {
          this.playerBar.pinkOverlay.style.display = 'block';
          this.playerBar.pinkOverlay.style.width = (100 / segs) + '%';
        } else {
          this.playerBar.pinkOverlay.style.display = 'none';
        }
      }
    }
    this.playerBar.fill.style.background = colorForRatio(ratio);
    // 数値ラベルを HP / maxHP 表示に
    if (this.playerLabel) {
      const cur = Math.max(0, Math.round(player.hp));
      const mx = Math.max(1, Math.round(player.maxHp));
      this.playerLabel.textContent = `YOU  ${cur} / ${mx}`;
    }
    // ステータスパネル更新
    this._updateStatusPanel(player);
  }

  _updateStatusPanel(player) {
    if (!this._statusWeapon) return;
    // 装備武器
    const w = player.equippedWeapon;
    const wt = player.weaponTimer || 0;
    this._statusWeapon.textContent = w ? `${w.name || w.id}（${wt.toFixed(1)}s）` : 'なし';
    this._statusWeapon.style.color = w ? '#ffd070' : '#888';
    // 装備盾
    const s = player.equippedShield;
    const st = player.shieldTimer || 0;
    this._statusShield.textContent = s ? `${s.name || s.id}（${st.toFixed(1)}s）` : 'なし';
    this._statusShield.style.color = s ? '#8ad8ff' : '#888';
    // 乗り物
    const v = player.mountedVehicle;
    const mt = player.mountTimer || 0;
    this._statusVehicle.textContent = v ? `${v.name || v.id}（${mt.toFixed(1)}s）` : 'なし';
    this._statusVehicle.style.color = v ? '#4be0ff' : '#888';
    // ファイアブースト
    const fb = player.fireBoostTimer || 0;
    if (fb > 0) {
      this._statusBoostRow.style.display = 'block';
      this._statusBoost.textContent = `連射UP（${fb.toFixed(1)}s）`;
      this._statusBoost.style.color = '#ffe066';
    } else {
      this._statusBoostRow.style.display = 'none';
    }
    // 攻撃ブースト
    const ab = player.weaponBoostTimer || 0;
    if (this._statusAtkBoostRow) {
      if (ab > 0) {
        this._statusAtkBoostRow.style.display = 'block';
        const mul = player.bulletDmgMul || 1;
        this._statusAtkBoost.textContent = `x${mul.toFixed(1)}（${ab.toFixed(1)}s）`;
        this._statusAtkBoost.style.color = '#ff9a4d';
      } else {
        this._statusAtkBoostRow.style.display = 'none';
      }
    }
    // PARAMS (ベース白、+ボーナス黄色)
    const yellow = '#ffe066';
    const white = '#ffffff';
    // 最大HP: baseSegmentHp×4 をベースとし、現状の maxHp が超えていればオーバーヒール分を黄色で +N 表示
    if (this._statusParamHp) {
      const baseHp = Math.round((player.baseSegmentHp ?? 33) * 4);
      const curMax = Math.round(player.maxHp || baseHp);
      const diff = curMax - baseHp;
      this._statusParamHp.innerHTML = diff > 0
        ? `<span style="color:${white};">${baseHp}</span> <span style="color:${yellow};">(+${diff})</span>`
        : `<span style="color:${white};">${baseHp}</span>`;
    }
    // 移動速度
    if (this._statusParamSpd) {
      const baseSpd = (player.baseMoveSpeed ?? 6);
      const mul = player.moveSpeedMul || 1;
      const cur = baseSpd * mul;
      const diff = cur - baseSpd;
      this._statusParamSpd.innerHTML = diff > 0.001
        ? `<span style="color:${white};">${baseSpd.toFixed(1)}</span> <span style="color:${yellow};">(+${diff.toFixed(1)})</span>`
        : `<span style="color:${white};">${baseSpd.toFixed(1)}</span>`;
    }
    // 攻撃力
    if (this._statusParamAtk) {
      const baseAtk = (player.baseAttackMul ?? 1) * 10;
      const mul = player.bulletDmgMul || 1;
      const cur = baseAtk * mul;
      const diff = cur - baseAtk;
      this._statusParamAtk.innerHTML = diff > 0.001
        ? `<span style="color:${white};">${baseAtk.toFixed(1)}</span> <span style="color:${yellow};">(+${diff.toFixed(1)})</span>`
        : `<span style="color:${white};">${baseAtk.toFixed(1)}</span>`;
    }
    // 防御 (盾装備時はダメージ軽減%、なしは"-")
    if (this._statusParamDef) {
      const reduce = player.dmgReduce || 0;
      const shieldHp = player.shieldHp || 0;
      if (reduce > 0 || shieldHp > 0) {
        const pct = Math.round(reduce * 100);
        this._statusParamDef.innerHTML = `<span style="color:${white};">0%</span> <span style="color:${yellow};">(+${pct}%)</span>`;
      } else {
        this._statusParamDef.innerHTML = `<span style="color:${white};">0%</span>`;
      }
    }
    // 連射 (fireRateMul)
    if (this._statusParamRate) {
      const mul = player.fireRateMul || 1;
      const diff = mul - 1;
      this._statusParamRate.innerHTML = diff > 0.001
        ? `<span style="color:${white};">1.0x</span> <span style="color:${yellow};">(+${diff.toFixed(1)}x)</span>`
        : `<span style="color:${white};">1.0x</span>`;
    }
    // 必殺技名(キャラごと)
    if (this._statusUltName) {
      const id = player.attackSetId;
      const nm = ULTIMATE_NAMES[id] || '必殺技';
      this._statusUltName.textContent = nm;
      if (player.isUltimateReady && player.isUltimateReady()) {
        this._statusUltName.style.color = '#ffe066';
        this._statusUltName.style.textShadow = '0 0 8px rgba(255,224,102,0.7)';
      } else {
        this._statusUltName.style.color = '#ffd070';
        this._statusUltName.style.textShadow = '0 1px 2px rgba(0,0,0,0.7)';
      }
    }
    // 必殺技ゲージ
    const ult = player.ultimateCharge || 0;
    const ultMax = player.ultimateMax || 100;
    const pct = Math.max(0, Math.min(100, (ult / ultMax) * 100));
    this._statusUltFill.style.width = pct + '%';
    if (player.isUltimateReady && player.isUltimateReady()) {
      this._statusUltFill.style.background = 'linear-gradient(90deg,#ff3c3c,#ffd23c,#ff3cff)';
      this._statusUltBar.style.boxShadow = '0 0 12px rgba(255,200,80,0.8)';
    } else {
      this._statusUltFill.style.background = 'linear-gradient(90deg,#ff7a3c,#ffcf3c)';
      this._statusUltBar.style.boxShadow = 'none';
    }
  }

  // 敵HPバーをワールド座標から投影
  updateEnemies(enemies, camera) {
    // 不要になったバーを掃除
    for (const [e, ui] of this.enemyBars) {
      if (!enemies.includes(e) || !e.alive) {
        ui.wrapper.remove();
        this.enemyBars.delete(e);
      }
    }
    for (const e of enemies) {
      if (!e.alive) continue;
      let ui = this.enemyBars.get(e);
      if (!ui) {
        ui = makeBar({ width: 140, height: 10, color: '#ff6a4d' });
        ui.wrapper.style.transform = 'translate(-50%, -100%)';
        this.root.appendChild(ui.wrapper);
        this.enemyBars.set(e, ui);
      }
      // 敵の頭上の3D座標
      const worldPos = e.object.position.clone();
      worldPos.y += 2.5;
      const screen = worldPos.project(camera);
      // 画面外は隠す
      if (screen.z < -1 || screen.z > 1) {
        ui.wrapper.style.display = 'none';
        continue;
      }
      ui.wrapper.style.display = 'block';
      const sx = (screen.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-screen.y * 0.5 + 0.5) * window.innerHeight;
      ui.wrapper.style.left = sx + 'px';
      ui.wrapper.style.top = sy + 'px';
      const ratio = Math.max(0, e.hp / e.maxHp);
      ui.fill.style.width = (ratio * 100) + '%';
      ui.fill.style.background = colorForRatio(ratio);
    }
  }
}

function makeBar({ width, height, color, segments = 1 }) {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.width = width + 'px';
  const bg = document.createElement('div');
  bg.style.position = 'relative';
  bg.style.width = '100%';
  bg.style.height = height + 'px';
  bg.style.background = 'rgba(0,0,0,0.55)';
  bg.style.border = '1px solid rgba(255,255,255,0.55)';
  bg.style.borderRadius = '4px';
  bg.style.overflow = 'hidden';
  // 5メモリ時に右端 1/5 を覆うピンクオーバーレイ（fill より下に置いてティント表現）
  const pinkOverlay = document.createElement('div');
  pinkOverlay.style.position = 'absolute';
  pinkOverlay.style.top = '0';
  pinkOverlay.style.bottom = '0';
  pinkOverlay.style.right = '0';
  pinkOverlay.style.width = '20%';
  pinkOverlay.style.background = 'linear-gradient(90deg, rgba(255,120,200,0.0) 0%, rgba(255,120,200,0.55) 100%)';
  pinkOverlay.style.pointerEvents = 'none';
  pinkOverlay.style.display = 'none';
  bg.appendChild(pinkOverlay);
  const fill = document.createElement('div');
  fill.style.width = '100%';
  fill.style.height = '100%';
  fill.style.background = color;
  fill.style.transition = 'width 0.12s linear, background 0.18s linear';
  fill.style.boxShadow = 'inset 0 -3px 6px rgba(0,0,0,0.25)';
  fill.style.position = 'relative';
  bg.appendChild(fill);
  // 段階区切りの白いティック（segments 数に応じて動的生成）
  const ticksContainer = document.createElement('div');
  ticksContainer.style.position = 'absolute';
  ticksContainer.style.inset = '0';
  ticksContainer.style.pointerEvents = 'none';
  bg.appendChild(ticksContainer);
  function setSegments(n) {
    ticksContainer.innerHTML = '';
    if (n <= 1) return;
    for (let i = 1; i < n; i++) {
      const pct = (i / n) * 100;
      const tick = document.createElement('div');
      tick.style.position = 'absolute';
      tick.style.top = '0';
      tick.style.bottom = '0';
      tick.style.left = pct + '%';
      tick.style.width = '2px';
      tick.style.background = 'rgba(255,255,255,0.85)';
      tick.style.boxShadow = '0 0 2px rgba(0,0,0,0.6)';
      ticksContainer.appendChild(tick);
    }
  }
  setSegments(segments);
  wrapper.appendChild(bg);
  return { wrapper, fill, setSegments, pinkOverlay };
}

// 体力ゲージの段階カラー（要望：赤・黄・緑で明確に分ける）
//  - 66% 超: 緑（健康）
//  - 33% 超: 黄（警告）
//  - それ以下: 赤（危険）
function colorForRatio(r) {
  if (r > 0.6666) return 'linear-gradient(90deg, #2ee85a 0%, #62ff8e 100%)';
  if (r > 0.3333) return 'linear-gradient(90deg, #ffd83b 0%, #ffe87a 100%)';
  return 'linear-gradient(90deg, #ff3b3b 0%, #ff7a7a 100%)';
}

// ミニマップで使う向き付き三角形（yaw=0は奥向き=画面上）
function drawTriangle(ctx, cx, cy, yaw, size, fill, stroke) {
  // ワールド座標(z+が手前)→ミニマップ(y+が下)なので yaw 反転に注意
  const a = -yaw;
  const forward = { x: -Math.sin(a), y: -Math.cos(a) };
  const right = { x: Math.cos(a), y: -Math.sin(a) };
  const tip = { x: cx + forward.x * size, y: cy + forward.y * size };
  const left = { x: cx - forward.x * size * 0.6 + right.x * size * 0.55,
                 y: cy - forward.y * size * 0.6 + right.y * size * 0.55 };
  const rgt = { x: cx - forward.x * size * 0.6 - right.x * size * 0.55,
                y: cy - forward.y * size * 0.6 - right.y * size * 0.55 };
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(rgt.x, rgt.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

// ヘルプパネル用: ラベル文字列をHTMLエスケープ(XSS防止)
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
