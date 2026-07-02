// 弾（音符弾）システム
// 各キャラから発射、カメラの向いてる方向へ飛ぶ
// Phase 1のグレーボックス: 光る球 + 小さい棒（音符っぽいシルエット）

import * as THREE from 'three';

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

    const speed = options.speed ?? SPEED;
    const visualScale = this.radius / RADIUS;

    // 見た目
    const group = new THREE.Group();

    if (this.style === 'fire') {
      // ポケモン式の炎: MeshBasic + AdditiveBlending で発光レイヤを重ねる
      this._isFire = true;
      this._fireT = Math.random() * Math.PI * 2;
      const coreColor = options.coreColor ?? 0xffe680;

      // 外側のふんわりオーラ（赤〜オレンジ）
      // NormalBlending にして炎が霧の上にハッキリ見えるようにする
      const auraMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        blending: THREE.NormalBlending,
        depthWrite: false,
        fog: false,
      });
      const aura = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.7, 14, 12), auraMat);
      aura.scale.setScalar(visualScale);
      group.add(aura);
      this._fireAura = aura;

      // 中間の炎本体（オレンジ）: 不透明の実体感を出す
      const flameMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.98,
        blending: THREE.NormalBlending,
        depthWrite: false,
        fog: false,
      });
      const flame = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.05, 14, 12), flameMat);
      flame.scale.setScalar(visualScale);
      group.add(flame);
      this._fireFlame = flame;

      // 中心の白熱コア: AdditiveBlending で白飛びさせ最大輝度
      const coreMat = new THREE.MeshBasicMaterial({
        color: coreColor,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const core = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 0.55, 12, 10), coreMat);
      core.scale.setScalar(visualScale);
      group.add(core);
      this._fireCore = core;

      // 副次的な炎パフ（オフセット配置でモコモコ感）
      const puffMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.NormalBlending,
        depthWrite: false,
        fog: false,
      });
      const puffs = [];
      for (let i = 0; i < 4; i++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 0.65, 10, 8), puffMat);
        const ang = (i / 4) * Math.PI * 2 + Math.random() * 0.6;
        puff.userData = {
          ang,
          radius: (0.35 + Math.random() * 0.35) * RADIUS,
          base: 0.55 + Math.random() * 0.35,
          phase: Math.random() * Math.PI * 2,
          bobY: (Math.random() - 0.5) * RADIUS * 0.3,
        };
        puff.position.set(
          Math.cos(ang) * puff.userData.radius * visualScale,
          puff.userData.bobY * visualScale,
          Math.sin(ang) * puff.userData.radius * visualScale,
        );
        puff.scale.setScalar(visualScale * 0.9);
        group.add(puff);
        puffs.push(puff);
      }
      this._firePuffs = puffs;

      // 後方の尾火（引きずり）
      const tailMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.75,
        blending: THREE.NormalBlending,
        depthWrite: false,
        fog: false,
      });
      const tail = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 0.75, 10, 8), tailMat);
      tail.position.set(-RADIUS * 1.1 * visualScale, 0, 0);
      tail.scale.setScalar(visualScale * 0.85);
      group.add(tail);
      this._fireTail = tail;
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
    // 回転して飛んでる感を出す
    this.object.rotation.z += dt * 8;

    // 炎のちらつきアニメ
    if (this._isFire) {
      this._fireT += dt * 14;
      const t = this._fireT;
      const lifeFrac = this.age / this.lifetime;
      // 寿命終盤に向けてフェードアウト（先端は明るく）
      const fade = 1 - lifeFrac * lifeFrac;
      const wobble = 1 + Math.sin(t) * 0.09 + Math.sin(t * 1.7) * 0.05;
      if (this._fireAura) {
        this._fireAura.scale.setScalar((this.radius / RADIUS) * wobble * (1 + lifeFrac * 0.35));
        this._fireAura.material.opacity = 0.85 * fade;
      }
      if (this._fireFlame) {
        this._fireFlame.scale.setScalar((this.radius / RADIUS) * (0.95 + Math.sin(t * 1.3) * 0.08));
        this._fireFlame.material.opacity = 0.98 * fade;
      }
      if (this._fireCore) {
        this._fireCore.scale.setScalar((this.radius / RADIUS) * (1 + Math.sin(t * 2.1) * 0.12));
        this._fireCore.material.opacity = Math.max(0, 1 - lifeFrac * 1.4);
      }
      if (this._firePuffs) {
        const vs = this.radius / RADIUS;
        for (const puff of this._firePuffs) {
          const u = puff.userData;
          u.ang += dt * (0.6 + Math.sin(t + u.phase) * 0.4);
          const r = u.radius * (u.base + Math.sin(t * 2 + u.phase) * 0.25);
          puff.position.set(
            Math.cos(u.ang) * r * vs,
            (u.bobY + Math.sin(t * 1.5 + u.phase) * RADIUS * 0.2) * vs,
            Math.sin(u.ang) * r * vs,
          );
          const s = 0.9 + Math.sin(t * 1.8 + u.phase) * 0.15;
          puff.scale.setScalar(vs * s);
          puff.material.opacity = 0.9 * fade;
        }
      }
      if (this._fireTail) {
        this._fireTail.material.opacity = 0.75 * fade * (0.85 + Math.sin(t * 2.3) * 0.15);
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
