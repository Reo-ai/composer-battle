// ワールドに配置するアイテム類
//  - WarpSpot:         ペアになった相手位置へワープ
//  - PowerUp:          一時的な連射バフ等
//  - HealPickup:       回復(10種)
//  - WeaponPickup:     武器(30種: 剣10/銃10/杖10) — 拾うと装備
//  - ShieldPickup:     盾(10種) — 拾うと装備
//  - VehicleGroundSpawn: 乗り物(5種) — 地面に置かれ、触れると搭乗
//
// すべて ItemManager 経由でシーンに登録し、main.js のメインループから update / checkPickup を呼ぶ。

import * as THREE from 'three';
import { getWeaponById, getAllWeapons } from './weapons.js';
import { getVehicleById, VEHICLES } from './vehicles.js';

const WARP_RADIUS = 1.8;
const POWERUP_RADIUS = 1.1;
const HEAL_RADIUS = 1.1;
const WEAPON_RADIUS = 1.3;
const SHIELD_RADIUS = 1.3;
const VEHICLE_RADIUS = 2.2;
const SCOPE_RADIUS = 1.2;

// ============================================================
// シールドカタログ(10種)
// ============================================================
export const SHIELD_CATALOG = [
  { id: 'shd_buckler', name: 'バックラー',     shape: 'buckler',  color: 0xb08040, dmgReduce: 0.15, duration: 25, hp: 60,
    statsText: ['ダメージ軽減 15%', '耐久 60', '持続 ∞（永続）'] },
  { id: 'shd_kite',    name: 'カイトシールド', shape: 'kite',     color: 0x6688cc, dmgReduce: 0.25, duration: 28, hp: 90,
    statsText: ['ダメージ軽減 25%', '耐久 90', '持続 ∞（永続）'] },
  { id: 'shd_tower',   name: 'タワーシールド', shape: 'tower',    color: 0x888888, dmgReduce: 0.40, duration: 30, hp: 160,
    statsText: ['ダメージ軽減 40%', '耐久 160', '持続 ∞（永続）'] },
  { id: 'shd_aegis',   name: 'イージスの盾',   shape: 'aegis',    color: 0xffcc44, dmgReduce: 0.35, duration: 35, hp: 140,
    statsText: ['ダメージ軽減 35%', '耐久 140', '持続 ∞（永続）'] },
  { id: 'shd_spike',   name: 'スパイクシールド', shape: 'spike',  color: 0x884422, dmgReduce: 0.20, duration: 25, hp: 80, reflect: 0.5,
    statsText: ['ダメージ軽減 20%', '耐久 80', '反射 50%', '持続 ∞（永続）'] },
  { id: 'shd_crystal', name: 'クリスタル盾',   shape: 'crystal',  color: 0x88ffee, dmgReduce: 0.30, duration: 32, hp: 110,
    statsText: ['ダメージ軽減 30%', '耐久 110', '持続 ∞（永続）'] },
  { id: 'shd_runic',   name: 'ルーンシールド', shape: 'runic',    color: 0x9966ff, dmgReduce: 0.30, duration: 35, hp: 120,
    statsText: ['ダメージ軽減 30%', '耐久 120', '持続 ∞（永続）'] },
  { id: 'shd_dragon',  name: 'ドラゴンシールド', shape: 'dragon', color: 0xcc2244, dmgReduce: 0.45, duration: 30, hp: 180,
    statsText: ['ダメージ軽減 45%', '耐久 180', '持続 ∞（永続）'] },
  { id: 'shd_holy',    name: '聖騎士の盾',     shape: 'holy',     color: 0xffffe0, dmgReduce: 0.40, duration: 40, hp: 200,
    statsText: ['ダメージ軽減 40%', '耐久 200', '持続 ∞（永続）'] },
  { id: 'shd_void',    name: 'ヴォイドシールド', shape: 'void',   color: 0x220033, dmgReduce: 0.55, duration: 25, hp: 220, reflect: 0.3,
    statsText: ['ダメージ軽減 55%', '耐久 220', '反射 30%', '持続 ∞（永続）'] },
];

// ============================================================
// 回復カタログ(10種)
// ============================================================
export const HEAL_CATALOG = [
  { id: 'heal_apple',    name: 'りんご',         shape: 'apple',   color: 0xff3344, amount: 15,
    statsText: ['HP +15'] },
  { id: 'heal_potion',   name: 'ポーション',     shape: 'potion',  color: 0x33ff66, amount: 20,
    statsText: ['HP +20'] },
  { id: 'heal_cookie',   name: 'クッキー',       shape: 'cookie',  color: 0xcc9966, amount: 12,
    statsText: ['HP +12'] },
  { id: 'heal_pizza',    name: 'ピザ',           shape: 'pizza',   color: 0xffaa44, amount: 30,
    statsText: ['HP +30'] },
  { id: 'heal_chicken',  name: 'チキン',         shape: 'chicken', color: 0xdd9955, amount: 35,
    statsText: ['HP +35'] },
  { id: 'heal_cake',     name: 'ケーキ',         shape: 'cake',    color: 0xffcce0, amount: 40,
    statsText: ['HP +40'] },
  { id: 'heal_elixir',   name: 'エリクサー',     shape: 'elixir',  color: 0x66ccff, amount: 50,
    statsText: ['HP +50'] },
  { id: 'heal_orb',      name: '回復オーブ',     shape: 'orb',     color: 0x55ff99, amount: 25,
    statsText: ['HP +25'] },
  { id: 'heal_full',     name: '完全回復',       shape: 'full',    color: 0xffffff, amount: 999, full: true,
    statsText: ['HP 完全回復'] },
  { id: 'heal_overheal', name: 'オーバーヒール', shape: 'overheal',color: 0xffff66, amount: 60, overheal: true,
    statsText: ['HP +60', '最大HP超過可能'] },
];

// ============================================================
// スコープカタログ(5種：FPSモード時のみズーム有効・永続)
// FOV は camera.fov = baseFov / zoom で近似(zoom=1 で通常, 大きいほど狭視野=高倍率)
// ============================================================
export const SCOPE_CATALOG = [
  { id: 'scope_tactical', name: 'タクティカルスコープ', color: 0x66ccff, zoom: 1.5, sensitivityMul: 0.85,
    statsText: ['ズーム倍率 x1.5', 'FPSモード時のみ有効', '持続 ∞（永続）'] },
  { id: 'scope_hunter',   name: 'ハンタースコープ',     color: 0x88ff77, zoom: 2.5, sensitivityMul: 0.70,
    statsText: ['ズーム倍率 x2.5', 'FPSモード時のみ有効', '持続 ∞（永続）'] },
  { id: 'scope_sniper',   name: 'スナイパースコープ',   color: 0xffcc44, zoom: 4.0, sensitivityMul: 0.55,
    statsText: ['ズーム倍率 x4.0', 'FPSモード時のみ有効', '持続 ∞（永続）'] },
  { id: 'scope_marksman', name: '長距離マークスマン',   color: 0xff6688, zoom: 6.0, sensitivityMul: 0.40,
    statsText: ['ズーム倍率 x6.0', 'FPSモード時のみ有効', '持続 ∞（永続）'] },
  { id: 'scope_eagle',    name: '伝説の鷹眼',           color: 0xff44ff, zoom: 10.0, sensitivityMul: 0.25,
    statsText: ['ズーム倍率 x10.0', 'FPSモード時のみ有効', '持続 ∞（永続）'] },
];

