// 作曲マスター3Dバトル - エントリポイント
// Phase 1: グレーボックス開発（仮キャラ + 空中移動 + 三人称カメラ + キャラ切替 + 攻撃 + HP）
// 操作はキーボードのみ。

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CHARACTERS } from './characters.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { ThirdPersonCamera, FirstPersonCamera } from './camera.js';
import { ProjectileManager } from './projectile.js';
import { Enemy } from './enemy.js';
import { HUD } from './ui.js';
import { buildStage, STAGE_BOUNDS, getTerrainHeightAt } from './stage.js';
import { buildCoverLayout } from './cover.js';
import { EffectManager } from './effects.js';
import { AudioBus } from './audio.js';
import { ItemManager, SHIELD_CATALOG, HEAL_CATALOG, SCOPE_CATALOG } from './items.js';
import { getAllWeapons } from './weapons.js';
import { VEHICLES } from './vehicles.js';
import { initMobileControls } from './mobile-controls.js';

// ---- レンダラー ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

// ---- FPS 用クロスヘア（デフォルト非表示、setGameMode('fps') で表示） ----
const fpsCrosshair = document.createElement('div');
fpsCrosshair.id = 'fps-crosshair';
fpsCrosshair.style.cssText = [
  'position:fixed', 'left:50%', 'top:50%', 'transform:translate(-50%,-50%)',
  'width:22px', 'height:22px', 'pointer-events:none', 'z-index:9998',
  'display:none',
].join(';');
// SVG で細めの十字＋中央ドット
fpsCrosshair.innerHTML = `
  <svg viewBox="0 0 22 22" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
    <line x1="11" y1="2" x2="11" y2="8" stroke="rgba(255,255,255,0.9)" stroke-width="1.6"/>
    <line x1="11" y1="14" x2="11" y2="20" stroke="rgba(255,255,255,0.9)" stroke-width="1.6"/>
    <line x1="2" y1="11" x2="8" y2="11" stroke="rgba(255,255,255,0.9)" stroke-width="1.6"/>
    <line x1="14" y1="11" x2="20" y2="11" stroke="rgba(255,255,255,0.9)" stroke-width="1.6"/>
    <circle cx="11" cy="11" r="1.1" fill="rgba(255,255,255,0.95)"/>
  </svg>
`;
document.body.appendChild(fpsCrosshair);

// ---- FPS 用 HUD (弾数/リロード) ----
const fpsAmmoHud = document.createElement('div');
fpsAmmoHud.id = 'fps-ammo';
fpsAmmoHud.style.cssText = [
  'position:fixed', 'right:22px', 'bottom:22px',
  'padding:8px 14px', 'border-radius:8px',
  'background:rgba(10,14,22,0.55)',
  'color:#eaf3ff', 'font:600 20px/1.2 system-ui,-apple-system,sans-serif',
  'letter-spacing:0.06em', 'pointer-events:none', 'z-index:9998',
  'display:none', 'text-shadow:0 1px 2px rgba(0,0,0,0.5)',
  'border:1px solid rgba(180,220,255,0.25)',
].join(';');
fpsAmmoHud.textContent = '30 / 30';
document.body.appendChild(fpsAmmoHud);

// ---- FPS 用 HP バー ----
const fpsHpHud = document.createElement('div');
fpsHpHud.id = 'fps-hp';
fpsHpHud.style.cssText = [
  'position:fixed', 'left:22px', 'bottom:22px',
  'width:240px', 'padding:8px 10px 10px', 'border-radius:8px',
  'background:rgba(10,14,22,0.55)',
  'color:#eaf3ff', 'font:600 13px/1.2 system-ui,-apple-system,sans-serif',
  'letter-spacing:0.08em', 'pointer-events:none', 'z-index:9998',
  'display:none', 'text-shadow:0 1px 2px rgba(0,0,0,0.5)',
  'border:1px solid rgba(180,220,255,0.25)',
].join(';');
fpsHpHud.innerHTML = `
  <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
    <span>HP</span><span id="fps-hp-val">100 / 100</span>
  </div>
  <div style="height:8px;background:rgba(0,0,0,0.35);border-radius:4px;overflow:hidden;">
    <div id="fps-hp-bar" style="height:100%;width:100%;background:linear-gradient(90deg,#4fd1a0,#8ff3c8);transition:width 0.18s ease-out;"></div>
  </div>
`;
document.body.appendChild(fpsHpHud);
const fpsHpBar = fpsHpHud.querySelector('#fps-hp-bar');
const fpsHpVal = fpsHpHud.querySelector('#fps-hp-val');

// ---- FPS 用 武器スロット (数字キー1-3 でキャラ=武器切替) ----
const fpsWeaponHud = document.createElement('div');
fpsWeaponHud.id = 'fps-weapon';
fpsWeaponHud.style.cssText = [
  'position:fixed', 'left:50%', 'bottom:22px',
  'transform:translateX(-50%)',
  'display:none', 'gap:10px', 'z-index:9998',
  'pointer-events:none',
].join(';');
// dataset 定義: FPS用武器スロット(既存のキャラID流用)
const FPS_WEAPON_SLOTS = [
  { id: 'cat_neko', key: '4', label: 'ネコ' },
  { id: 'sensei',   key: '5', label: 'センセイ' },
  { id: 'owl_oto',  key: '6', label: 'オト' },
];
for (const s of FPS_WEAPON_SLOTS) {
  const slot = document.createElement('div');
  slot.dataset.charid = s.id;
  slot.style.cssText = [
    'padding:6px 10px', 'min-width:76px', 'text-align:center',
    'border-radius:8px', 'background:rgba(10,14,22,0.5)',
    'color:#dfe8ff', 'font:600 12px/1.2 system-ui,-apple-system,sans-serif',
    'letter-spacing:0.06em', 'border:1px solid rgba(180,220,255,0.25)',
    'text-shadow:0 1px 2px rgba(0,0,0,0.5)',
  ].join(';');
  slot.innerHTML = `<div style="font-size:10px;opacity:0.7;">[${s.key}]</div><div style="font-size:13px;">${s.label}</div>`;
  fpsWeaponHud.appendChild(slot);
}
document.body.appendChild(fpsWeaponHud);
function updateFpsWeaponHud() {
  for (const slot of fpsWeaponHud.children) {
    const isActive = slot.dataset.charid === currentCharId;
    slot.style.background = isActive
      ? 'rgba(90,170,255,0.35)'
      : 'rgba(10,14,22,0.5)';
    slot.style.borderColor = isActive
      ? 'rgba(180,220,255,0.9)'
      : 'rgba(180,220,255,0.25)';
    slot.style.boxShadow = isActive
      ? '0 0 12px rgba(120,190,255,0.5)'
      : 'none';
  }
}

// ---- FPS用ミニマップ（右上・80unit範囲・視線上向き） ----
const fpsMinimap = document.createElement('canvas');
fpsMinimap.id = 'fps-minimap';
fpsMinimap.width = 180;
fpsMinimap.height = 180;
// 通常ミニマップ（right:16px, width:200px）の左に配置：right = 16 + 200 + 16 = 232px
fpsMinimap.style.cssText = [
  'position:fixed', 'right:232px', 'top:70px',
  'width:180px', 'height:180px',
  'border-radius:50%',
  'background:rgba(8,12,20,0.5)',
  'border:1px solid rgba(180,220,255,0.3)',
  'box-shadow:0 2px 8px rgba(0,0,0,0.4)',
  'pointer-events:none', 'z-index:9998', 'display:none',
].join(';');
document.body.appendChild(fpsMinimap);
const fpsMinimapCtx = fpsMinimap.getContext('2d');

