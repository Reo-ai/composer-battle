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
import { ThirdPersonCamera } from './camera.js';
import { ProjectileManager } from './projectile.js';
import { Enemy } from './enemy.js';
import { HUD } from './ui.js';
import { buildStage, STAGE_BOUNDS, getTerrainHeightAt } from './stage.js';
import { EffectManager } from './effects.js';
import { AudioBus } from './audio.js';
import { ItemManager, SHIELD_CATALOG, HEAL_CATALOG } from './items.js';
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

// ---- シーン ----
const scene = new THREE.Scene();

// ---- カメラ ----
const camera = new THREE.PerspectiveCamera(
  65, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.set(0, 5, 10);

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
  // 要望：1 回ダメージのゲージ消費量を減らすため maxHp を 200 に増加（被弾耐性 2 倍）
  maxHp: 200,
  attackSetId: currentCharId,
});
const followCam = new ThirdPersonCamera(camera, player);

// ---- 弾管理 ----
const projectiles = new ProjectileManager(scene);

// ---- 敵（とりあえず2体） ----
const enemies = [];
function spawnEnemy(charId, position) {
  // 敵も同じく maxHp を 200 に（プレイヤーと体力バランスを合わせる）
  const e = new Enemy(charId, position, { maxHp: 200, ownerId: 'enemy_' + enemies.length });
  scene.add(e.object);
  enemies.push(e);
  return e;
}
spawnEnemy('sensei', new THREE.Vector3(8, 4, -10));
spawnEnemy('owl_oto', new THREE.Vector3(-8, 6, -8));

// ---- アイテム（ワープスポット + 連射ブースト） ----
const items = new ItemManager(scene);
// ステージ拡張に合わせ、アイテムは中央アリーナ外周〜遠方まで広範囲にランダム散布する。
// 同じ位置に偏らないよう、最小距離を保ちながら振り分ける。
function spawnDefaultItems() {
  const HALF = STAGE_BOUNDS.half;
  const ARENA = STAGE_BOUNDS.arenaRadius;
  // 散布対象の有効半径（外周の山岳手前まで）
  const MIN_R = ARENA + 16;       // 中央アリーナをよける
  const MAX_R = HALF * 0.62;      // 外周山岳の手前まで
  const placed = []; // {x,z,minD}
  // 安定したレイアウトのため擬似乱数（seed 固定）
  let _seed = 1337;
  const rand = () => {
    _seed = (_seed * 1664525 + 1013904223) >>> 0;
    return _seed / 0xffffffff;
  };
  // 候補をN回試して既存と最低距離以上ならOK
  function pickGroundPos(minSpacing, yOffset = 1.5, opts = {}) {
    const ringFromArena = opts.ringFromArena ?? false;
    const maxR = opts.maxR ?? MAX_R;
    const minR = opts.minR ?? MIN_R;
    for (let tries = 0; tries < 80; tries++) {
      const ang = rand() * Math.PI * 2;
      // 偏らないよう sqrt(r) 補正で面積一様サンプル
      const t = rand();
      const r = Math.sqrt(t) * (maxR - minR) + minR;
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      // 既存との最小距離チェック
      let ok = true;
      for (const p of placed) {
        const dx = x - p.x, dz = z - p.z;
        if (dx * dx + dz * dz < (minSpacing * minSpacing)) { ok = false; break; }
      }
      if (!ok) continue;
      placed.push({ x, z });
      const y = getTerrainHeightAt(x, z) + yOffset;
      return new THREE.Vector3(x, y, z);
    }
    // フォールバック：制約を諦めて最後の候補を返す
    const ang = rand() * Math.PI * 2;
    const r = (minR + maxR) * 0.5;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    placed.push({ x, z });
    return new THREE.Vector3(x, getTerrainHeightAt(x, z) + yOffset, z);
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

  // 乗り物：地上配置（アリーナ周辺の見つけやすい距離に、伝説はやや遠め）
  VEHICLES.forEach((v) => {
    const isLeg = !!v.legendary;
    // ステージ2x拡張に合わせて配置範囲も広げる
    // 非伝説：ARENA+16 〜 ARENA+110 の近距離リング（3方向に確実に）
    // 伝説：ARENA+60 〜 ARENA+180（探索の楽しみ）
    const opts = isLeg
      ? { minR: ARENA + 60, maxR: ARENA + 180 }
      : { minR: ARENA + 16, maxR: ARENA + 110 };
    const pos = pickGroundPos(35, 0.6, opts);
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
}
window.addEventListener('keydown', (e) => {
  // 初回入力でWebAudioを起動（ブラウザのautoplayポリシー対応）
  audio.ensureStarted();
  if (e.code === 'Digit1') switchCharacter('cat_neko');
  if (e.code === 'Digit2') switchCharacter('sensei');
  if (e.code === 'Digit3') switchCharacter('owl_oto');
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
      // ヒット位置で火花＋SE
      const hitPos = p.object ? p.object.position.clone() : e.object.position.clone();
      effects.spawnHitBurst(hitPos, player.bulletColor);
      audio.hit();
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

  if (gameState === 'playing') {
    // Z攻撃 — 装備武器の種類で動作が変わる
    //   剣  : 剣の振り（軽攻撃を発動）
    //   銃  : 弾の色/速度/サイズ/拡散/連射が武器ごとに異なる
    //   杖  : 誘導付きの魔法弾（炎玉スタイル）
    //   素手: 従来の音符弾
    if (input.isDown('KeyZ')) {
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
          });
          const fireMul = w.fireMul ?? 1;
          player.resetFireCooldown(1 / Math.max(0.1, fireMul));
          if (audio.wandCast) audio.wandCast(w); else audio.fire();
        } else {
          // 素手: 従来の音符弾
          projectiles.spawn(muzzle, baseDir, player.bulletColor, player.ownerId);
          player.resetFireCooldown(1);
          audio.fire();
        }
      }
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
      // レッドドラゴン搭乗中は火炎放射(1.5秒)を優先
      if (player.mountedVehicle && player.mountedVehicle.id === 'veh_dragon') {
        player.tryStartDragonFire(audio);
      } else if (player.mountedVehicle && player.mountedVehicle.id === 'veh_ufo') {
        // UFO搭乗中は真下に雷を落とす
        player.tryUfoLightning(effects, enemies, audio);
      } else {
        const fired = player.trySpecialFire(projectiles, audio);
        if (fired) audio.fire();
      }
    }
    // 火炎放射中: 連続する炎ストリーム表示 + 円錐範囲ダメージ
    if (player.updateDragonFireSpray) {
      player.updateDragonFireSpray(dt, scene, enemies);
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
      }
    }
  }

  // エフェクトのアニメ更新
  effects.update(dt);

  hud.updatePlayer(player);
  hud.updateEnemies(enemies, camera);
  hud.updateMinimap?.(player, enemies, items);

  checkGameOver();

  composer.render(dt);
}

// カウントダウン中に渡す空入力（全キー offを返す）
const EMPTY_INPUT = { isDown: () => false };

animate();