export function getShieldById(id) {
  return SHIELD_CATALOG.find((s) => s.id === id) || SHIELD_CATALOG[0];
}
export function getHealById(id) {
  return HEAL_CATALOG.find((h) => h.id === id) || HEAL_CATALOG[0];
}
export function getScopeById(id) {
  return SCOPE_CATALOG.find((s) => s.id === id) || SCOPE_CATALOG[0];
}

// ============================================================
// ワープスポット(従来通り)
// ============================================================
function createWarpVisual(color) {
  const group = new THREE.Group();
  const ringGeo = new THREE.TorusGeometry(WARP_RADIUS, 0.18, 12, 36);
  const ringMat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 1.6, roughness: 0.4, metalness: 0.2,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const discGeo = new THREE.CircleGeometry(WARP_RADIUS * 0.95, 36);
  const discMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.rotation.x = Math.PI / 2;
  group.add(disc);

  const pillarGeo = new THREE.CylinderGeometry(0.18, 0.18, 6, 12, 1, true);
  const pillarMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
  });
  const pillar = new THREE.Mesh(pillarGeo, pillarMat);
  group.add(pillar);

  return { group, ring, disc, pillar };
}

class WarpSpot {
  constructor(position, color = 0x66ccff) {
    const v = createWarpVisual(color);
    this.object = v.group;
    this.object.position.copy(position);
    this._ring = v.ring;
    this._disc = v.disc;
    this._pillar = v.pillar;
    this.color = color;
    this.radius = WARP_RADIUS;
    this.alive = true;
    this.kind = 'warp';
    this.partner = null;
    this._t = 0;
    this._cooldownByOwner = new Map();
  }
  setPartner(other) { this.partner = other; }
  update(dt) {
    this._t += dt;
    this._ring.rotation.z += dt * 0.6;
    this._disc.material.opacity = 0.18 + 0.12 * (0.5 + 0.5 * Math.sin(this._t * 2.5));
    this._pillar.material.opacity = 0.35 + 0.15 * (0.5 + 0.5 * Math.sin(this._t * 3.5 + 1.0));
    for (const [k, v] of this._cooldownByOwner) {
      const nv = v - dt;
      if (nv <= 0) this._cooldownByOwner.delete(k);
      else this._cooldownByOwner.set(k, nv);
    }
  }
  canTeleport(ownerId) { return !this._cooldownByOwner.has(ownerId); }
  setCooldown(ownerId, sec = 1.5) { this._cooldownByOwner.set(ownerId, sec); }
  // checkPickup から呼ばれる別名: 既定 1.5 秒のクールダウンを掛ける
  markUsed(ownerId, sec = 1.5) { this.setCooldown(ownerId, sec); }
}

// ============================================================
// パワーアップ(連射バフ系) — 既存仕様維持
// ============================================================
function createPowerVisual(color, coreColor) {
  const group = new THREE.Group();
  const coreGeo = new THREE.IcosahedronGeometry(0.55, 1);
  const coreMat = new THREE.MeshStandardMaterial({
    color: coreColor, emissive: coreColor, emissiveIntensity: 1.4, metalness: 0.3, roughness: 0.3,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  const haloGeo = new THREE.TorusGeometry(0.9, 0.06, 10, 28);
  const haloMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  return { group, core, halo };
}

class PowerUp {
  constructor(position, opts = {}) {
    const color = opts.color ?? 0xffcc55;
    const coreColor = opts.coreColor ?? 0xffd166;
    const v = createPowerVisual(color, coreColor);
    this.object = v.group;
    this.object.position.copy(position);
    this._core = v.core;
    this._halo = v.halo;
    this.mul = opts.mul ?? 1.8;
    this.duration = opts.duration ?? 10;
    this.radius = POWERUP_RADIUS;
    this.alive = true;
    this.kind = 'powerup';
    this._baseY = position.y;
    this._t = Math.random() * Math.PI * 2;
  }
  update(dt) {
    this._t += dt;
    this._core.rotation.y += dt * 1.2;
    this._core.rotation.x += dt * 0.6;
    this._halo.rotation.z += dt * 0.4;
    this.object.position.y = this._baseY + Math.sin(this._t * 2.0) * 0.15;
  }
}

// ============================================================
// シールドのビジュアル工場
// ============================================================
function _matStd(color, em = 0.6, metal = 0.5, rough = 0.4) {
  return new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: em, metalness: metal, roughness: rough,
  });
}