// ---- モード切替ヒント（左下）: [F] キーで FPS ↔ アクション ----
const modeHint = document.createElement('div');
modeHint.id = 'mode-hint';
modeHint.style.cssText = [
  'position:fixed', 'left:22px', 'bottom:22px',
  'padding:10px 14px',
  'background:rgba(8,12,20,0.55)',
  'border:1px solid rgba(180,220,255,0.35)',
  'border-radius:8px',
  'color:#e8f2ff', 'font-family:sans-serif', 'font-size:13px',
  'letter-spacing:0.02em', 'line-height:1.4',
  'box-shadow:0 2px 8px rgba(0,0,0,0.4)',
  'pointer-events:none', 'z-index:9998',
].join(';');
modeHint.innerHTML = `
  <div style="display:flex;align-items:center;gap:8px;">
    <span style="display:inline-flex;align-items:center;justify-content:center;
                 min-width:22px;height:22px;padding:0 6px;
                 background:rgba(255,255,255,0.12);
                 border:1px solid rgba(180,220,255,0.5);
                 border-radius:4px;font-weight:bold;">F</span>
    <span id="mode-hint-text">FPSモードへ切替</span>
  </div>
`;
document.body.appendChild(modeHint);
const modeHintText = modeHint.querySelector('#mode-hint-text');
function updateModeHint() {
  if (!modeHintText) return;
  modeHintText.textContent = (gameMode === 'fps') ? 'アクションモードへ戻る' : 'FPSモードへ切替';
}
const FPS_MINIMAP_RANGE = 80; // ワールド単位半径
function drawFpsMinimap() {
  const cx = fpsMinimap.width / 2;
  const cy = fpsMinimap.height / 2;
  const scale = (fpsMinimap.width / 2 - 8) / FPS_MINIMAP_RANGE;
  const ctx = fpsMinimapCtx;
  ctx.clearRect(0, 0, fpsMinimap.width, fpsMinimap.height);
  // 円形クリップ
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, fpsMinimap.width / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  // 背景ゲージ（同心円）
  ctx.strokeStyle = 'rgba(180,220,255,0.12)';
  ctx.lineWidth = 1;
  for (let r = 20; r < fpsMinimap.width / 2; r += 20) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  if (!player) { ctx.restore(); return; }
  const plX = player.object.position.x;
  const plZ = player.object.position.z;
  const yaw = player.yaw ?? 0;
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  // ワールド差分をビュー座標(前=上)に変換して描画
  //   view forward = (-sin(yaw), -cos(yaw)) を上向き(-Y方向)にする
  //   view right   = ( cos(yaw), -sin(yaw)) を右向き(+X方向)にする
  const toView = (wx, wz) => {
    const dx = wx - plX;
    const dz = wz - plZ;
    const rx = dx * cosY + dz * (-sinY);
    const forward = dx * (-sinY) + dz * (-cosY);
    return { x: cx + rx * scale, y: cy - forward * scale };
  };
  // カバー(遮蔽物)を灰色で描画
  if (window.__covers?.colliders) {
    ctx.fillStyle = 'rgba(160,190,220,0.35)';
    ctx.strokeStyle = 'rgba(200,220,255,0.55)';
    ctx.lineWidth = 1;
    for (const box of window.__covers.colliders) {
      const dx = (box.min.x + box.max.x) * 0.5 - plX;
      const dz = (box.min.z + box.max.z) * 0.5 - plZ;
      if (dx * dx + dz * dz > FPS_MINIMAP_RANGE * FPS_MINIMAP_RANGE * 1.6) continue;
      const corners = [
        toView(box.min.x, box.min.z),
        toView(box.max.x, box.min.z),
        toView(box.max.x, box.max.z),
        toView(box.min.x, box.max.z),
      ];
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  // 敵を赤いドットで描画
  ctx.fillStyle = '#ff5252';
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.object.position.x - plX;
    const dz = e.object.position.z - plZ;
    if (dx * dx + dz * dz > FPS_MINIMAP_RANGE * FPS_MINIMAP_RANGE) continue;
    const p = toView(e.object.position.x, e.object.position.z);
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // プレイヤーを中央に緑三角（常に上向き = 進行方向）
  ctx.fillStyle = '#7effa6';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx - 6, cy + 6);
  ctx.lineTo(cx + 6, cy + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // 外周の枠
  ctx.strokeStyle = 'rgba(180,220,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, fpsMinimap.width / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
  // N (方角) 表示
  ctx.font = '10px system-ui,-apple-system,sans-serif';
  ctx.fillStyle = 'rgba(230,240,255,0.7)';
  ctx.textAlign = 'center';
  // 北=ワールド +Z 方向。プレイヤー相対のビュー座標で N の位置を算出
  const nView = toView(plX + 0, plZ + FPS_MINIMAP_RANGE * 0.85);
  ctx.fillText('N', nView.x, Math.max(10, Math.min(fpsMinimap.height - 4, nView.y + 3)));
}

// ---- シーン ----
const scene = new THREE.Scene();

// ---- カメラ ----
const BASE_FOV = 65;
const camera = new THREE.PerspectiveCamera(
  BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.set(0, 5, 10);

// スコープ状態に応じて FOV を更新する。
// - FPSモードでスコープ装備時: FOV を zoom で割る（拡大鏡）
// - それ以外: BASE_FOV を維持
function updateScopeFov() {
  const zoom = (gameMode === 'fps' && player && player.equippedScope) ? (player.scopeZoom || 1) : 1;
  const targetFov = BASE_FOV / zoom;
  if (Math.abs(camera.fov - targetFov) > 0.01) {
    camera.fov = targetFov;
    camera.updateProjectionMatrix();
  }
}

// ---- ポストプロセス（Bloom + Vignette + Output/ToneMapping） ----
// renderer.toneMapping を OutputPass に任せるため、ここでは無効化
renderer.toneMapping = THREE.NoToneMapping;
const composer = new EffectComposer(renderer);
composer.setSize(window.innerWidth, window.innerHeight);
composer.setPixelRatio(window.devicePixelRatio);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Bloom：オーラ・剣の光・弾の発光をふんわり光らせる
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.65,  // strength（強さ）
  0.85,  // radius（広がり）
  0.55   // threshold（しきい値：これより明るい部分が光る）
);
composer.addPass(bloomPass);

// Vignette：画面四隅をうっすら暗く落として奥行きを出す
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.85 },
    uSmoothness: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uSmoothness;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 p = vUv - 0.5;
      float dist = length(p);
      float vignette = smoothstep(0.8, uSmoothness, dist * uIntensity);
      color.rgb *= vignette;
      gl_FragColor = color;
    }
  `,
};
const vignettePass = new ShaderPass(VignetteShader);
composer.addPass(vignettePass);

// 最後にトーンマッピング + sRGB 変換
const outputPass = new OutputPass();
composer.addPass(outputPass);
// OutputPass 側でトーンマッピングを行うので renderer 側を ACES に戻しておく
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

// ---- ステージ（空・地形・湖・山・木・雲・鳥・浮遊塵） ----
const stage = buildStage(scene);

// ---- カバー/建物レイアウト（FPS 用の遮蔽物・L字廊下・高台） ----
const covers = buildCoverLayout(scene);
// 他モジュールから参照できるようにグローバルに置いておく（暫定）
if (typeof window !== 'undefined') window.__covers = covers;

// ---- 高台の目印になる発光ビーコン旗 ----
// カバーの platform 位置に旗ポールと発光ヘッドを立てる
const beacons = []; // { headMat, headMesh, glow, flag, baseY, phase }
{
  const platformBoxes = covers.colliders.filter(
    (b) => b.userData && b.userData.type === 'platform',
  );
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a30, roughness: 0.5, metalness: 0.7,
  });
  const flagColors = [0xff4d6d, 0x4dc7ff]; // 東側=赤、西側=青
  for (let i = 0; i < platformBoxes.length; i++) {
    const box = platformBoxes[i];
    const cx = (box.min.x + box.max.x) * 0.5;
    const cz = (box.min.z + box.max.z) * 0.5;
    const topY = box.max.y;
    const flagColor = flagColors[i % flagColors.length];
    const group = new THREE.Group();
    group.position.set(cx, topY, cz);
    scene.add(group);
    // ポール
    const poleGeom = new THREE.CylinderGeometry(0.08, 0.08, 4.2, 8);
    const pole = new THREE.Mesh(poleGeom, poleMat);
    pole.position.y = 2.1;
    pole.castShadow = true;
    group.add(pole);
    // 旗（板ポリ）
    const flagGeom = new THREE.PlaneGeometry(1.6, 1.0);
    const flagMat = new THREE.MeshStandardMaterial({
      color: flagColor, side: THREE.DoubleSide,
      emissive: flagColor, emissiveIntensity: 0.4, roughness: 0.7,
    });
    const flag = new THREE.Mesh(flagGeom, flagMat);
    flag.position.set(0.8, 3.7, 0);
    group.add(flag);
    // 発光ヘッド（球）
    const headMat = new THREE.MeshStandardMaterial({
      color: flagColor, emissive: flagColor, emissiveIntensity: 1.8,
      roughness: 0.3, metalness: 0.1,
    });
    const headGeom = new THREE.SphereGeometry(0.28, 12, 12);
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 4.25;
    group.add(head);
    // ハロー（半透明スプライト風の板）
    const glowMat = new THREE.SpriteMaterial({
      color: flagColor, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.position.y = 4.25;
    glow.scale.set(1.6, 1.6, 1);
    group.add(glow);
    beacons.push({ headMat, glowMat, flag, group, phase: Math.random() * Math.PI * 2 });
  }
}
function updateBeacons(t) {
  for (const b of beacons) {
    const s = 0.5 + 0.5 * Math.sin(t * 2.4 + b.phase);
    b.headMat.emissiveIntensity = 1.2 + s * 1.4;
    b.glowMat.opacity = 0.35 + s * 0.35;
    b.glowMat.needsUpdate = true;
    const gs = 1.4 + s * 0.6;
    b.group.children[3].scale.set(gs, gs, 1); // glow は 4番目に追加
    // 旗を軽く揺らす
    b.flag.rotation.y = Math.sin(t * 1.6 + b.phase) * 0.25;
  }
}

// ---- プレイヤー ----
let currentCharId = 'cat_neko';
let playerChar = CHARACTERS[currentCharId].create();
playerChar.position.set(0, 3, 0);
scene.add(playerChar);

const input = new Input();
// キャンバスクリックで Pointer Lock を取得（マウス視点）
input.attachPointerLock(renderer.domElement);
// モバイル向けオンスクリーンコントローラ（右下のトグルで表示）
initMobileControls(input);
const player = new Player(playerChar, {
  ownerId: 'player',
  bulletColor: CHARACTERS[currentCharId].color,
  // 体力3倍化: 200 → 600
  maxHp: 600,
  attackSetId: currentCharId,
});
// ---- ゲームモード切替 ----
// 'action' = 三人称アクション（既存モード）
// 'fps'    = 一人称視点 FPS モード（後続タスクで射撃・クロスヘア等を実装）
// F キーでいつでも切り替え可能。
let gameMode = 'action';
const thirdPersonCam = new ThirdPersonCamera(camera, player);
const firstPersonCam = new FirstPersonCamera(camera, player);
let followCam = thirdPersonCam;

// ---- FPS 射撃状態（弾数/リロード/連射クールダウン） ----
const FPS_MAG_SIZE = 30;
const FPS_RELOAD_TIME = 1.5;    // 秒
const FPS_FIRE_INTERVAL = 0.085; // 秒（連射間隔 = 約 700rpm）
const FPS_BULLET_SPEED = 120;    // 単位/秒（既存 40 より高速化してヒットスキャン感を出す）
const FPS_BULLET_RADIUS = 0.18;
const FPS_BULLET_DMG = 12;       // ボディヒット時のダメージ（既存 BULLET_DAMAGE=10 と近い値）
const FPS_HEADSHOT_MUL = 2.0;    // ヘッドショット倍率
let fpsAmmo = FPS_MAG_SIZE;
let fpsReloadTimer = 0;
let fpsIsReloading = false;
let fpsFireCooldown = 0;
// FPS 用足音カデンス
let fpsFootstepTimer = 0;
let fpsPrevPos = new THREE.Vector3();
// リコイル & スプレッド（連射で拡散が広がり、撃たないと減衰）
const FPS_SPREAD_MIN = 0.006;   // 最小拡散(ラジアン)
const FPS_SPREAD_MAX = 0.045;   // 最大拡散(ラジアン)
const FPS_SPREAD_ADD = 0.010;   // 1発ごとの増加
const FPS_SPREAD_DECAY = 0.06;  // 秒あたり減衰量
let fpsSpread = FPS_SPREAD_MIN;
// リコイル(ピッチ跳ね上げ) — 発砲時に加算、update で減衰
const FPS_RECOIL_KICK = 0.032;    // 1発ごとのピッチ跳ね(ラジアン ≒ 1.8度)
const FPS_RECOIL_DECAY = 12;      // 減衰係数 (e^-k*t)
let fpsRecoilPitch = 0;

function updateFpsAmmoHud() {
  if (fpsIsReloading) {
    fpsAmmoHud.textContent = `RELOAD… ${Math.max(0, fpsReloadTimer).toFixed(1)}s`;
  } else {
    fpsAmmoHud.textContent = `${fpsAmmo} / ${FPS_MAG_SIZE}`;
  }
}

function updateFpsHpHud() {
  const hp = Math.max(0, Math.round(player.hp ?? 0));
  const max = Math.max(1, Math.round(player.maxHp ?? 100));
  const ratio = Math.max(0, Math.min(1, hp / max));
  fpsHpVal.textContent = `${hp} / ${max}`;
  fpsHpBar.style.width = (ratio * 100).toFixed(1) + '%';
  // 低 HP で色を赤めに
  if (ratio < 0.35) {
    fpsHpBar.style.background = 'linear-gradient(90deg,#e14b4b,#ff8080)';
  } else if (ratio < 0.65) {
    fpsHpBar.style.background = 'linear-gradient(90deg,#e6b04a,#ffd57a)';
  } else {
    fpsHpBar.style.background = 'linear-gradient(90deg,#4fd1a0,#8ff3c8)';
  }
}

function startFpsReload() {
  if (fpsIsReloading) return;
  if (fpsAmmo >= FPS_MAG_SIZE) return;
  fpsIsReloading = true;
  fpsReloadTimer = FPS_RELOAD_TIME;
  updateFpsAmmoHud();
}

// FPSモード時は自機モデル + 装備盾を非表示、アクションモード時は表示
// キャラ切替後 (player.object が新しい Group に差し替わった後) にも呼び直す必要がある
function applyPlayerVisibilityForMode() {
  const visible = (gameMode !== 'fps');
  if (player && player.object) player.object.visible = visible;
  // 旧参照の playerChar が残っていても念のため
  if (playerChar) playerChar.visible = visible;
  // 盾モデルは player.object の子だが、明示的にも制御する（安全策）
  if (player && player.equippedShieldModel) {
    player.equippedShieldModel.visible = visible;
  }
}

function setGameMode(mode) {
  if (mode !== 'action' && mode !== 'fps') return;
  if (gameMode === mode) return;
  gameMode = mode;
  followCam = (mode === 'fps') ? firstPersonCam : thirdPersonCam;
  // プレイヤーモデル & 装備の表示切替（一人称のときは自機と盾を非表示）
  applyPlayerVisibilityForMode();
  // FPS 用 UI の表示切替
  fpsCrosshair.style.display = (mode === 'fps') ? 'block' : 'none';
  fpsAmmoHud.style.display = (mode === 'fps') ? 'block' : 'none';
  fpsHpHud.style.display = (mode === 'fps') ? 'block' : 'none';
  fpsMinimap.style.display = (mode === 'fps') ? 'block' : 'none';
  fpsWeaponHud.style.display = (mode === 'fps') ? 'flex' : 'none';
  if (mode === 'fps') {
    updateFpsAmmoHud();
    updateFpsHpHud();
    drawFpsMinimap();
    updateFpsWeaponHud();
  }
  updateScopeFov();
  updateModeHint();
}

// F キー = 視点切替 / R キー = FPS 中のリロード
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && !e.repeat) {
    setGameMode(gameMode === 'fps' ? 'action' : 'fps');
  } else if (e.code === 'KeyR' && !e.repeat && gameMode === 'fps') {
    startFpsReload();
  }
});

// ---- 弾管理 ----
const projectiles = new ProjectileManager(scene);

// ---- 敵（とりあえず2体） ----
const enemies = [];
function spawnEnemy(charId, position) {
  // 敵も同じく maxHp を 200 に（プレイヤーと体力バランスを合わせる）
  const e = new Enemy(charId, position, { maxHp: 600, ownerId: 'enemy_' + enemies.length });
  scene.add(e.object);
  enemies.push(e);
  return e;
}
spawnEnemy('sensei', new THREE.Vector3(8, 4, -10));
spawnEnemy('owl_oto', new THREE.Vector3(-8, 6, -8));

// ---- アイテム（ワープスポット + 連射ブースト） ----
const items = new ItemManager(scene);
// ステージ拡張に合わせ、アイテムは中央アリーナ外周〜遠方まで広範囲に均等に散布する。
// ゴールデン角スパイラル(フィボナッチ配置)により、視覚的に完全に均等散布されるスロット配列を事前生成し、
// シャッフルして各アイテム種別に順番に割り当てる。これにより「中央密集」現象を根絶する。
function spawnDefaultItems() {
  const HALF = STAGE_BOUNDS.half;
  const ARENA = STAGE_BOUNDS.arenaRadius;
  // 散布対象の有効半径（外周の山岳手前まで）
  const MIN_R = ARENA + 40;       // 中央アリーナから十分離す
  const MAX_R = HALF * 0.62;      // 外周山岳の手前まで
  // 安定したレイアウトのため擬似乱数（seed 固定）
  let _seed = 1337;
  const rand = () => {
    _seed = (_seed * 1664525 + 1013904223) >>> 0;
    return _seed / 0xffffffff;
  };

  // ゴールデン角スパイラル配置でスロットを生成
  // t=(i+0.5)/N を面積一様半径に変換 → 半径分布は自動で均等（内外の密度が同じ）
  // 角度はゴールデン角(2.39996)で回すと重ならず均等被覆
  function buildSlots(N, minR, maxR, jitterR = 8, jitterA = 0.08) {
    const arr = [];
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      const r = Math.sqrt(t * (maxR * maxR - minR * minR) + minR * minR);
      const ang = i * 2.39996323;
      const jR = (rand() - 0.5) * jitterR;
      const jA = (rand() - 0.5) * jitterA;
      arr.push({ r: r + jR, ang: ang + jA });
    }
    // シャッフルして種別ごとの偏りを消す（金属探知ゲーム的な偏りを避ける）
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  // 通常アイテム用スロット（80枠）と乗り物用スロット（16枠、より外側）を用意
  const commonSlots = buildSlots(80, MIN_R, MAX_R);
  const vehicleSlotsNormal = buildSlots(10, ARENA + 100, MAX_R * 0.8);
  const vehicleSlotsLegend = buildSlots(6, ARENA + 200, MAX_R * 0.95);
  let commonIdx = 0;
  let vNormalIdx = 0;
  let vLegendIdx = 0;

  function pickFromSlot(slot, yOffset) {
    const x = Math.cos(slot.ang) * slot.r;
    const z = Math.sin(slot.ang) * slot.r;
    const y = getTerrainHeightAt(x, z) + yOffset;
    return new THREE.Vector3(x, y, z);
  }
  function pickGroundPos(_minSpacing, yOffset = 1.5, opts = {}) {
    // opts.slotType で乗り物枠を切り替え、それ以外は共通枠から順に取得
    if (opts.slotType === 'vehicleLegend') {
      const s = vehicleSlotsLegend[vLegendIdx++ % vehicleSlotsLegend.length];
      return pickFromSlot(s, yOffset);
    }
    if (opts.slotType === 'vehicleNormal') {
      const s = vehicleSlotsNormal[vNormalIdx++ % vehicleSlotsNormal.length];
      return pickFromSlot(s, yOffset);
    }
    const s = commonSlots[commonIdx++ % commonSlots.length];
    return pickFromSlot(s, yOffset);
  }

  // ワープスポット2ペア：外周〜中域に分散
  {
    const a = pickGroundPos(60, 4);
    const b = pickGroundPos(60, 4);
    items.addWarpPair(a, b, { colorA: 0x66ccff, colorB: 0xff7adf });
  }
  {
    const a = pickGroundPos(60, 18); // 上空ハブ
    a.y += 14;
    const b = pickGroundPos(60, 3);
    items.addWarpPair(a, b, { colorA: 0xb8ff66, colorB: 0xffd166 });
  }

  // 連射ブースト：開けた場所に3つ
  for (let i = 0; i < 3; i++) {
    const p = pickGroundPos(55, 5 + i * 2);
    items.addPowerUp(p, { mul: 0.45 - i * 0.05, duration: 8 + i * 2, respawn: 14 + i * 2 });
  }

  // 回復オーブ：3つを広域に
  for (let i = 0; i < 3; i++) {
    const p = pickGroundPos(55, 4 + i * 2);
    items.addHealOrb(p, { amount: 60 + i * 10, respawn: 14 + i * 3 });
  }

  // 武器ピックアップ：30種類をランダム散布
  const weapons = getAllWeapons();
  weapons.forEach((w) => {
    const pos = pickGroundPos(45, 1.6);
    items.addWeapon(pos, w, { respawn: 25 });
  });

  // 盾ピックアップ：10種類
  SHIELD_CATALOG.forEach((s) => {
    const pos = pickGroundPos(45, 1.6);
    items.addShield(pos, s, { respawn: 25 });
  });

  // 回復ピックアップ：10種類
  HEAL_CATALOG.forEach((h) => {
    const pos = pickGroundPos(45, 1.6);
    items.addHeal(pos, h, { respawn: 14 });
  });

  // スコープピックアップ：5種類(FPSモード時のみFOV倍率で効果あり)
  SCOPE_CATALOG.forEach((s) => {
    const pos = pickGroundPos(45, 1.6);
    items.addScope(pos, s);
  });

  // 乗り物：地上配置（他アイテムと分離した専用スロットで均等散布）
  VEHICLES.forEach((v) => {
    const isLeg = !!v.legendary;
    const opts = isLeg ? { slotType: 'vehicleLegend' } : { slotType: 'vehicleNormal' };
    const pos = pickGroundPos(80, 0.6, opts);
    items.addVehicleGround(pos, v, { respawn: 30 });
  });
}
spawnDefaultItems();

// ---- HUD ----
const hud = new HUD();
// 起動時の初期キャラのヘルプ(技ラベル)を反映
if (hud.updateCharacterHelp) {
  hud.updateCharacterHelp(player.getAttackLabels(), CHARACTERS[currentCharId].name);
}

// ---- エフェクト & オーディオ ----
const effects = new EffectManager(scene);
const audio = new AudioBus();

// プレイヤーに常時オーラを纏わせる（DBZ風）
let auraEntry = effects.attachAura(player.object, CHARACTERS[currentCharId].color);
// 残像スポーンの間隔タイマー
let afterImageTimer = 0;
const AFTER_IMAGE_INTERVAL = 0.05;

// ---- キャラ切替 ----
const charIds = ['cat_neko', 'sensei', 'owl_oto'];
function switchCharacter(id) {
  if (id === currentCharId) return;
  // 旧キャラからオーラを外す
  effects.detachAura(player.object);
  currentCharId = id;
  const newChar = CHARACTERS[id].create();
  player.swapCharacter(newChar, scene);
  player.bulletColor = CHARACTERS[id].color;
  // キャラごとの攻撃セットに切り替え（猫/先生/フクロウで挙動が大きく変わる）
  player.setAttackSet(id, CHARACTERS[id]);
  // 新キャラにオーラを纏わせる
  auraEntry = effects.attachAura(player.object, CHARACTERS[id].color);
  updateHUD();
  // ヘルプもキャラ別ラベルに更新（キャラ名も渡してタイトル表示）
  if (hud.updateCharacterHelp) {
    hud.updateCharacterHelp(player.getAttackLabels(), CHARACTERS[id].name);
  }
  // FPS 用武器スロットHUDの現在選択を更新
  updateFpsWeaponHud();
  // 新キャラの表示状態を現在のモードに合わせる（FPSなら不可視のまま維持）
  applyPlayerVisibilityForMode();
}
window.addEventListener('keydown', (e) => {
  // 初回入力でWebAudioを起動（ブラウザのautoplayポリシー対応）
  audio.ensureStarted();
  if (e.code === 'Digit1') switchCharacter('cat_neko');
  if (e.code === 'Digit2') switchCharacter('sensei');
  if (e.code === 'Digit3') switchCharacter('owl_oto');
  // FPS モード用の武器スロット (4/5/6) — 1/2/3 と同じキャラ切替を行う
  if (e.code === 'Digit4') switchCharacter('cat_neko');
  if (e.code === 'Digit5') switchCharacter('sensei');
  if (e.code === 'Digit6') switchCharacter('owl_oto');
  if (e.code === 'KeyR' && gameState === 'gameover') restart();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});

// ---- HUD（キャラ名） ----
const charNameEl = document.getElementById('char-name');
function updateHUD() {
  if (charNameEl) charNameEl.textContent = CHARACTERS[currentCharId].name;
}
updateHUD();

// ---- ゲームステート ----
// 'countdown' | 'playing' | 'paused' | 'gameover'
let gameState = 'countdown';
let countdownTimer = 0;
let countdownStep = 0; // 3,2,1,GO の順

const COUNTDOWN_STEPS = ['3', '2', '1', 'GO!'];
const COUNTDOWN_INTERVAL = 0.8; // 各ステップ表示時間（秒）

function startCountdown() {
  gameState = 'countdown';
  countdownStep = 0;
  countdownTimer = 0;
  hud.hideMessage();
  hud.hidePause();
  hud.showCountdown(COUNTDOWN_STEPS[0]);
  // 最初の'3'にもビープ
  audio.countdown(false);
}
function updateCountdown(dt) {
  countdownTimer += dt;
  if (countdownTimer >= COUNTDOWN_INTERVAL) {
    countdownTimer = 0;
    countdownStep++;
    if (countdownStep >= COUNTDOWN_STEPS.length) {
      hud.hideCountdown();
      gameState = 'playing';
    } else {
      hud.showCountdown(COUNTDOWN_STEPS[countdownStep]);
      // GO!のみ高いビープ、それ以外はカウント音
      audio.countdown(COUNTDOWN_STEPS[countdownStep] === 'GO!');
    }
  }
}

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    hud.showPause();
  } else if (gameState === 'paused') {
    gameState = 'playing';
    hud.hidePause();
  }
  // countdown / gameover 中はポーズ切替しない
}

// ---- 勝敗 ----
function checkGameOver() {
  if (gameState !== 'playing') return;
  if (!player.alive) {
    gameState = 'gameover';
    hud.showMessage('YOU LOSE  (R でリスタート)');
    audio.lose();
    followCam.shake(0.6, 3);
    return;
  }
  if (enemies.every((e) => !e.alive)) {
    gameState = 'gameover';
    hud.showMessage('YOU WIN!  (R でリスタート)');
    audio.win();
  }
}
function restart() {
  // 敵を片付ける
  for (const e of enemies) scene.remove(e.object);
  enemies.length = 0;
  // バトル終了 -> 効果/装備/最大HPをリセット(必殺技ゲージは保持)
  const charCfg = CHARACTERS[currentCharId] ?? {};
  player.resetForNewBattle({
    maxHp: charCfg.maxHp,
    baseSegmentHp: charCfg.baseSegmentHp,
  });
  player.object.position.set(0, 3, 0);
  player.velocity.set(0, 0, 0);
  player.setAttackSet(currentCharId, CHARACTERS[currentCharId]);
  // エフェクト類もリセット（オーラも消える）
  effects.clear();
  // オーラを付け直す
  auraEntry = effects.attachAura(player.object, CHARACTERS[currentCharId].color);
  // 弾もクリア
  projectiles.clear?.();
  // 敵再配置
  spawnEnemy('sensei', new THREE.Vector3(8, 4, -10));
  spawnEnemy('owl_oto', new THREE.Vector3(-8, 6, -8));
  // アイテム再配置
  items.clear();
  spawnDefaultItems();
  hud.hideMessage();
  startCountdown();
}

// 初回カウントダウン開始
startCountdown();

// ---- ウィンドウリサイズ ----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});

// ---- 剣ヒット判定（攻撃ごとのrange/arc/dmg/kbを使用） ----
function resolveSword() {
  if (!player.isHitActive()) return;
  const data = player.getAttackData();
  if (!data) return;
  const fwd = player.getForwardXZ();
  for (const e of enemies) {
    if (!e.alive) continue;
    if (player.hasHit(e)) continue;
    const delta = new THREE.Vector3().subVectors(e.object.position, player.object.position);
    const dist = delta.length();
    if (dist > data.range + e.radius) continue;
    const flat = new THREE.Vector3(delta.x, 0, delta.z);
    if (flat.lengthSq() < 1e-6) continue;
    flat.normalize();
    const dot = flat.dot(fwd);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (angle > data.arc) continue;
    // ヒット
    const wasAlive = e.alive;
    e.takeDamage(data.dmg);
    // 攻撃ヒットでアルティメットゲージ蓄積（ダメージの 0.5 倍）
    player.addUltimateCharge?.(data.dmg * 0.5);
    // ノックバック（前方ベクトル + わずかに上）
    if (e.velocity && e.velocity.addScaledVector) {
      e.velocity.addScaledVector(fwd, data.kb);
      e.velocity.y += data.kb * 0.3;
    } else {
      // 速度プロパティが無い場合は位置を直接押す
      e.object.position.addScaledVector(fwd, data.kb * 0.05);
    }
    // エフェクト＆SE
    const hitPos = e.object.position.clone();
    // キャラごとに違うヒットエフェクト（音符・五線譜リング・羽根）
    effects.spawnHitFx(data.hitFx || 'default', hitPos, data.hitColor || 0xffffff);
    audio.hit();
    // カメラシェイク（軽め）
    followCam.shake(0.15, 8);
    // 撃破判定
    if (wasAlive && !e.alive) {
      effects.spawnDeathExplosion(hitPos, 0xff6a4d);
      audio.enemyDown();
      followCam.shake(0.45, 4);
    }
    player.markHit(e);
  }
}

// ---- 弾ヒット判定 ----
const BULLET_DAMAGE = 10;
function resolveProjectiles() {
  // プレイヤーの弾 → 敵
  for (const e of enemies) {
    if (!e.alive) continue;
    const hits = projectiles.checkHits(e.object.position, e.radius, e.ownerId);
    for (const p of hits) {
      const wasAlive = e.alive;
      // 武器ピックアップ取得中はプレイヤー弾の威力を bulletDmgMul 倍にする
      const base = p.dmg ?? BULLET_DAMAGE;
      const dmgMul = (p.ownerId === player.ownerId) ? (player.bulletDmgMul ?? 1) : 1;
      const dmg = base * dmgMul;
      e.takeDamage(dmg);
      // 自プレイヤーの弾ヒット時のみアルティメットゲージ蓄積
      if (p.ownerId === player.ownerId) player.addUltimateCharge?.(dmg * 0.4);
      // 吸命弾（先生のB攻撃など）：プレイヤー所有の弾なら少しHP回復
      if (p.ownerId === player.ownerId && (p.healOnHit ?? 0) > 0 && player.alive) {
        const healed = player.heal?.(p.healOnHit) ?? 0;
        if (healed > 0) {
          // 緑のキラめきで吸命を可視化
          effects.spawnHitBurst?.(player.object.position.clone(), 0x6cff8a);
        }
      }
      p.alive = false;
      // ヒット位置で火花＋SE（FPSヘッドショットなら追加でチーン音）
      const hitPos = p.object ? p.object.position.clone() : e.object.position.clone();
      effects.spawnHitBurst(hitPos, player.bulletColor);
      if (p.headshot && audio.headshotPing) {
        audio.headshotPing();
        audio.impactHit?.();
      } else if (audio.impactHit) {
        audio.impactHit();
      } else {
        audio.hit();
      }
      // 撃破判定
      if (wasAlive && !e.alive) {
        effects.spawnDeathExplosion(e.object.position.clone(), 0xff6a4d);
        audio.enemyDown();
        followCam.shake(0.35, 4);
      }
    }
  }
  // 敵の弾 → プレイヤー
  if (player.alive) {
    const hits = projectiles.checkHits(player.object.position, player.radius, player.ownerId);
    for (const p of hits) {
      player.takeDamage(p.dmg ?? BULLET_DAMAGE, { audio });
      p.alive = false;
      // プレイヤー被弾フィードバック：3層（ワールドエフェクト＋画面赤フラッシュ＋SE）＋カメラシェイク
      effects.spawnPlayerHurt(player.object.position.clone());
      hud.flashHurt();
      audio.hurt();
      followCam.shake(0.25, 6);
    }
  }
}

// ---- メインループ ----
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // ステージはどんな状態でも演出として動かす（カメラ越しの空気感）
  stage.update(dt);
  covers.update(dt);
  updateBeacons(clock.elapsedTime);

  if (gameState === 'paused') {
    // 何も進めない。カメラは現状維持で描画のみ。
    composer.render(dt);
    return;
  }

  if (gameState === 'countdown') {
    updateCountdown(dt);
    // プレイヤーは「止まったまま」を表現するため入力なしで update（空入力相当）
    player.update(dt, EMPTY_INPUT);
    followCam.update(dt);
    hud.updatePlayer(player);
    hud.updateEnemies(enemies, camera);
    hud.updateMinimap?.(player, enemies, items);
    composer.render(dt);
    return;
  }

  // playing / gameover
  player.update(dt, input);
  followCam.update(dt);

  // FPS モードのリロード/連射クールダウン進行
  if (gameMode === 'fps') {
    if (fpsFireCooldown > 0) fpsFireCooldown = Math.max(0, fpsFireCooldown - dt);
    // スプレッドの自然減衰
    if (fpsSpread > FPS_SPREAD_MIN) {
      fpsSpread = Math.max(FPS_SPREAD_MIN, fpsSpread - FPS_SPREAD_DECAY * dt);
    }
    // リコイル(ピッチ)の減衰: 蓄積分を少しずつプレイヤーピッチから戻す
    if (fpsRecoilPitch > 0.0005) {
      const dec = fpsRecoilPitch * (1 - Math.exp(-FPS_RECOIL_DECAY * dt));
      fpsRecoilPitch -= dec;
      player.pitch = Math.max(-Math.PI / 3, player.pitch - dec * 0.6);
    } else if (fpsRecoilPitch !== 0) {
      fpsRecoilPitch = 0;
    }
    if (fpsIsReloading) {
      fpsReloadTimer -= dt;
      if (fpsReloadTimer <= 0) {
        fpsIsReloading = false;
        fpsReloadTimer = 0;
        fpsAmmo = FPS_MAG_SIZE;
      }
      updateFpsAmmoHud();
    }
    // HP バー更新（毎フレーム軽量に）
    updateFpsHpHud();
    // ミニマップ更新
    drawFpsMinimap();

    // 足音: プレイヤーの水平移動量から歩幅を検出して鳴らす
    if (player && player.alive) {
      const pp = player.object.position;
      const dxz = Math.hypot(pp.x - fpsPrevPos.x, pp.z - fpsPrevPos.z);
      fpsPrevPos.copy(pp);
      // 空中では鳴らない: y 速度が大きい/地面から離れているケースは省略（音量で吸収）
      // 移動速度に比例して間隔短縮（0.32s〜0.55s）
      if (dxz > 0.02) {
        fpsFootstepTimer -= dt;
        if (fpsFootstepTimer <= 0) {
          audio.footstep?.();
          // dt=1/60 で dxz が 0.15 くらいなら 0.35s、遅ければ 0.55s
          const speedFactor = Math.min(1, dxz / (dt * 8));
          fpsFootstepTimer = 0.55 - 0.23 * speedFactor;
        }
      } else {
        fpsFootstepTimer = 0.1;
      }
    }
  }

  if (gameState === 'playing') {
    // Z攻撃 — 装備武器の種類で動作が変わる
    //   剣  : 剣の振り（軽攻撃を発動）
    //   銃  : 弾の色/速度/サイズ/拡散/連射が武器ごとに異なる
    //   杖  : 誘導付きの魔法弾（炎玉スタイル）
    //   素手: 従来の音符弾
    if (input.isDown('KeyZ')) {
      // ---- FPS モード分岐: カメラ位置から真直ぐ発射 + ヒットスキャンでヘッドショット判定 ----
      if (gameMode === 'fps') {
        if (!fpsIsReloading && fpsAmmo > 0 && fpsFireCooldown <= 0) {
          // カメラの実際の向きを使う（yaw/pitch と一致するが行列由来なので安全）
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          const origin = camera.position.clone();

          // ---- スプレッド適用: 発射方向を円錐内でランダム化 ----
          {
            const ang = Math.random() * Math.PI * 2;
            const rad = Math.sqrt(Math.random()) * fpsSpread;
            const up = new THREE.Vector3(0, 1, 0);
            const right = new THREE.Vector3().crossVectors(dir, up).normalize();
            if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
            const trueUp = new THREE.Vector3().crossVectors(right, dir).normalize();
            dir.addScaledVector(right, Math.cos(ang) * rad);
            dir.addScaledVector(trueUp, Math.sin(ang) * rad);
            dir.normalize();
          }

          // ヒットスキャン: 直進レイと各敵ヒットスフィアの最近点距離を計算し、
          // 最も近い敵にヒット。ヘッドゾーン（敵中心から上に radius*1.6 の高さ帯）で 2 倍ダメージ。
          let bestT = Infinity;
          let bestEnemy = null;
          let bestHead = false;
          const MAX_RANGE = 200;
          // 壁（カバー）にレイが最初に当たる距離を求めておく
          const wallT = covers.raycastNearestT(origin, dir, MAX_RANGE) ?? MAX_RANGE;
          for (const e of enemies) {
            if (!e.alive) continue;
            const centerBody = e.object.position.clone();
            centerBody.y += e.radius * 0.9; // ボディ中心（腹〜胸あたり）
            const centerHead = e.object.position.clone();
            centerHead.y += e.radius * 2.2; // ヘッド中心（頭部想定）
            // レイ上の最近点までのパラメータ t（>0 のとき前方）
            const to = centerBody.clone().sub(origin);
            const t = to.dot(dir);
            if (t < 0 || t > MAX_RANGE) continue;
            // 壁の手前より奥ならヒットしない（遮蔽）
            if (t > wallT) continue;
            const closest = origin.clone().addScaledVector(dir, t);
            const dBody = closest.distanceTo(centerBody);
            const dHead = closest.distanceTo(centerHead);
            const headHit = dHead < e.radius * 0.65;
            const bodyHit = dBody < e.radius * 1.05;
            if (!headHit && !bodyHit) continue;
            if (t < bestT) {
              bestT = t;
              bestEnemy = e;
              bestHead = headHit;
            }
          }

          // 弾ダメージを事前決定 → 既存の弾/衝突パイプラインに委ねる
          const dmg = FPS_BULLET_DMG * (bestHead ? FPS_HEADSHOT_MUL : 1);
          const color = player.bulletColor;
          projectiles.spawn(origin, dir, color, player.ownerId, {
            style: 'note',
            speed: FPS_BULLET_SPEED,
            radius: FPS_BULLET_RADIUS,
            dmg,
            life: 1.6,
            inheritVelocity: player.velocity.clone(),
            headshot: bestHead,
          });

          // ヘッドショット時は火花を少し豪華に（着弾時のみでなく事前ヒントとしても）
          if (bestEnemy && bestHead) {
            const hitPos = origin.clone().addScaledVector(dir, bestT);
            effects.spawnHitBurst?.(hitPos, 0xffe066);
          }

          fpsAmmo -= 1;
          fpsFireCooldown = FPS_FIRE_INTERVAL;
          // ---- リコイル: ピッチ跳ね上げ + 拡散増加 ----
          fpsRecoilPitch += FPS_RECOIL_KICK;
          fpsSpread = Math.min(FPS_SPREAD_MAX, fpsSpread + FPS_SPREAD_ADD);
          player.pitch = Math.min(Math.PI / 3, player.pitch + FPS_RECOIL_KICK * 0.6);
          if (audio.gunFire) audio.gunFire({ kind: 'gun' }); else audio.fire?.();

          if (fpsAmmo <= 0) startFpsReload(); // 空撃ちしたら自動リロード
          updateFpsAmmoHud();
        }
        // FPS モード時は既存の武器分岐をスキップ（自機モデル非表示のため）
      } else {
      const w = player.equippedWeapon;
      const kind = w?.kind;
      if (kind === 'sword') {
        // 剣装備中は Z で剣を振る（X と同じ軽攻撃を起動）
        const swung = player.tryStartAttack('light', input);
        if (swung) audio.swordSwing?.(w) ?? audio.sword();
      } else if (player.canFire()) {
        const baseDir = player.getAimDirection();
        const muzzle = player.getMuzzlePosition();
        if (kind === 'gun') {
          // 銃: 色/弾速/弾サイズ/拡散/スタイル を武器ごとに反映
          const color = w.color ?? player.bulletColor;
          const spread = w.spread || 0;                  // ショットガン等の散弾数（>0で複数発）
          const count = spread > 0 ? spread : 1;
          const style = w.projectileStyle || 'note';
          const speed = w.projectileSpeed;
          const radius = w.projectileRadius;
          for (let i = 0; i < count; i++) {
            const dir = baseDir.clone();
            if (count > 1) {
              // 散弾の拡散（±0.12 rad 相当）
              dir.x += (Math.random() - 0.5) * 0.24;
              dir.y += (Math.random() - 0.5) * 0.12;
              dir.z += (Math.random() - 0.5) * 0.24;
              dir.normalize();
            }
            projectiles.spawn(muzzle, dir, color, player.ownerId, {
              style,
              speed,
              radius,
              inheritVelocity: player.velocity.clone(),
            });
          }
          // fireMul が大きいほど連射が速い（クールダウン短縮）
          const fireMul = w.fireMul ?? 1;
          player.resetFireCooldown(1 / Math.max(0.1, fireMul));
          if (audio.gunFire) audio.gunFire(w); else audio.fire();
        } else if (kind === 'wand') {
          // 杖: 誘導魔法弾（炎玉スタイル）
          const color = w.color ?? player.bulletColor;
          const style = w.projectileStyle || 'fire';
          const radius = w.projectileRadius;
          const homing = w.projectileHoming ?? 0.3;
          projectiles.spawn(muzzle, baseDir, color, player.ownerId, {
            style,
            radius,
            homing,
            inheritVelocity: player.velocity.clone(),
          });
          const fireMul = w.fireMul ?? 1;
          player.resetFireCooldown(1 / Math.max(0.1, fireMul));
          if (audio.wandCast) audio.wandCast(w); else audio.fire();
        } else {
          // 素手: 従来の音符弾
          projectiles.spawn(muzzle, baseDir, player.bulletColor, player.ownerId, {
            inheritVelocity: player.velocity.clone(),
          });
          player.resetFireCooldown(1);
          audio.fire();
        }
      }
      } // end action-mode Z branch
    }
    // 必殺技（V）— ゲージMAX時のみ発動 / キャラごとに技と演出が異なる
    if (input.isDown('KeyV') && player.isUltimateReady()) {
      const pos = player.object.position.clone();
      // 水平視線方向 (Y成分排除)
      const aim = player.getAimDirection();
      const flatDir = new THREE.Vector3(aim.x, 0, aim.z);
      if (flatDir.lengthSq() < 0.001) flatDir.copy(player.getForwardXZ());
      flatDir.normalize();

      // 前方コーン内で最も近い敵をターゲット選定 (sensei用)
      let target = null;
      let bestScore = -Infinity;
      for (const e of enemies) {
        if (!e.alive) continue;
        const toE = e.object.position.clone().sub(pos);
        const dist = toE.length();
        if (dist > 35 || dist < 0.01) continue;
        const flatToE = new THREE.Vector3(toE.x, 0, toE.z);
        if (flatToE.lengthSq() < 0.001) continue;
        flatToE.normalize();
        const dot = flatToE.dot(flatDir);
        if (dot < 0.4) continue; // 前方コーン約66度
        // 角度と距離のスコア
        const score = dot - dist * 0.02;
        if (score > bestScore) { bestScore = score; target = e; }
      }

      const charId = player.attackSetId;
      const targetPos = target ? target.object.position.clone() : null;
      effects.triggerUltimate?.(pos, flatDir, charId, targetPos);
      player.consumeUltimate();

      // キャラ別ダメージ適用
      if (charId === 'sensei') {
        // 神聖光柱: 単体に巨大ダメージ + 着弾点周辺AOE
        const land = targetPos || pos.clone().addScaledVector(flatDir, 20);
        if (target) target.takeDamage?.(180);
        for (const e of enemies) {
          if (!e.alive) continue;
          if (e === target) continue;
          if (e.object.position.distanceTo(land) < 7) e.takeDamage?.(50);
        }
      } else if (charId === 'owl_oto') {
        // 羽根の竜巻: 前方コーン (約120度) 範囲22に貫通ダメージ
        for (const e of enemies) {
          if (!e.alive) continue;
          const toE = e.object.position.clone().sub(pos);
          const dist = toE.length();
          if (dist > 22) continue;
          const flatToE = new THREE.Vector3(toE.x, 0, toE.z);
          if (flatToE.lengthSq() < 0.001) { e.takeDamage?.(50); continue; }
          flatToE.normalize();
          if (flatToE.dot(flatDir) > 0.45) e.takeDamage?.(75);
        }
      } else {
        // cat_neko (デフォルト): 音符の波動 — 中心リング + 前方扇
        for (const e of enemies) {
          if (!e.alive) continue;
          const toE = e.object.position.clone().sub(pos);
          const dist = toE.length();
          if (dist > 24) continue;
          if (dist < 8) {
            e.takeDamage?.(60); // 中心リング
            continue;
          }
          const flatToE = new THREE.Vector3(toE.x, 0, toE.z);
          if (flatToE.lengthSq() < 0.001) continue;
          flatToE.normalize();
          if (flatToE.dot(flatDir) > 0.3) e.takeDamage?.(50); // 前方扇
        }
      }
      followCam.shake(0.6, 9);
      audio.shoot?.();
    }
    // 弱攻撃（X）：方向キーとの組み合わせでスマブラ式の派生（ジャブ連→横/上/下強→空中攻撃）
    if (input.isDown('KeyX')) {
      const kind = player.tryStartAttack('light', input);
      if (kind) {
        const w = player.equippedWeapon;
        if (audio.swordSwing && w?.kind === 'sword') audio.swordSwing(w); else audio.sword();
      }
    }
    // 強攻撃（C）：スマッシュ系
    if (input.isDown('KeyC')) {
      const kind = player.tryStartAttack('heavy', input);
      if (kind) {
        const w = player.equippedWeapon;
        if (audio.swordSwing && w?.kind === 'sword') audio.swordSwing(w); else audio.sword();
      }
    }
    // 特殊攻撃（B）：飛び道具系（大型/連射/誘導）
    if (input.isDown('KeyB')) {
      // レッドドラゴン搭乗中は巨大火の玉3連射を優先
      if (player.mountedVehicle && player.mountedVehicle.id === 'veh_dragon') {
        player.tryStartDragonFire(projectiles, audio);
      } else if (player.mountedVehicle && player.mountedVehicle.id === 'veh_ufo') {
        // UFO搭乗中は真下に雷を落とす
        player.tryUfoLightning(effects, enemies, audio);
      } else {
        const fired = player.trySpecialFire(projectiles, audio);
        if (fired) audio.fire();
      }
    }
    // 火の玉バースト進行(0.5秒間隔で3発)
    if (player.updateDragonFireballs) {
      player.updateDragonFireballs(dt, projectiles, audio);
    }
    // レッドドラゴン: 敵に接触するだけで体当たりダメージ
    if (player.updateDragonContactDamage) {
      player.updateDragonContactDamage(dt, enemies);
    }
    // レッドドラゴン等: 移動中はエンジン後方から火炎を噴射
    if (player.updateDragonExhaustFire) {
      player.updateDragonExhaustFire(dt, scene, enemies);
    }
    // スカイボード: Shift中に後方へ追い風の帯を吐き、範囲ダメージ
    if (player.updateSkyBoardWind) {
      player.updateSkyBoardWind(dt, scene, enemies, input);
    }
    // ダッシュ中は残像をパラパラとスポーン
    if (player.isDashing && player.isDashing()) {
      afterImageTimer += dt;
      while (afterImageTimer >= AFTER_IMAGE_INTERVAL) {
        afterImageTimer -= AFTER_IMAGE_INTERVAL;
        effects.spawnAfterImage(player.object, player.bulletColor);
      }
    } else {
      afterImageTimer = 0;
    }
  }

  // 誘導弾用のターゲット集合を渡す（プレイヤーの弾は敵を狙い、敵の弾はプレイヤーを狙う）
  projectiles.update(dt, [player, ...enemies]);
  for (const e of enemies) {
    if (gameState === 'playing') {
      e.update(dt, { player, projectiles });
    } else {
      // gameover中も浮遊・沈下だけは続ける
      e.update(dt, {});
    }
  }

  resolveSword();
  resolveProjectiles();

  // アイテム（ワープ・パワーアップ）：演出は常時、当たり判定は playing 中のみ
  items.update(dt);
  if (gameState === 'playing') {
    const events = items.checkPickup(player);
    for (const ev of events) {
      if (ev.kind === 'warp') {
        // 出口で軽くカメラを揺らす + SE
        followCam.shake(0.3, 6);
        effects.spawnHitBurst?.(ev.position, ev.to.color);
        audio.shoot?.();
      } else if (ev.kind === 'powerup') {
        effects.spawnHitBurst?.(player.object.position.clone(), ev.item.coreColor);
        audio.shoot?.();
      } else if (ev.kind === 'heal') {
        // 回復オーブ：緑色の火花＋SE、HUD に簡易メッセージ
        effects.spawnHitBurst?.(player.object.position.clone(), 0x6cff8a);
        audio.shoot?.();
        const nm = ev.name || '回復';
        hud.showPickupMessage?.(`${nm} +${ev.amount} HP`);
      } else if (ev.kind === 'weapon') {
        // 武器ピックアップ：赤系の火花＋SE
        effects.spawnHitBurst?.(player.object.position.clone(), 0xff5a3c);
        audio.shoot?.();
        const nm = ev.name || '武器';
        hud.showPickupMessage?.(`${nm} GET! ${ev.duration}秒`);
      } else if (ev.kind === 'vehicle') {
        // 乗り物ピックアップ：シアン系の火花＋乗り物固有SE
        effects.spawnHitBurst?.(player.object.position.clone(), 0x4be0ff);
        if (audio.vehicleMount) audio.vehicleMount(ev.item?.cfg?.id); else audio.shoot?.();
        const nm = ev.name || '乗り物';
        hud.showPickupMessage?.(`${nm} GET! ${ev.duration}秒`);
      } else if (ev.kind === 'shield') {
        // 盾ピックアップ：水色の火花＋SE
        effects.spawnHitBurst?.(player.object.position.clone(), 0x8ad8ff);
        audio.shoot?.();
        const nm = ev.name || '盾';
        hud.showPickupMessage?.(`${nm} GET! ${ev.duration}秒`);
      } else if (ev.kind === 'scope') {
        // スコープピックアップ：紫系の火花＋SE、FPS時のみ即時反映
        effects.spawnHitBurst?.(player.object.position.clone(), 0xff88ff);
        audio.shoot?.();
        const nm = ev.name || 'スコープ';
        const z = (ev.item?.cfg?.zoom ?? 1).toFixed(1);
        hud.showPickupMessage?.(`${nm} GET! x${z} (FPS時)`);
        updateScopeFov();
      }
    }
  }

  // エフェクトのアニメ更新
  effects.update(dt);

  hud.updatePlayer(player);
  hud.updateEnemies(enemies, camera);
  hud.updateMinimap?.(player, enemies, items);

  // スコープ FOV 更新(モード/装備変化に追従)
  updateScopeFov();

  checkGameOver();

  composer.render(dt);
}

// カウントダウン中に渡す空入力（全キー offを返す）
const EMPTY_INPUT = { isDown: () => false };

animate();
