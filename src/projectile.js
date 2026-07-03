// 弾（音符弾）システム
// 各キャラから発射、カメラの向いてる方向へ飛ぶ
// Phase 1のグレーボックス: 光る球 + 小さい棒（音符っぽいシルエット）

import * as THREE from 'three';


// --- 炎用の共有スプライトテクスチャ(遅延生成・全弾で共有) ---
let _fireGlowTex = null, _emberTex = null, _smokeTex = null;
function _makeRadialTex(stops, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  for (const [t, col] of stops) g.addColorStop(t, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
function _getFireTextures() {
  if (!_fireGlowTex) {
    _fireGlowTex = _makeRadialTex([
      [0.0, 'rgba(255,255,230,1)'],
      [0.18, 'rgba(255,225,120,0.95)'],
      [0.45, 'rgba(255,120,30,0.65)'],
      [0.75, 'rgba(200,40,10,0.25)'],
      [1.0, 'rgba(120,10,0,0)'],
    ]);
    _emberTex = _makeRadialTex([
      [0.0, 'rgba(255,240,180,1)'],
      [0.4, 'rgba(255,140,40,0.9)'],
      [1.0, 'rgba(255,60,0,0)'],
    ], 64);
    _smokeTex = _makeRadialTex([
      [0.0, 'rgba(60,45,40,0.55)'],
      [0.6, 'rgba(40,30,28,0.3)'],
      [1.0, 'rgba(30,22,20,0)'],
    ]);
  }
  return { glow: _fireGlowTex, ember: _emberTex, smoke: _smokeTex };
}

const SPEED = 40;             // 単位/秒
const LIFETIME = 2.0;         // 秒
const RADIUS = 0.25;          // 当たり判定半径

// 単発の弾
export class Projectile {
  constructor(position, direction, color, ownerId, options = {}) {
    this.alive = true;
    this.age = 0;
    this.lifetime = options.life ?? LIFETIME;
    this.radius = options.radius ?? RADIUS;
    this.dmg = options.dmg ?? null;          // null なら main.js の BULLET_DAMAGE が使われる
    this.homing = options.homing ?? 0;        // 0..1: 1 で完全追尾、0 で直進
    this.ownerId = ownerId; // 自分の弾で自分に当たらないように
    this.style = options.style ?? 'note';     // 'note' = 音符弾 / 'fire' = 炎の玉
    this.healOnHit = options.healOnHit ?? 0;  // ヒット1発で撃った人を回復するHP量（先生のB攻撃など）
    this.headshot = options.headshot ?? false; // FPSモードでヘッドショット確定弾かどうか（着弾SE切替）

    const speed = options.speed ?? SPEED;
    const visualScale = this.radius / RADIUS;

    // 見た目
    const group = new THREE.Group();

    if (this.style === 'fire') {
      // リアル火球: 放射グラデのスプライト重ね + 白熱コア + 彗星尾 + 火の粉 + 煙
      this._isFire = true;
      this._fireT = Math.random() * Math.PI * 2;
      const texs = _getFireTextures();
      const big = this.radius >= 0.8; // 大型火球は演出増量

      // (1) 大きな発光ハロー(ビルボード)
      if (texs.glow) {
        const glowMat = new THREE.SpriteMaterial({
          map: texs.glow, blending: THREE.AdditiveBlending,
          depthWrite: false, fog: false, opacity: 0.95,
        });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.setScalar(RADIUS * 6.2 * visualScale);
        group.add(glow);
        this._fireGlow = glow;
      }

      // (2) 炎本体: 濃橙の外殻 + 白熱コア(加算)
      const shellMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.92,
        blending: THREE.NormalBlending, depthWrite: false, fog: false,
      });
      const shell = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.15, 16, 14), shellMat);
      shell.scale.setScalar(visualScale);
      group.add(shell);
      this._fireFlame = shell;

      const coreMat = new THREE.MeshBasicMaterial({
        color: options.coreColor ?? 0xffe680, transparent: true, opacity: 1.0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      });
      const core = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 0.62, 14, 12), coreMat);
      core.scale.setScalar(visualScale);
      group.add(core);
      this._fireCore = core;

      // (3) 彗星尾: 後方に連なる炎スプライト(進行方向の逆へ)
      this._fireTrail = [];
      if (texs.glow) {
        const n = big ? 14 : 8;
        for (let i = 0; i < n; i++) {
          const m = new THREE.SpriteMaterial({
            map: texs.glow, blending: THREE.AdditiveBlending,
            depthWrite: false, fog: false, opacity: 0.8,
          });
          const s = new THREE.Sprite(m);
          s.userData = { i, jx: (Math.random()-0.5)*0.5, jy: (Math.random()-0.5)*0.5, ph: Math.random()*Math.PI*2 };
          group.add(s);
          this._fireTrail.push(s);
        }
      }

      // (4) 火の粉: 周囲を舞う小さな加算スプライト
      this._fireEmbers = [];
      if (texs.ember) {
        const n = big ? 8 : 4;
        for (let i = 0; i < n; i++) {
          const m = new THREE.SpriteMaterial({
            map: texs.ember, blending: THREE.AdditiveBlending,
            depthWrite: false, fog: false, opacity: 0.95,
          });
          const s = new THREE.Sprite(m);
          s.userData = {
            ang: Math.random()*Math.PI*2, spd: 2 + Math.random()*3,
            r: (0.9 + Math.random()*0.9) * RADIUS, vy: (Math.random()-0.2)*0.6,
            ph: Math.random()*Math.PI*2, sc: 0.2 + Math.random()*0.25,
          };
          group.add(s);
          this._fireEmbers.push(s);
        }
      }

      // (5) 煙: 尾のさらに後方に淡い黒煙(通常ブレンド)
      this._fireSmoke = [];
      if (texs.smoke && big) {
        for (let i = 0; i < 5; i++) {
          const m = new THREE.SpriteMaterial({
            map: texs.smoke, blending: THREE.NormalBlending,
            depthWrite: false, fog: false, opacity: 0.5,
          });
          const s = new THREE.Sprite(m);
          s.userData = { i, jx: (Math.random()-0.5)*0.8, jy: Math.random()*0.5, ph: Math.random()*Math.PI*2 };
          group.add(s);
          this._fireSmoke.push(s);
        }
      }

      // (6) 周囲を照らす炎光(大型のみ)
      if (big) {
        const light = new THREE.PointLight(0xff6622, 4.5, 16 * visualScale, 1.6);
        group.add(light);
        this._fireLight = light;
      }
    } else {
      // 音符: 光る球 + 小さい棒（音符の旗っぽい）
      const ballMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.2,
        roughness: 0.4,
      });
      const ball = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 12, 12), ballMat);
      ball.scale.setScalar(visualScale);
      group.add(ball);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 })
      );
      stem.position.set(RADIUS * 0.7 * visualScale, 0.3 * visualScale, 0);
      stem.scale.setScalar(visualScale);
      group.add(stem);
    }

    group.position.copy(position);
    this.object = group;

    // 速度ベクトル（dirは正規化前提）
    this.velocity = direction.clone().multiplyScalar(speed);
    this.speed = speed;

    // 射手の速度を継承（高速移動中に弾が置き去りにならないため）
    // 横ブレを避けるため、狙い方向に沿った前進成分のみ加算する
    if (options.inheritVelocity) {
      const iv = options.inheritVelocity;
      const along = iv.x * direction.x + iv.y * direction.y + iv.z * direction.z;
      if (along > 0) {
        this.velocity.addScaledVector(direction, along);
      }
    }
  }

  update(dt, targets = null) {
    this.age += dt;
    if (this.age >= this.lifetime) {
      this.alive = false;
      return;
    }
    // ホーミング：最寄りの敵対ターゲットへ少しずつ向きを補正
    if (this.homing > 0 && targets && targets.length) {
      let best = null;
      let bestD = Infinity;
      for (const t of targets) {
        if (!t || !t.alive) continue;
        if (t.ownerId === this.ownerId) continue;
        const d = t.object.position.distanceToSquared(this.object.position);
        if (d < bestD) { bestD = d; best = t; }
      }
      if (best) {
        const desired = best.object.position.clone()
          .sub(this.object.position)
          .normalize()
          .multiplyScalar(this.speed);
        // 線形補間で滑らかに追尾
        const k = Math.min(1, this.homing * dt * 4);
        this.velocity.lerp(desired, k);
      }
    }
    this.object.position.addScaledVector(this.velocity, dt);
    // 回転して飛んでる感を出す(炎は尾の向き維持のため回転させない)
    if (!this._isFire) this.object.rotation.z += dt * 8;

    // 炎のちらつきアニメ
    if (this._isFire) {
      this._fireT += dt * 14;
      const t = this._fireT;
      const vs = this.radius / RADIUS;
      const lifeFrac = this.age / this.lifetime;
      const fade = 1 - lifeFrac * lifeFrac;
      // 進行方向の逆(ワールド) — groupは無回転なのでローカルと一致
      const back = this.velocity.clone().normalize().multiplyScalar(-1);

      if (this._fireGlow) {
        const w = 1 + Math.sin(t * 1.9) * 0.12 + Math.sin(t * 3.3) * 0.06;
        this._fireGlow.scale.setScalar(RADIUS * 6.2 * vs * w);
        this._fireGlow.material.opacity = 0.95 * fade;
      }
      if (this._fireFlame) {
        // 不等軸の脈動でゆらぐ球体感
        this._fireFlame.scale.set(
          vs * (1 + Math.sin(t * 1.6) * 0.1),
          vs * (1 + Math.sin(t * 2.1 + 1.3) * 0.12),
          vs * (1 + Math.sin(t * 1.8 + 2.6) * 0.1));
        this._fireFlame.material.opacity = 0.92 * fade;
      }
      if (this._fireCore) {
        this._fireCore.scale.setScalar(vs * (1 + Math.sin(t * 2.6) * 0.15));
        this._fireCore.material.opacity = Math.max(0, 1 - lifeFrac * 1.3);
      }
      if (this._fireTrail) {
        const n = this._fireTrail.length;
        for (const s of this._fireTrail) {
          const u = s.userData;
          const f = (u.i + 1) / n;                       // 0..1 後方距離
          const dist = f * RADIUS * 7.5 * vs;
          const sway = Math.sin(t * 2.2 + u.ph) * RADIUS * 0.4 * vs * f;
          s.position.set(
            back.x * dist + u.jx * vs * f + sway * 0.3,
            back.y * dist + u.jy * vs * f + sway,
            back.z * dist + sway * 0.3);
          s.scale.setScalar(RADIUS * 4.6 * vs * (1 - f * 0.75));
          s.material.opacity = 0.8 * (1 - f) * fade;
        }
      }
      if (this._fireEmbers) {
        for (const s of this._fireEmbers) {
          const u = s.userData;
          u.ang += dt * u.spd;
          s.position.set(
            Math.cos(u.ang) * u.r * vs,
            Math.sin(t * 1.4 + u.ph) * RADIUS * 0.8 * vs + u.vy * vs,
            Math.sin(u.ang) * u.r * vs);
          s.scale.setScalar(RADIUS * u.sc * vs * (0.8 + Math.sin(t * 3 + u.ph) * 0.35));
          s.material.opacity = (0.6 + Math.sin(t * 4 + u.ph) * 0.4) * fade;
        }
      }
      if (this._fireSmoke) {
        const n = this._fireSmoke.length;
        for (const s of this._fireSmoke) {
          const u = s.userData;
          const f = (u.i + 1) / n;
          const dist = (0.6 + f) * RADIUS * 8.5 * vs;
          s.position.set(
            back.x * dist + u.jx * vs,
            back.y * dist + u.jy * vs + f * RADIUS * 1.2 * vs, // 煙は上へ
            back.z * dist);
          s.scale.setScalar(RADIUS * (3.5 + f * 3.5) * vs);
          s.material.opacity = 0.4 * (1 - f * 0.5) * fade;
        }
      }
      if (this._fireLight) {
        this._fireLight.intensity = (4.0 + Math.sin(t * 5.1) * 1.6) * fade;
      }
    }
  }
}

// 弾の管理クラス
export class ProjectileManager {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  spawn(position, direction, color, ownerId, options) {
    const p = new Projectile(position, direction, color, ownerId, options);
    this.list.push(p);
    this.scene.add(p.object);
    return p;
  }

  update(dt, targets = null) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.update(dt, targets);
      if (!p.alive) {
        this.scene.remove(p.object);
        // ジオメトリ・マテリアル開放
        p.object.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
        this.list.splice(i, 1);
      }
    }
  }

  // 後でダメージ判定に使う: 対象座標と半径で衝突した弾を返す
  // ownerIdが一致する弾は無視（自爆防止）
  checkHits(targetPosition, targetRadius, excludeOwnerId) {
    const hits = [];
    for (const p of this.list) {
      if (!p.alive) continue;
      if (p.ownerId === excludeOwnerId) continue;
      const d = p.object.position.distanceTo(targetPosition);
      if (d < p.radius + targetRadius) {
        hits.push(p);
      }
    }
    return hits;
  }
}