export function makeShieldVisual(cfg) {
  const g = new THREE.Group();
  const c = cfg.color;
  const sh = cfg.shape;
  if (sh === 'buckler') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 48), _matPBR(c, { em: 0.35, metal: 0.85, rough: 0.22, clearcoat: 0.9 }));
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 12, 48), _matPBR(0xddaa22, { em: 0.4, metal: 0.95, rough: 0.18 }));
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 24), _matPBR(0xddaa22, { em: 0.55, metal: 0.95, rough: 0.15, clearcoat: 1.0 }));
    boss.position.z = 0.06;
    g.add(boss);
  } else if (sh === 'kite') {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.7);
    shape.lineTo(0.5, 0.2);
    shape.lineTo(0.45, -0.3);
    shape.lineTo(0, -0.8);
    shape.lineTo(-0.45, -0.3);
    shape.lineTo(-0.5, 0.2);
    shape.lineTo(0, 0.7);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 4, curveSegments: 24 });
    geo.center();
    g.add(new THREE.Mesh(geo, _matPBR(c, { em: 0.3, metal: 0.75, rough: 0.28, clearcoat: 0.9 })));
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.04), _matPBR(0xffe066, { em: 0.55, metal: 0.95, rough: 0.18 }));
    cross.position.z = 0.1;
    g.add(cross);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.04), _matPBR(0xffe066, { em: 0.55, metal: 0.95, rough: 0.18 }));
    crossH.position.z = 0.1;
    crossH.position.y = 0.15;
    g.add(crossH);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), _matPBR(0xff3366, { em: 1.2, metal: 0.6, rough: 0.1, clearcoat: 1.0 }));
    gem.position.set(0, 0.15, 0.14);
    g.add(gem);
  } else if (sh === 'tower') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 0.14), _matPBR(c, { em: 0.25, metal: 0.78, rough: 0.3, clearcoat: 0.85 }));
    g.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.14, 48, 1, false, 0, Math.PI), _matPBR(c, { em: 0.25, metal: 0.78, rough: 0.3, clearcoat: 0.85 }));
    top.rotation.z = Math.PI / 2;
    top.position.y = 0.8;
    g.add(top);
    const trimFrame = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 12, 48, Math.PI), _matPBR(0xddaa22, { em: 0.45, metal: 0.95, rough: 0.18 }));
    trimFrame.position.y = 0.8;
    trimFrame.position.z = 0.075;
    trimFrame.rotation.z = Math.PI;
    g.add(trimFrame);
    const rivets = [-0.35, 0.35];
    for (const x of rivets) for (const y of [-0.6, 0.0, 0.6]) {
      const r = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 18), _matPBR(0xcccccc, { em: 0.3, metal: 0.95, rough: 0.18 }));
      r.position.set(x, y, 0.08);
      g.add(r);
    }
    const sigil = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), _matPBR(0xffd966, { em: 0.9, metal: 0.7, rough: 0.2 }));
    sigil.position.set(0, 0, 0.08);
    g.add(sigil);
  } else if (sh === 'aegis') {
    const body = new THREE.Mesh(new THREE.CircleGeometry(0.7, 6), _matPBR(c, { em: 0.7, metal: 0.9, rough: 0.18, clearcoat: 0.95 }));
    body.rotation.z = Math.PI / 2;
    g.add(body);
    const back = body.clone();
    back.position.z = -0.06;
    g.add(back);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.03, 12, 6), _matPBR(0xffd700, { em: 0.6, metal: 0.95, rough: 0.18 }));
    rim.rotation.z = Math.PI / 2;
    g.add(rim);
    const gorgon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 48, 36), _matPBR(0x33ff66, { em: 0.85, metal: 0.4, rough: 0.18, clearcoat: 1.0 }));
    gorgon.position.z = 0.06;
    g.add(gorgon);
    for (let i = 0; i < 6; i++) {
      const ray = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.04), _matPBR(0xffffaa, { em: 1.1, metal: 0.7, rough: 0.18 }));
      ray.position.z = 0.05;
      ray.rotation.z = (Math.PI / 3) * i;
      g.add(ray);
    }
  } else if (sh === 'spike') {
    const body = new THREE.Mesh(new THREE.CircleGeometry(0.7, 48), _matPBR(c, { em: 0.25, metal: 0.55, rough: 0.45, clearcoat: 0.5 }));
    g.add(body);
    const back = body.clone();
    back.position.z = -0.05;
    g.add(back);
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 24), _matPBR(0x442211, { em: 0.15, metal: 0.7, rough: 0.35, clearcoat: 0.4 }));
      const ang = (Math.PI / 4) * i;
      sp.position.set(Math.cos(ang) * 0.55, Math.sin(ang) * 0.55, 0.1);
      sp.rotation.z = ang - Math.PI / 2;
      g.add(sp);
    }
    const center = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 32), _matPBR(0x553322, { em: 0.2, metal: 0.75, rough: 0.3, clearcoat: 0.5 }));
    center.position.z = 0.2;
    center.rotation.x = -Math.PI / 2;
    g.add(center);
    const ringDeco = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.022, 12, 48), _matPBR(0x886644, { em: 0.3, metal: 0.85, rough: 0.25 }));
    ringDeco.position.z = 0.04;
    g.add(ringDeco);
  } else if (sh === 'crystal') {
    const bodyMat = _matPBR(c, { em: 1.2, metal: 0.05, rough: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.02 });
    bodyMat.transparent = true;
    bodyMat.opacity = 0.78;
    bodyMat.transmission = 0.55;
    bodyMat.ior = 1.5;
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 1), bodyMat);
    g.add(body);
    for (let i = 0; i < 4; i++) {
      const shardMat = _matPBR(c, { em: 1.3, metal: 0.1, rough: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.03 });
      shardMat.transparent = true;
      shardMat.opacity = 0.85;
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.18, 0), shardMat);
      const ang = (Math.PI / 2) * i;
      shard.position.set(Math.cos(ang) * 0.55, Math.sin(ang) * 0.55, 0.0);
      shard.rotation.set(ang, ang * 0.5, 0);
      g.add(shard);
    }
    // 内部の輝き
    const innerGlow = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 18), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(innerGlow);
  } else if (sh === 'runic') {
    const body = new THREE.Mesh(new THREE.CircleGeometry(0.7, 48), _matPBR(c, { em: 0.55, metal: 0.65, rough: 0.3, clearcoat: 0.8 }));
    g.add(body);
    const back = body.clone();
    back.position.z = -0.05;
    g.add(back);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 16, 64), _matPBR(0xffffaa, { em: 1.4, metal: 0.85, rough: 0.18 }));
    ring.position.z = 0.05;
    g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 16, 56), _matPBR(0xffd966, { em: 1.3, metal: 0.8, rough: 0.18 }));
    ring2.position.z = 0.07;
    g.add(ring2);
    for (let i = 0; i < 5; i++) {
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.02), _matPBR(0xffeecc, { em: 1.5, metal: 0.7, rough: 0.2 }));
      const ang = (Math.PI * 2 / 5) * i;
      rune.position.set(Math.cos(ang) * 0.46, Math.sin(ang) * 0.46, 0.09);
      rune.rotation.z = ang;
      g.add(rune);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 18), _matPBR(0xffffaa, { em: 1.8, metal: 0.4, rough: 0.15, clearcoat: 1.0 }));
    core.position.z = 0.1;
    g.add(core);
  } else if (sh === 'dragon') {
    const body = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), _matPBR(c, { em: 0.45, metal: 0.8, rough: 0.28, clearcoat: 0.85 }));
    g.add(body);
    const back = body.clone();
    back.position.z = -0.06;
    g.add(back);
    for (let i = 0; i < 6; i++) {
      const scale = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 24), _matPBR(0x880022, { em: 0.4, metal: 0.7, rough: 0.3, clearcoat: 0.7 }));
      const ang = (Math.PI / 3) * i + Math.PI / 6;
      scale.position.set(Math.cos(ang) * 0.45, Math.sin(ang) * 0.45, 0.08);
      scale.rotation.z = ang - Math.PI / 2;
      g.add(scale);
    }
    // 鱗のもう一段
    for (let i = 0; i < 8; i++) {
      const sc2 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 16), _matPBR(0x660011, { em: 0.5, metal: 0.7, rough: 0.3 }));
      const ang = (Math.PI / 4) * i;
      sc2.position.set(Math.cos(ang) * 0.62, Math.sin(ang) * 0.62, 0.06);
      sc2.rotation.z = ang - Math.PI / 2;
      g.add(sc2);
    }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 48, 36), _matPBR(0xffaa00, { em: 1.6, metal: 0.3, rough: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.03 }));
    eye.position.z = 0.12;
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 18), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    pupil.position.z = 0.22;
    g.add(pupil);
  } else if (sh === 'holy') {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.75);
    shape.bezierCurveTo(0.7, 0.5, 0.75, -0.2, 0, -0.8);
    shape.bezierCurveTo(-0.75, -0.2, -0.7, 0.5, 0, 0.75);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05, bevelSegments: 6, curveSegments: 32 });
    geo.center();
    g.add(new THREE.Mesh(geo, _matPBR(c, { em: 1.3, metal: 0.92, rough: 0.16, clearcoat: 1.0, clearcoatRoughness: 0.04 })));
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.06), _matPBR(0xffd700, { em: 1.6, metal: 0.98, rough: 0.12, clearcoat: 1.0 }));
    crossV.position.z = 0.1;
    g.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.06), _matPBR(0xffd700, { em: 1.6, metal: 0.98, rough: 0.12, clearcoat: 1.0 }));
    crossH.position.set(0, 0.18, 0.1);
    g.add(crossH);
    // 後光
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 16, 64), _matPBR(0xfff8c0, { em: 1.6, metal: 0.7, rough: 0.2 }));
    halo.position.z = 0.18;
    g.add(halo);
  } else if (sh === 'void') {
    const body = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), _matPBR(c, { em: 1.0, metal: 0.3, rough: 0.5, clearcoat: 0.7 }));
    g.add(body);
    const back = body.clone();
    back.position.z = -0.06;
    g.add(back);
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 16, 64), _matPBR(0x6600cc, { em: 1.4, metal: 0.6, rough: 0.18, clearcoat: 0.9 }));
    ring1.position.z = 0.06;
    g.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 16, 56), _matPBR(0xaa44ff, { em: 1.6, metal: 0.5, rough: 0.18, clearcoat: 0.9 }));
    ring2.position.z = 0.08;
    g.add(ring2);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 48, 36), _matPBR(0xff00ff, { em: 2.0, metal: 0.2, rough: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.04 }));
    core.position.z = 0.12;
    g.add(core);
    // 内部の光
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 18), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    inner.position.z = 0.18;
    g.add(inner);
  } else {
    const body = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), _matStd(c));
    g.add(body);
  }
  return g;
}

// ============================================================
// 回復アイテムのビジュアル工場
// ============================================================
export function makeHealVisual(cfg) {
  const g = new THREE.Group();
  const c = cfg.color;
  const sh = cfg.shape;
  if (sh === 'apple') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 48, 36), _matPBR(c, { em: 0.18, metal: 0.05, rough: 0.35, clearcoat: 0.85, clearcoatRoughness: 0.08, sheen: 0.5 }));
    body.scale.set(1.0, 0.95, 1.0);
    g.add(body);
    const dent = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 18), new THREE.MeshStandardMaterial({ color: 0x331100, roughness: 0.9, metalness: 0.0 }));
    dent.position.y = 0.35;
    g.add(dent);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x442200, roughness: 0.95 }));
    stem.position.y = 0.5;
    g.add(stem);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 16), _matPBR(0x33aa33, { em: 0.2, metal: 0.1, rough: 0.45, sheen: 0.6 }));
    leaf.position.set(0.08, 0.5, 0);
    leaf.rotation.z = -0.6;
    g.add(leaf);
    // ハイライト点(つや)
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending }));
    shine.position.set(-0.16, 0.18, 0.3);
    g.add(shine);
  } else if (sh === 'potion') {
    const bottleMat = _matPBR(c, { em: 0.5, metal: 0.0, rough: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.02 });
    bottleMat.transparent = true;
    bottleMat.opacity = 0.82;
    bottleMat.transmission = 0.6;
    bottleMat.ior = 1.45;
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.55, 32), bottleMat);
    g.add(bottle);
    const bottomMat = bottleMat.clone();
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bottomMat);
    bottom.position.y = -0.27;
    g.add(bottom);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.22, 24), _matPBR(0xbbbbcc, { em: 0.1, metal: 0.95, rough: 0.18 }));
    neck.position.y = 0.38;
    g.add(neck);
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x884422, roughness: 0.9 }));
    cork.position.y = 0.55;
    g.add(cork);
    // 液体内のキラキラ
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending }));
    bubble.position.set(0.06, 0.05, 0.15);
    g.add(bubble);
  } else if (sh === 'cookie') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 48), _matPBR(c, { em: 0.08, metal: 0.05, rough: 0.7, clearcoat: 0.35, sheen: 0.5 }));
    g.add(body);
    // クッキーの凹凸(リアル感)
    for (let i = 0; i < 12; i++) {
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.03 + Math.random() * 0.02, 12, 8), _matPBR(c, { em: 0.05, metal: 0.05, rough: 0.85 }));
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.32;
      bump.position.set(Math.cos(ang) * r, 0.065, Math.sin(ang) * r);
      g.add(bump);
    }
    for (let i = 0; i < 5; i++) {
      const chip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 18), _matPBR(0x331100, { em: 0.03, metal: 0.05, rough: 0.65, clearcoat: 0.5 }));
      const ang = (Math.PI * 2 / 5) * i;
      chip.position.set(Math.cos(ang) * 0.2, 0.075, Math.sin(ang) * 0.2);
      g.add(chip);
    }
  } else if (sh === 'pizza') {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.absarc(0, 0, 0.55, 0, Math.PI / 2.5, false);
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 4, curveSegments: 24 });
    const slice = new THREE.Mesh(geo, _matPBR(c, { em: 0.15, metal: 0.05, rough: 0.6, clearcoat: 0.4, sheen: 0.6 }));
    slice.rotation.x = -Math.PI / 2;
    g.add(slice);
    // チーズの溶け
    const cheese = new THREE.Mesh(new THREE.CircleGeometry(0.48, 32, Math.PI / 6, Math.PI / 2.5 - Math.PI / 6), _matPBR(0xffee99, { em: 0.2, metal: 0.05, rough: 0.45, clearcoat: 0.8, sheen: 0.7 }));
    cheese.rotation.x = -Math.PI / 2;
    cheese.position.y = 0.085;
    g.add(cheese);
    for (let i = 0; i < 3; i++) {
      const topping = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 18), _matPBR(0xcc2222, { em: 0.4, metal: 0.05, rough: 0.4, clearcoat: 0.9 }));
      topping.scale.y = 0.5;
      topping.position.set(0.15 + i * 0.1, 0.09, 0.1 + i * 0.08);
      g.add(topping);
    }
    // バジル風緑の点
    for (let i = 0; i < 4; i++) {
      const basil = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), _matPBR(0x33aa33, { em: 0.3, metal: 0.05, rough: 0.4, sheen: 0.5 }));
      basil.scale.y = 0.4;
      basil.position.set(0.1 + Math.random() * 0.3, 0.09, 0.05 + Math.random() * 0.2);
      g.add(basil);
    }
  } else if (sh === 'chicken') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 48, 36), _matPBR(c, { em: 0.2, metal: 0.05, rough: 0.55, clearcoat: 0.7, sheen: 0.6, sheenColor: 0xffcc88 }));
    body.scale.set(1.2, 0.85, 1.0);
    g.add(body);
    // 焼き色のグラデ点
    for (let i = 0; i < 6; i++) {
      const burn = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.02, 12, 8), _matPBR(0x664422, { em: 0.1, metal: 0.05, rough: 0.65, clearcoat: 0.5 }));
      burn.position.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.2 + 0.1, (Math.random() - 0.5) * 0.4);
      g.add(burn);
    }
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 24), _matPBR(0xeeddbb, { em: 0.1, metal: 0.1, rough: 0.5, clearcoat: 0.6, sheen: 0.4 }));
    bone.rotation.z = Math.PI / 3;
    bone.position.set(0.2, 0.2, 0);
    g.add(bone);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 24), _matPBR(0xeeddbb, { em: 0.1, metal: 0.1, rough: 0.5, clearcoat: 0.6, sheen: 0.4 }));
    knob.position.set(0.32, 0.32, 0);
    g.add(knob);
    const knob2 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 18), _matPBR(0xeeddbb, { em: 0.1, metal: 0.1, rough: 0.5, clearcoat: 0.6, sheen: 0.4 }));
    knob2.position.set(0.08, 0.08, 0);
    g.add(knob2);
  } else if (sh === 'cake') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.3, 48), _matPBR(c, { em: 0.18, metal: 0.05, rough: 0.55, clearcoat: 0.5, sheen: 0.55 }));
    g.add(base);
    // スポンジの段
    const layer = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 48), _matPBR(0xffeecc, { em: 0.1, metal: 0.05, rough: 0.6, sheen: 0.5 }));
    layer.position.y = 0.0;
    g.add(layer);
    const cream = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.5, 0.08, 48), _matPBR(0xffffff, { em: 0.35, metal: 0.05, rough: 0.25, clearcoat: 0.9, sheen: 0.85 }));
    cream.position.y = 0.19;
    g.add(cream);
    // ホイップの飾り
    for (let i = 0; i < 6; i++) {
      const whip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 16), _matPBR(0xffffff, { em: 0.35, metal: 0.05, rough: 0.25, clearcoat: 0.9, sheen: 0.85 }));
      const ang = (Math.PI * 2 / 6) * i;
      whip.position.set(Math.cos(ang) * 0.42, 0.27, Math.sin(ang) * 0.42);
      g.add(whip);
    }
    for (let i = 0; i < 6; i++) {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 24), _matPBR(0xff3366, { em: 0.55, metal: 0.1, rough: 0.18, clearcoat: 1.0, sheen: 0.4 }));
      const ang = (Math.PI * 2 / 6) * i;
      berry.position.set(Math.cos(ang) * 0.35, 0.3, Math.sin(ang) * 0.35);
      g.add(berry);
    }
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 16), _matPBR(0xffeebb, { em: 0.15, metal: 0.05, rough: 0.55, sheen: 0.5 }));
    candle.position.y = 0.34;
    g.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 18), _matPBR(0xffaa00, { em: 2.0, metal: 0.0, rough: 0.4, clearcoat: 1.0 }));
    flame.scale.y = 1.6;
    flame.position.y = 0.48;
    g.add(flame);
    // 炎の外側のオーラ
    const flameAura = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    flameAura.scale.y = 1.8;
    flameAura.position.y = 0.48;
    g.add(flameAura);
  } else if (sh === 'elixir') {
    const bottleMat = _matPBR(c, { em: 1.0, metal: 0.05, rough: 0.06, clearcoat: 1.0, clearcoatRoughness: 0.02 });
    bottleMat.transparent = true;
    bottleMat.opacity = 0.85;
    bottleMat.transmission = 0.5;
    bottleMat.ior = 1.5;
    const bottle = new THREE.Mesh(new THREE.SphereGeometry(0.32, 48, 36), bottleMat);
    g.add(bottle);
    // 内部の輝き
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 18), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(inner);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.3, 32), _matPBR(0xccccdd, { em: 0.2, metal: 0.95, rough: 0.18, clearcoat: 0.9 }));
    neck.position.y = 0.3;
    g.add(neck);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 16, 48), _matPBR(0xffd700, { em: 1.4, metal: 0.95, rough: 0.15, clearcoat: 1.0 }));
    ring.position.y = 0.4;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), _matPBR(0xffffff, { em: 1.9, metal: 0.3, rough: 0.12, clearcoat: 1.0 }));
    star.position.y = 0.52;
    g.add(star);
    // 星の周りの微光
    const starHalo = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    starHalo.position.y = 0.52;
    g.add(starHalo);
  } else if (sh === 'orb') {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 48, 32), _matPBR(c, { em: 1.6, metal: 0.1, rough: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.04 }));
    g.add(core);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(inner);
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 16, 64), _matPBR(c, { em: 1.2, metal: 0.6, rough: 0.18 }));
    ring1.rotation.x = Math.PI / 2;
    g.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 16, 64), _matPBR(c, { em: 1.2, metal: 0.6, rough: 0.18 }));
    ring2.rotation.z = Math.PI / 2;
    g.add(ring2);
  } else if (sh === 'full') {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 64, 48), _matPBR(c, { em: 2.2, metal: 0.05, rough: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.02 }));
    g.add(core);
    for (let i = 0; i < 8; i++) {
      const ray = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.95), _matPBR(0xffffff, { em: 1.8, metal: 0.4, rough: 0.2 }));
      ray.rotation.y = (Math.PI / 4) * i;
      g.add(ray);
    }
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 24), _matPBR(0xff3366, { em: 2.2, metal: 0.3, rough: 0.2, clearcoat: 1.0 }));
    heart.position.z = 0.05;
    g.add(heart);
  } else if (sh === 'overheal') {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 2), _matPBR(c, { em: 1.5, metal: 0.45, rough: 0.18, clearcoat: 0.9 }));
    g.add(core);
    const aura = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: 0.18,
    }));
    g.add(aura);
    const plus = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), _matStd(0xffffff, 1.8));
    g.add(plus);
    const plusH = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.08), _matStd(0xffffff, 1.8));
    g.add(plusH);
  } else {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), _matStd(c, 0.8));
    g.add(core);
  }
  return g;
}

// ============================================================
// 高品質マテリアルヘルパー(PBR系)
// ============================================================
function _matPBR(color, opts = {}) {
  // PhysicalMaterial で clearcoat / sheen を入れて高級感を出す
  return new THREE.MeshPhysicalMaterial({
    color: opts.color ?? color,
    emissive: opts.emissive ?? color,
    emissiveIntensity: opts.em ?? 0.45,
    metalness: opts.metal ?? 0.6,
    roughness: opts.rough ?? 0.3,
    clearcoat: opts.clearcoat ?? 0.6,
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.15,
    reflectivity: opts.reflectivity ?? 0.5,
    sheen: opts.sheen ?? 0.4,
    sheenColor: new THREE.Color(opts.sheenColor ?? 0xffffff),
    sheenRoughness: opts.sheenRoughness ?? 0.35,
  });
}

// 後光スプライト(疑似ブルーム) — CanvasTextureで放射状グラデを生成
const _haloTexCache = new Map();
function _getHaloTexture(rgbHex) {
  const key = rgbHex >>> 0;
  if (_haloTexCache.has(key)) return _haloTexCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const cx = 64, cy = 64;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 64);
  const r = (rgbHex >> 16) & 0xff;
  const g = (rgbHex >> 8) & 0xff;
  const b = rgbHex & 0xff;
  grad.addColorStop(0.0, `rgba(${r},${g},${b},0.95)`);
  grad.addColorStop(0.3, `rgba(${r},${g},${b},0.55)`);
  grad.addColorStop(0.7, `rgba(${r},${g},${b},0.12)`);
  grad.addColorStop(1.0, `rgba(${r},${g},${b},0.0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  _haloTexCache.set(key, tex);
  return tex;
}
function _makeHaloSprite(color, size = 2.4) {
  const mat = new THREE.SpriteMaterial({
    map: _getHaloTexture(color),
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.85,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(size, size, 1);
  return sp;
}

// ============================================================
// 武器ピックアップ(武器のミニ模型 + 光る台座)
// ============================================================
function _makePedestal(color) {
  const g = new THREE.Group();
  // 石造の下段(八角)
  const stone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.92, 0.18, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2638, roughness: 0.85, metalness: 0.2 })
  );
  stone.position.y = 0.09;
  g.add(stone);
  // 中段(金属トリム)
  const trim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.68, 0.06, 24),
    _matPBR(0xb8a060, { em: 0.25, metal: 0.95, rough: 0.2, clearcoat: 0.85 })
  );
  trim.position.y = 0.21;
  g.add(trim);
  // 上面(光るプレート)
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.04, 32),
    _matPBR(color, { em: 0.9, metal: 0.7, rough: 0.18, clearcoat: 1.0, clearcoatRoughness: 0.05 })
  );
  plate.position.y = 0.26;
  g.add(plate);
  // 光る輪
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.6, 0.045, 16, 64),
    _matPBR(color, { em: 1.6, metal: 0.4, rough: 0.2 })
  );
  ring.position.y = 0.28;
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  // 光柱
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.55, 1.6, 24, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  beam.position.y = 1.05;
  g.add(beam);
  return { group: g, ring, beam };
}

class WeaponPickup {
  constructor(position, weaponCfg) {
    this.cfg = weaponCfg;
    this.kind = 'weapon';
    this.alive = true;
    this.radius = WEAPON_RADIUS;

    const root = new THREE.Group();
    const ped = _makePedestal(weaponCfg.color);
    root.add(ped.group);
    this._ring = ped.ring;
    this._beam = ped.beam;

    const model = weaponCfg.factory ? weaponCfg.factory() : new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.2, 0.1),
      _matStd(weaponCfg.color, 0.6)
    );
    model.position.y = 1.05;
    model.rotation.y = Math.PI / 6;
    root.add(model);
    this._model = model;

    // 後光ハロー
    const halo = _makeHaloSprite(weaponCfg.color, 2.8);
    halo.position.y = 1.05;
    root.add(halo);
    this._halo = halo;

    this.object = root;
    this.object.position.copy(position);
    this._baseY = position.y;
    this._t = Math.random() * Math.PI * 2;
  }
  update(dt) {
    this._t += dt;
    this._model.rotation.y += dt * 1.2;
    this._model.position.y = 1.05 + Math.sin(this._t * 2.0) * 0.1;
    this._ring.material.emissiveIntensity = 1.2 + 0.6 * (0.5 + 0.5 * Math.sin(this._t * 3.0));
    if (this._beam) this._beam.material.opacity = 0.14 + 0.08 * (0.5 + 0.5 * Math.sin(this._t * 1.8));
    if (this._halo) {
      const s = 2.6 + 0.25 * Math.sin(this._t * 2.4);
      this._halo.scale.set(s, s, 1);
      this._halo.material.opacity = 0.7 + 0.2 * (0.5 + 0.5 * Math.sin(this._t * 2.0));
    }
  }
}

// ============================================================
// シールドピックアップ
// ============================================================
class ShieldPickup {
  constructor(position, shieldCfg) {
    this.cfg = shieldCfg;
    this.kind = 'shield';
    this.alive = true;
    this.radius = SHIELD_RADIUS;

    const root = new THREE.Group();
    const ped = _makePedestal(shieldCfg.color);
    root.add(ped.group);
    this._ring = ped.ring;
    this._beam = ped.beam;

    const model = makeShieldVisual(shieldCfg);
    model.position.y = 1.05;
    root.add(model);
    this._model = model;

    const halo = _makeHaloSprite(shieldCfg.color, 2.8);
    halo.position.y = 1.05;
    root.add(halo);
    this._halo = halo;

    this.object = root;
    this.object.position.copy(position);
    this._t = Math.random() * Math.PI * 2;
  }
  update(dt) {
    this._t += dt;
    this._model.rotation.y += dt * 1.0;
    this._model.position.y = 1.05 + Math.sin(this._t * 2.0) * 0.1;
    this._ring.material.emissiveIntensity = 1.2 + 0.6 * (0.5 + 0.5 * Math.sin(this._t * 3.0));
    if (this._beam) this._beam.material.opacity = 0.14 + 0.08 * (0.5 + 0.5 * Math.sin(this._t * 1.8));
    if (this._halo) {
      const s = 2.6 + 0.25 * Math.sin(this._t * 2.4 + 1.2);
      this._halo.scale.set(s, s, 1);
      this._halo.material.opacity = 0.7 + 0.2 * (0.5 + 0.5 * Math.sin(this._t * 2.0));
    }
  }
}

// ============================================================
// スコープの見た目(円筒＋レンズ)
// ============================================================
function makeScopeVisual(cfg) {
  const group = new THREE.Group();
  const c = cfg.color ?? 0x66ccff;
  // 本体(黒い金属円筒)
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.9, 20),
    new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.5, metalness: 0.7, emissive: 0x000000 })
  );
  body.rotation.z = Math.PI / 2; // 水平に寝かせる
  group.add(body);
  // レンズ(前面) — カタログ色で光らせる
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 24),
    new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.8, roughness: 0.2 })
  );
  lens.position.set(0.46, 0, 0);
  lens.rotation.y = Math.PI / 2;
  group.add(lens);
  // レンズ(後面) — うっすら
  const lensBack = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 20),
    new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.5 })
  );
  lensBack.position.set(-0.46, 0, 0);
  lensBack.rotation.y = -Math.PI / 2;
  group.add(lensBack);
  // 上部のダイヤル
  const dial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.14, 12),
    _matStd(0x444444, 0.2, 0.6, 0.4)
  );
  dial.position.set(0, 0.24, 0);
  group.add(dial);
  // 支柱(2本)
  for (let i = 0; i < 2; i++) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.28, 0.08),
      _matStd(0x222222, 0.1, 0.5, 0.5)
    );
    post.position.set(-0.2 + i * 0.4, -0.28, 0);
    group.add(post);
  }
  return group;
}

// ============================================================
// スコープピックアップ
// ============================================================
class ScopePickup {
  constructor(position, scopeCfg) {
    this.cfg = scopeCfg;
    this.kind = 'scope';
    this.alive = true;
    this.radius = SCOPE_RADIUS;

    const root = new THREE.Group();
    const ped = _makePedestal(scopeCfg.color);
    root.add(ped.group);
    this._ring = ped.ring;
    this._beam = ped.beam;

    const model = makeScopeVisual(scopeCfg);
    model.position.y = 1.05;
    root.add(model);
    this._model = model;

    const halo = _makeHaloSprite(scopeCfg.color, 2.4);
    halo.position.y = 1.05;
    root.add(halo);
    this._halo = halo;

    this.object = root;
    this.object.position.copy(position);
    this._t = Math.random() * Math.PI * 2;
  }
  update(dt) {
    this._t += dt;
    this._model.rotation.y += dt * 1.6;
    this._model.position.y = 1.05 + Math.sin(this._t * 2.2) * 0.08;
    this._ring.material.emissiveIntensity = 1.2 + 0.6 * (0.5 + 0.5 * Math.sin(this._t * 3.0));
    if (this._beam) this._beam.material.opacity = 0.14 + 0.08 * (0.5 + 0.5 * Math.sin(this._t * 1.8));
    if (this._halo) {
      const s = 2.2 + 0.22 * Math.sin(this._t * 2.6);
      this._halo.scale.set(s, s, 1);
      this._halo.material.opacity = 0.65 + 0.2 * (0.5 + 0.5 * Math.sin(this._t * 2.0));
    }
  }
}

// ============================================================
// 回復ピックアップ
// ============================================================
class HealPickup {
  constructor(position, healCfg) {
    this.cfg = healCfg;
    this.kind = 'heal';
    this.alive = true;
    this.radius = HEAL_RADIUS;
    this.amount = healCfg.amount ?? 20;
    this.full = !!healCfg.full;
    this.overheal = !!healCfg.overheal;

    const root = new THREE.Group();
    const model = makeHealVisual(healCfg);
    root.add(model);
    this._model = model;

    // 後光ハロー(回復系は柔らかい光で包む)
    const halo = _makeHaloSprite(healCfg.color, 1.8);
    root.add(halo);
    this._halo = halo;

    this.object = root;
    this.object.position.copy(position);
    this._baseY = position.y;
    this._t = Math.random() * Math.PI * 2;
  }
  update(dt) {
    this._t += dt;
    this._model.rotation.y += dt * 1.4;
    this.object.position.y = this._baseY + Math.sin(this._t * 2.4) * 0.18;
    if (this._halo) {
      const s = 1.7 + 0.18 * Math.sin(this._t * 2.6);
      this._halo.scale.set(s, s, 1);
      this._halo.material.opacity = 0.55 + 0.2 * (0.5 + 0.5 * Math.sin(this._t * 1.9));
    }
  }
}

// ============================================================
// 乗り物の地上スポーン(浮かせない、地面に置く)
// ============================================================
class VehicleGroundSpawn {
  constructor(position, vehicleCfg) {
    this.cfg = vehicleCfg;
    this.kind = 'vehicle_ground';
    this.alive = true;
    this.radius = VEHICLE_RADIUS;
    this.respawn = vehicleCfg.respawn ?? 12;
    this._respawnTimer = 0;
    this._baseY = position.y; // 地面の高さ
    this._spawnPos = position.clone();
    this._legendary = !!vehicleCfg.legendary;
    // 伝説は本来のオーラ色、それ以外は識別しやすい青
    const auraColor = this._legendary
      ? (vehicleCfg.legendaryColor || vehicleCfg.color || 0xffffff)
      : 0x66baff;

    const root = new THREE.Group();
    const model = vehicleCfg.factory ? vehicleCfg.factory() : new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.6, 2.4),
      _matStd(vehicleCfg.color || 0xaaaaaa, 0.4)
    );
    root.add(model);
    this._model = model;

    // 目立たせるための地面マーカー(光る輪)
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.7, 32),
      new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.05;
    root.add(marker);
    this._marker = marker;

    // 伝説アイテムには特別なオーラを追加
    if (this._legendary) {
      // 外側の巨大な光輪
      const outerRing = new THREE.Mesh(
        new THREE.RingGeometry(2.2, 2.8, 48),
        new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      outerRing.rotation.x = -Math.PI / 2;
      outerRing.position.y = 0.04;
      root.add(outerRing);
      this._outerRing = outerRing;

      // 中央の発光ディスク
      const glowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(1.3, 32),
        new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      glowDisc.rotation.x = -Math.PI / 2;
      glowDisc.position.y = 0.03;
      root.add(glowDisc);
      this._glowDisc = glowDisc;

      // 上空に伸びる光柱
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.9, 6, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      pillar.position.y = 3.0;
      root.add(pillar);
      this._pillar = pillar;

      // 周囲を漂うパーティクル粒
      const sparkles = [];
      const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), sparkleMat);
        const ang = (i / 6) * Math.PI * 2;
        sp.userData = { ang, radius: 1.6 + Math.random() * 0.4, yBase: 0.6 + Math.random() * 0.5, ySpeed: 1.2 + Math.random() * 0.8 };
        root.add(sp);
        sparkles.push(sp);
      }
      this._sparkles = sparkles;
    } else {
      // 伝説以外の乗り物：上空から降り注ぐ「濃い青の光柱」のみ（伝説と同じ形状）
      const blueColor = 0x0033ff; // より濃い青
      const bluePillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.9, 6, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: blueColor, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      bluePillar.position.y = 3.0;
      root.add(bluePillar);
      this._bluePillar = bluePillar;

      // 地面マーカーも濃い青に統一
      this._marker.material.color.setHex(blueColor);
    }

    this.object = root;
    this.object.position.copy(position);
    this._t = Math.random() * Math.PI * 2;
  }
  update(dt) {
    this._t += dt;
    if (!this.alive) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) {
        this.alive = true;
        this.object.position.copy(this._spawnPos);
        this.object.visible = true;
      }
      return;
    }
    // ふわっと小さく揺らす(完全に固定じゃなくアイドルを入れる)
    this._model.rotation.y += dt * 0.3;
    this._model.position.y = Math.sin(this._t * 1.5) * 0.05;
    this._marker.material.opacity = 0.4 + 0.25 * (0.5 + 0.5 * Math.sin(this._t * 2.4));
    // 非伝説の青い光柱のみ
    if (this._bluePillar) {
      this._bluePillar.rotation.y += dt * 0.6;
      this._bluePillar.material.opacity = 0.55 + 0.2 * (0.5 + 0.5 * Math.sin(this._t * 1.5));
    }
    // 伝説アイテムのオーラ演出
    if (this._legendary) {
      if (this._outerRing) {
        this._outerRing.rotation.z += dt * 0.8;
        this._outerRing.material.opacity = 0.35 + 0.2 * (0.5 + 0.5 * Math.sin(this._t * 1.8));
      }
      if (this._glowDisc) {
        const s = 1 + 0.08 * Math.sin(this._t * 2.0);
        this._glowDisc.scale.set(s, s, s);
      }
      if (this._pillar) {
        this._pillar.rotation.y += dt * 0.6;
        this._pillar.material.opacity = 0.28 + 0.12 * (0.5 + 0.5 * Math.sin(this._t * 1.4));
      }
      if (this._sparkles) {
        for (const sp of this._sparkles) {
          const ud = sp.userData;
          ud.ang += dt * 1.2;
          sp.position.x = Math.cos(ud.ang) * ud.radius;
          sp.position.z = Math.sin(ud.ang) * ud.radius;
          sp.position.y = ud.yBase + Math.sin(this._t * ud.ySpeed) * 0.3;
        }
      }
    }
  }
  consume() {
    this.alive = false;
    this.object.visible = false;
    this._respawnTimer = this.respawn;
  }
}

// ============================================================
// ItemManager
// ============================================================
class ItemManager {
  constructor(scene) {
    this.scene = scene;
    this.items = []; // 全ピックアップ(消滅ありき)
    this.spawns = []; // 地上スポーン(消えても respawn する)
  }

  addWarpPair(posA, posB, color = 0x66ccff) {
    const a = new WarpSpot(posA, color);
    const b = new WarpSpot(posB, color);
    a.setPartner(b); b.setPartner(a);
    this.scene.add(a.object);
    this.scene.add(b.object);
    this.items.push(a, b);
    return [a, b];
  }

  addPowerUp(position, opts = {}) {
    const p = new PowerUp(position, opts);
    this.scene.add(p.object);
    this.items.push(p);
    return p;
  }

  addHeal(position, healOrId) {
    const cfg = (typeof healOrId === 'string') ? getHealById(healOrId) : healOrId;
    if (!cfg) return null;
    const h = new HealPickup(position, cfg);
    this.scene.add(h.object);
    this.items.push(h);
    return h;
  }

  addWeapon(position, weaponOrId) {
    const cfg = (typeof weaponOrId === 'string') ? getWeaponById(weaponOrId) : weaponOrId;
    if (!cfg) return null;
    const w = new WeaponPickup(position, cfg);
    this.scene.add(w.object);
    this.items.push(w);
    return w;
  }

  addShield(position, shieldOrId) {
    const cfg = (typeof shieldOrId === 'string') ? getShieldById(shieldOrId) : shieldOrId;
    if (!cfg) return null;
    const s = new ShieldPickup(position, cfg);
    this.scene.add(s.object);
    this.items.push(s);
    return s;
  }

  addScope(position, scopeOrId) {
    const cfg = (typeof scopeOrId === 'string') ? getScopeById(scopeOrId) : scopeOrId;
    if (!cfg) return null;
    const s = new ScopePickup(position, cfg);
    this.scene.add(s.object);
    this.items.push(s);
    return s;
  }

  // 地面に置く乗り物(復活あり)
  addVehicleGround(position, vehicleOrId) {
    const cfg = (typeof vehicleOrId === 'string') ? getVehicleById(vehicleOrId) : vehicleOrId;
    if (!cfg) return null;
    const v = new VehicleGroundSpawn(position, cfg);
    this.scene.add(v.object);
    this.spawns.push(v);
    return v;
  }

  // --- 旧API互換(古い呼び出しが残っていても落ちないように) ---
  addHealOrb(position, amount = 25) {
    const cfg = { id: 'heal_orb', name: '回復オーブ', shape: 'orb', color: 0x55ff99, amount };
    const h = new HealPickup(position, cfg);
    this.scene.add(h.object);
    this.items.push(h);
    return h;
  }
  addWeaponPickup(position, opts = {}) {
    // 旧API: 任意の武器1個を置く(指定なしならランダム)
    const all = getAllWeapons();
    const cfg = opts.weaponId ? getWeaponById(opts.weaponId) : all[Math.floor(Math.random() * all.length)];
    return this.addWeapon(position, cfg.id);
  }
  addVehiclePickup(position, opts = {}) {
    // 旧API: 地面スポーンへ変更(浮遊BOXはやめる)
    const ids = VEHICLES.map((v) => v.id);
    const id = opts.vehicleId || ids[Math.floor(Math.random() * ids.length)];
    return this.addVehicleGround(position, id);
  }

  update(dt) {
    for (const it of this.items) it.update?.(dt);
    for (const sp of this.spawns) sp.update?.(dt);
  }

  /**
   * プレイヤー(単一 or 配列)の触れたアイテムをまとめて events 配列で返す。
   * events: [{kind:'warp'|'powerup'|'heal'|'weapon'|'shield'|'vehicle', ...}]
   * 効果適用(equip/mount/heal等)もここで行い、副作用としてアイテムを消滅。
   */
  checkPickup(playerOrPlayers) {
    const players = Array.isArray(playerOrPlayers) ? playerOrPlayers : [playerOrPlayers];
    const events = [];

    for (const p of players) {
      if (!p || !p.alive) continue;
      const pp = p.object.position;
      // UFO搭乗中は半径2mのアイテムを吸引取得(ワープと乗り物スポーンは対象外)
      const ufoMagnet = (p.mountedVehicle && p.mountedVehicle.id === 'veh_ufo') ? 2.0 : 0;

      // ワープ
      for (const it of this.items) {
        if (!it.alive || it.kind !== 'warp') continue;
        if (!it.canTeleport || !it.canTeleport(p.id)) continue;
        const d = pp.distanceTo(it.object.position);
        if (d <= (it.radius || 1.5) + 0.6) {
          // 旧コードの ev.to.color, ev.position 期待
          const to = it.partner || it;
          // 出口に着地後、出口の半径外へ少し押し出す。
          // 入口→出口の方向ベクトルを再利用し、出口の半径+1.5外へ。
          const dir = to.object.position.clone().sub(it.object.position);
          if (dir.lengthSq() < 0.0001) dir.set(1, 0, 0);
          dir.y = 0;
          dir.normalize();
          const offset = (to.radius || 1.5) + 1.5;
          const dst = to.object.position.clone().add(dir.multiplyScalar(offset));
          // y は元の高さを維持(空中での連続ワープに対応)
          dst.y = p.object.position.y;
          p.object.position.copy(dst);
          // 双方にクールダウンを掛けて、出口→入口の往復を防ぐ
          if (it.markUsed) it.markUsed(p.id, 1.5);
          if (to.markUsed) to.markUsed(p.id, 1.5);
          // 速度がある場合は方向を進行方向に保つ
          if (p.velocity && p.velocity.set && typeof p.velocity.x === 'number') {
            const sp = Math.hypot(p.velocity.x, p.velocity.z);
            if (sp > 0.1) {
              p.velocity.x = dir.x * sp;
              p.velocity.z = dir.z * sp;
            }
          }
          events.push({ kind: 'warp', spot: it, to, position: to.object.position.clone(), player: p });
          break; // 同フレームでさらに別ワープに巻き込まれないように一回で打ち切る
        }
      }

      // パワーアップ・回復・武器・盾(items)
      for (const it of this.items) {
        if (!it.alive) continue;
        if (it.kind === 'warp') continue;
        const d = pp.distanceTo(it.object.position);
        if (d > (it.radius || 1.0) + 0.6 + ufoMagnet) continue;

        if (it.kind === 'powerup') {
          if (p.applyFireBoost) p.applyFireBoost(it.mul ?? 0.5, it.duration ?? 8);
          events.push({ kind: 'powerup', item: it, player: p, duration: it.duration ?? 8 });
          this.removeItem(it);
        } else if (it.kind === 'heal') {
          const amount = it.cfg?.amount ?? 30;
          if (p.heal) p.heal(amount, { full: it.cfg?.full, overheal: it.cfg?.overheal });
          else { p.hp = Math.min(p.maxHp || 100, (p.hp || 0) + amount); }
          events.push({ kind: 'heal', item: it, player: p, amount, name: it.cfg?.name });
          this.removeItem(it);
        } else if (it.kind === 'weapon') {
          if (p.equipWeapon) p.equipWeapon(it.cfg);
          events.push({ kind: 'weapon', item: it, player: p, duration: it.cfg?.duration ?? 25, name: it.cfg?.name });
          this.removeItem(it);
        } else if (it.kind === 'shield') {
          if (p.equipShield) p.equipShield(it.cfg);
          events.push({ kind: 'shield', item: it, player: p, duration: it.cfg?.duration ?? 30, name: it.cfg?.name });
          this.removeItem(it);
        } else if (it.kind === 'scope') {
          if (p.equipScope) p.equipScope(it.cfg);
          events.push({ kind: 'scope', item: it, player: p, name: it.cfg?.name });
          this.removeItem(it);
        }
      }

      // 地面の乗り物(spawns)
      for (const sp of this.spawns) {
        if (!sp.alive) continue;
        const d = pp.distanceTo(sp.object.position);
        if (d > (sp.radius || 2.0) + 0.6) continue;
        if (p.mountVehicle) p.mountVehicle(sp.cfg);
        events.push({ kind: 'vehicle', item: sp, player: p, duration: sp.cfg?.duration ?? 20, name: sp.cfg?.name });
        this.consumeSpawn(sp);
      }
    }
    return events;
  }

  removeItem(item) {
    item.alive = false;
    if (item.object && item.object.parent) item.object.parent.remove(item.object);
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
  }

  // 乗り物地上スポーンは「消費」(リスポーンで戻ってくる)
  consumeSpawn(spawn) {
    if (typeof spawn.consume === 'function') spawn.consume();
  }

  clear() {
    for (const it of this.items) {
      if (it.object && it.object.parent) it.object.parent.remove(it.object);
    }
    for (const sp of this.spawns) {
      if (sp.object && sp.object.parent) sp.object.parent.remove(sp.object);
    }
    this.items = [];
    this.spawns = [];
  }
}

export { ItemManager };

