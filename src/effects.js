// パーティクル＆エフェクト管理
// - ヒットバースト（被弾時の火花）
// - 死亡エクスプロージョン（撃破時の派手な爆発）
// - 剣ヒットのリング閃光
// すべて簡易ジオメトリで、寿命管理して自動でシーンから取り除く。

import * as THREE from 'three';

export class EffectManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = []; // {mesh, vel, life, age, fade}
    this.flashes = [];   // {mesh, life, age, startScale, endScale}
    this.afterImages = []; // {mesh, life, age}
    this.auras = [];       // {sprite, target, baseScale, phase}
    this._auraTextures = new Map(); // color -> CanvasTexture
  }

  // DBZ風オーラ（ターゲットに追従するスプライト）
  attachAura(target, color = 0xfff0a0) {
    const tex = this._getAuraTexture(color);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.4, 3.0, 1);
    sprite.position.set(0, 0.9, 0);
    target.add(sprite);
    const entry = { sprite, target, baseScale: 2.6, phase: Math.random() * Math.PI * 2 };
    this.auras.push(entry);
    return entry;
  }

  detachAura(target) {
    for (let i = this.auras.length - 1; i >= 0; i--) {
      const a = this.auras[i];
      if (a.target === target) {
        a.target.remove(a.sprite);
        a.sprite.material.dispose();
        this.auras.splice(i, 1);
      }
    }
  }

  // 残像（ダッシュ中などに呼ぶ）
  spawnAfterImage(target, color = 0xffd27a) {
    // ターゲットの可視メッシュを浅くクローンして半透明スプライト風に
    const box = new THREE.Box3().setFromObject(target);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const geo = new THREE.PlaneGeometry(Math.max(0.6, size.x * 1.2), Math.max(1.2, size.y * 1.1));
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(center);
    mesh.quaternion.copy(target.quaternion);
    this.scene.add(mesh);
    this.afterImages.push({ mesh, life: 0.25, age: 0 });
  }

  _getAuraTexture(color) {
    if (this._auraTextures.has(color)) return this._auraTextures.get(color);
    const size = 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const c = new THREE.Color(color);
    const r = Math.floor(c.r * 255), g = Math.floor(c.g * 255), b = Math.floor(c.b * 255);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
    grad.addColorStop(0.0, `rgba(255,255,255,1)`);
    grad.addColorStop(0.25, `rgba(${r},${g},${b},0.9)`);
    grad.addColorStop(0.6, `rgba(${r},${g},${b},0.35)`);
    grad.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    this._auraTextures.set(color, tex);
    return tex;
  }

  // 小さな火花バースト（弾ヒット用）
  spawnHitBurst(position, color = 0xffe066, count = 12) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      // ランダム方向に飛ばす
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      );
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
      dir.normalize();
      const speed = 4 + Math.random() * 4;
      const vel = dir.multiplyScalar(speed);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel,
        life: 0.4 + Math.random() * 0.2,
        age: 0,
        gravity: -2,
      });
    }
    // 中央に小さなフラッシュリング
    this._spawnFlashRing(position, color, 0.6, 1.6, 0.2);
  }

  // 死亡時の大規模エクスプロージョン
  spawnDeathExplosion(position, color = 0xff6a4d) {
    // 多数の破片
    const count = 28;
    for (let i = 0; i < count; i++) {
      const size = 0.12 + Math.random() * 0.18;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 1.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.8 + 0.1,
        Math.random() - 0.5
      ).normalize();
      const speed = 6 + Math.random() * 6;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: dir.multiplyScalar(speed),
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8
        ),
        life: 0.9 + Math.random() * 0.4,
        age: 0,
        gravity: -8,
      });
    }
    // 大きめのフラッシュリング2発
    this._spawnFlashRing(position, color, 1.0, 4.5, 0.35);
    this._spawnFlashRing(position, 0xffffff, 0.4, 2.5, 0.18);
  }

  // 剣ヒット用のリング閃光
  spawnSwordHit(position, color = 0xffffff) {
    this._spawnFlashRing(position, color, 0.5, 2.0, 0.18);
    // 小さい破片も少し
    this.spawnHitBurst(position, color, 6);
  }

  // キャラ別ヒットエフェクトのディスパッチャ
  spawnHitFx(kind, position, color) {
    switch (kind) {
      case 'note':    return this.spawnNoteHit(position, color);
      case 'staff':   return this.spawnStaffRing(position, color);
      case 'feather': return this.spawnFeatherBurst(position, color);
      default:        return this.spawnSwordHit(position, color);
    }
  }

  // 作曲ネコ：音符♪が飛び散る
  spawnNoteHit(position, color = 0xffee70) {
    const tex = this._getNoteTexture(color);
    const count = 8;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, color: 0xffffff,
        transparent: true, opacity: 1.0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const sp = new THREE.Sprite(mat);
      const s = 0.45 + Math.random() * 0.25;
      sp.scale.set(s, s, 1);
      sp.position.copy(position);
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 1.4,
        Math.random() * 0.9 + 0.3,
        (Math.random() - 0.5) * 1.4
      );
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
      dir.normalize();
      const speed = 3.5 + Math.random() * 3;
      this.scene.add(sp);
      this.particles.push({
        mesh: sp,
        vel: dir.multiplyScalar(speed),
        life: 0.55 + Math.random() * 0.2,
        age: 0,
        gravity: -3,
      });
    }
    // 中心に小さな閃光
    this._spawnFlashRing(position, color, 0.4, 1.4, 0.16);
  }

  // 先生：青い五線譜風の同心リング
  spawnStaffRing(position, color = 0x80b0ff) {
    // メインのリング
    this._spawnFlashRing(position, color,        0.6, 3.5, 0.32);
    this._spawnFlashRing(position, 0xffffff,     0.3, 2.0, 0.18);
    // 5線譜風に、平行な薄い線を5本（軽く色を変えて）
    const upAxis = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.RingGeometry(0.5, 0.62, 36);
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.7,
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      mesh.position.y += (i - 2) * 0.18; // 上下にズラして「線」っぽく
      mesh.lookAt(position.clone().add(upAxis));
      mesh.scale.setScalar(0.5);
      this.scene.add(mesh);
      this.flashes.push({
        mesh, life: 0.4, age: 0,
        startScale: 0.5, endScale: 2.6 + i * 0.15,
      });
    }
    // 小さい破片
    this.spawnHitBurst(position, color, 4);
  }

  // フクロウ：紫の羽根（細長い板）が散る
  spawnFeatherBurst(position, color = 0xa080ff) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.PlaneGeometry(0.16, 0.42);
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 1.0,
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.6 + 0.2,
        Math.random() - 0.5
      ).normalize();
      const speed = 3 + Math.random() * 3;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: dir.multiplyScalar(speed),
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6
        ),
        life: 0.7 + Math.random() * 0.3,
        age: 0,
        gravity: -1.5, // ふわっと落ちる
      });
    }
    // 中心の閃光
    this._spawnFlashRing(position, color, 0.5, 2.4, 0.24);
  }

  _getNoteTexture(color) {
    const key = 'note_' + color.toString(16);
    if (this._auraTextures.has(key)) return this._auraTextures.get(key);
    const size = 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const c = new THREE.Color(color);
    const r = Math.floor(c.r * 255), g = Math.floor(c.g * 255), b = Math.floor(c.b * 255);
    // 8分音符の簡易シルエット
    ctx.fillStyle = `rgba(${r},${g},${b},1)`;
    // 玉
    ctx.beginPath();
    ctx.ellipse(48, 90, 22, 16, -Math.PI / 8, 0, Math.PI * 2);
    ctx.fill();
    // 棒
    ctx.fillRect(66, 28, 8, 64);
    // 旗
    ctx.beginPath();
    ctx.moveTo(74, 28);
    ctx.quadraticCurveTo(110, 38, 96, 70);
    ctx.quadraticCurveTo(96, 50, 74, 48);
    ctx.closePath();
    ctx.fill();
    // 縁取り（光らせる）
    ctx.strokeStyle = `rgba(255,255,255,0.9)`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(48, 90, 22, 16, -Math.PI / 8, 0, Math.PI * 2);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    this._auraTextures.set(key, tex);
    return tex;
  }

  // プレイヤー被弾時の警告フラッシュ（カメラ前面、赤）
  // 専用の画面オーバーレイはUI側でやる前提なので、ここではワールド側の小さなショックリングだけ。
  spawnPlayerHurt(position) {
    this._spawnFlashRing(position, 0xff3333, 0.6, 2.0, 0.2);
  }

  _spawnFlashRing(position, color, startScale, endScale, life) {
    const geo = new THREE.RingGeometry(0.4, 0.55, 24);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    // ランダムな向きで配置
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    mesh.scale.setScalar(startScale);
    this.scene.add(mesh);
    this.flashes.push({
      mesh,
      life,
      age: 0,
      startScale,
      endScale,
    });
  }

  update(dt) {
    // 粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this._dispose(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      // 重力
      if (p.gravity) p.vel.y += p.gravity * dt;
      // 位置
      p.mesh.position.addScaledVector(p.vel, dt);
      // 回転
      if (p.spin) {
        p.mesh.rotation.x += p.spin.x * dt;
        p.mesh.rotation.y += p.spin.y * dt;
        p.mesh.rotation.z += p.spin.z * dt;
      }
      // フェード（Group の場合は子メッシュを再帰的に処理）
      const t = p.age / p.life;
      const opa = 1 - t;
      if (p.mesh.material && p.mesh.material.opacity !== undefined) {
        p.mesh.material.opacity = opa;
      } else if (p.mesh.traverse) {
        p.mesh.traverse((child) => {
          if (child.material && child.material.opacity !== undefined) {
            child.material.opacity = opa;
          }
        });
      }
    }
    // 残像
    for (let i = this.afterImages.length - 1; i >= 0; i--) {
      const a = this.afterImages[i];
      a.age += dt;
      if (a.age >= a.life) {
        this._dispose(a.mesh);
        this.afterImages.splice(i, 1);
        continue;
      }
      const t = a.age / a.life;
      a.mesh.material.opacity = 0.45 * (1 - t);
      a.mesh.scale.setScalar(1 + t * 0.2);
    }
    // オーラの脈動
    const now = performance.now() * 0.004;
    for (const a of this.auras) {
      const pulse = 1 + Math.sin(now + a.phase) * 0.08;
      a.sprite.scale.set(a.baseScale * pulse, a.baseScale * 1.25 * pulse, 1);
      a.sprite.material.opacity = 0.7 + Math.sin(now * 1.7 + a.phase) * 0.15;
    }
    // リング
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.age += dt;
      if (f.age >= f.life) {
        this._dispose(f.mesh);
        this.flashes.splice(i, 1);
        continue;
      }
      const t = f.age / f.life;
      const s = f.startScale + (f.endScale - f.startScale) * t;
      f.mesh.scale.setScalar(s);
      f.mesh.material.opacity = 0.9 * (1 - t);
    }
  }

  _dispose(mesh) {
    this.scene.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
    // Group の子メッシュも解放（音符グループなど）
    if (mesh.traverse) {
      mesh.traverse((child) => {
        if (child !== mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      });
    }
  }

  clear() {
    for (const p of this.particles) this._dispose(p.mesh);
    for (const f of this.flashes) this._dispose(f.mesh);
    for (const a of this.afterImages) this._dispose(a.mesh);
    for (const au of this.auras) {
      au.target.remove(au.sprite);
      au.sprite.material.dispose();
    }
    this.particles.length = 0;
    this.flashes.length = 0;
    this.afterImages.length = 0;
    this.auras.length = 0;
  }

  // ===== 必殺技エフェクト ===================================================
  // 共通: 中心からのドーム閃光 + 上昇柱 + 多数のパーティクル
  _ultimateBaseBurst(pos, color, radius = 6, particles = 60) {
    // 中心ドーム
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 24, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    dome.position.copy(pos);
    this.scene.add(dome);
    this.flashes.push({ mesh: dome, life: 0.6, age: 0, startScale: 1, endScale: radius * 1.2 });
    // リング
    const ringGeo = new THREE.RingGeometry(0.5, 0.7, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.position.y += 0.1;
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.flashes.push({ mesh: ring, life: 0.7, age: 0, startScale: 1, endScale: radius * 2 });
    // 上昇柱
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, radius * 2.2, 24, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    pillar.position.copy(pos);
    pillar.position.y += radius * 1.1;
    this.scene.add(pillar);
    this.flashes.push({ mesh: pillar, life: 0.9, age: 0, startScale: 1, endScale: 2.2 });
    // パーティクル
    for (let i = 0; i < particles; i++) {
      const geo = new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      const th = Math.random() * Math.PI * 2;
      const ph = (Math.random() - 0.2) * Math.PI;
      const sp = 6 + Math.random() * 10;
      m.userData = {};
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(Math.cos(th) * Math.cos(ph) * sp, Math.sin(ph) * sp + 4, Math.sin(th) * Math.cos(ph) * sp),
        life: 1.2 + Math.random() * 0.6, age: 0, fade: true, gravity: -8,
      });
    }
  }

  // ===== 共通: 直線光線 (中心→目標) =====
  _spawnBeamLine(from, to, color, thickness = 0.6, life = 0.6) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 0.001) return;
    const mid = from.clone().addScaledVector(dir, 0.5);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(thickness, thickness, len, 16, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    beam.position.copy(mid);
    // CylinderはY軸方向なので、dir方向に揃える
    const axis = new THREE.Vector3(0, 1, 0);
    beam.quaternion.setFromUnitVectors(axis, dir.clone().normalize());
    this.scene.add(beam);
    this.flashes.push({ mesh: beam, life, age: 0, startScale: 1, endScale: 1.6 });
  }

  // UFOの落雷: 上空(from)から地面(to)へ太い光柱 + 着弾リング + 火花
  spawnLightningStrike(from, to, color = 0x88e0ff) {
    const fromV = new THREE.Vector3(from.x, from.y, from.z);
    const toV = new THREE.Vector3(to.x, to.y, to.z);
    // 外側オーラ（極太・うっすら）— 一回り大きく
    this._spawnBeamLine(fromV, toV, color, 4.6, 0.45);
    // 太いコアビーム（純白・閃光）
    this._spawnBeamLine(fromV, toV, 0xffffff, 2.4, 0.55);
    // 中心スパーク（青白）
    this._spawnBeamLine(fromV, toV, color, 3.2, 0.6);
    // ジグザグ枝分かれ（4本、太く・広く）
    for (let i = 0; i < 4; i++) {
      const segs = 3;
      let prev = fromV.clone();
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const mid = fromV.clone().lerp(toV, t);
        if (s < segs) {
          mid.x += (Math.random() - 0.5) * 3.6;
          mid.z += (Math.random() - 0.5) * 3.6;
        }
        this._spawnBeamLine(prev, mid, color, 1.0, 0.36);
        // 白いコアも細く重ねる
        this._spawnBeamLine(prev, mid, 0xffffff, 0.45, 0.3);
        prev = mid;
      }
    }
    // 着弾フラッシュリング（複数層・さらに大型化）
    this._spawnFlashRing(toV, color, 0.9, 18, 0.55);
    this._spawnFlashRing(toV, color, 1.8, 13, 0.65);
    this._spawnFlashRing(toV, 0xffffff, 0.6, 8, 0.4);
    // 着弾点に強い光球（大型化）
    const flashGeom = new THREE.SphereGeometry(2.6, 16, 12);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const flash = new THREE.Mesh(flashGeom, flashMat);
    flash.position.copy(toV);
    this.scene.add(flash);
    this.flashes.push({ mesh: flash, life: 0.32, age: 0, startScale: 1, endScale: 3.6 });
    // 火花を強めに
    this.spawnHitBurst(toV, color, 32);
    this.spawnHitBurst(toV, 0xffffff, 14);
  }

  // 頭上に伸びる雷柱: from(根元) から up(空) へ昇る雷（spawnLightningStrike を上向きに）
  spawnLightningPillarUp(from, height = 14, color = 0x88e0ff) {
    const fromV = new THREE.Vector3(from.x, from.y, from.z);
    const toV = new THREE.Vector3(from.x, from.y + height, from.z);
    // オーラ（さらに極太化）
    this._spawnBeamLine(fromV, toV, color, 4.2, 0.5);
    // 中心の白い柱（強化）
    this._spawnBeamLine(fromV, toV, 0xffffff, 2.0, 0.6);
    // 内側スパーク
    this._spawnBeamLine(fromV, toV, color, 2.9, 0.65);
    // 左右に強い放電枝（本数増・広く）
    for (let i = 0; i < 10; i++) {
      const t = 0.1 + Math.random() * 0.8;
      const root = fromV.clone().lerp(toV, t);
      const branchEnd = root.clone();
      branchEnd.x += (Math.random() - 0.5) * 6.5;
      branchEnd.z += (Math.random() - 0.5) * 6.5;
      branchEnd.y += (Math.random() - 0.5) * 2.6;
      this._spawnBeamLine(root, branchEnd, color, 0.6, 0.34);
      this._spawnBeamLine(root, branchEnd, 0xffffff, 0.26, 0.28);
    }
    // 根元に閃光（大型化）
    this._spawnFlashRing(fromV, color, 1.6, 17, 0.55);
    this._spawnFlashRing(fromV, 0xffffff, 0.95, 9, 0.36);
  }

  // cat_neko: 音符の波動 (黄色) — 前方扇状に音符弾が広がる
  ultimateCatNeko(pos, dir) {
    const color = 0xffe066;
    const fwd = (dir && dir.lengthSq() > 0.0001) ? dir.clone().normalize() : new THREE.Vector3(0, 0, -1);
    fwd.y = 0; if (fwd.lengthSq() < 0.001) fwd.set(0, 0, -1); fwd.normalize();
    this._ultimateBaseBurst(pos, color, 6, 60);
    // 中央前方に大きな音符 (18個を扇状に配置)
    const noteCount = 18;
    const totalArc = Math.PI * 0.9; // 約162度
    for (let i = 0; i < noteCount; i++) {
      const t = noteCount === 1 ? 0.5 : (i / (noteCount - 1));
      const ang = (t - 0.5) * totalArc;
      const c = Math.cos(ang), s = Math.sin(ang);
      const flyDir = new THREE.Vector3(fwd.x * c + fwd.z * s, 0, -fwd.x * s + fwd.z * c).normalize();
      // 音符グループ
      const noteGroup = new THREE.Group();
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 12, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      head.scale.set(1.2, 0.85, 0.5);
      noteGroup.add(head);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      stem.position.set(0.3, 0.8, 0);
      noteGroup.add(stem);
      // 旗
      const flag = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.5, 0.05),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      flag.position.set(0.55, 1.3, 0);
      noteGroup.add(flag);

      noteGroup.position.set(pos.x, pos.y + 1.5, pos.z);
      // 進行方向を見るように回転
      const lookAt = noteGroup.position.clone().add(flyDir);
      noteGroup.lookAt(lookAt);
      this.scene.add(noteGroup);
      this.particles.push({
        mesh: noteGroup,
        vel: flyDir.clone().multiplyScalar(22 + Math.random() * 4),
        life: 1.0, age: 0, fade: true, gravity: 0,
        spin: new THREE.Vector3(0, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8),
      });
    }
    // 中心リング
    this._spawnFlashRing(pos, color, 1.5, 16, 0.6);
  }

  // sensei: 神聖光柱 (青) — 目標地点に巨大な光柱が降臨
  ultimateSensei(pos, dir, targetPos) {
    const color = 0x6ec8ff;
    const fwd = (dir && dir.lengthSq() > 0.0001) ? dir.clone().normalize() : new THREE.Vector3(0, 0, -1);
    fwd.y = 0; if (fwd.lengthSq() < 0.001) fwd.set(0, 0, -1); fwd.normalize();
    // 着弾位置: targetPos があればそこ、なければ前方20m
    const land = targetPos ? targetPos.clone() : pos.clone().addScaledVector(fwd, 20);
    land.y = pos.y;

    this._ultimateBaseBurst(pos, color, 5, 40);

    // 詠唱ビーム: 自分から目標へ一直線の光線
    const beamFrom = pos.clone(); beamFrom.y += 1.2;
    const beamTo = land.clone(); beamTo.y += 1.2;
    this._spawnBeamLine(beamFrom, beamTo, 0xffffff, 0.7, 0.7);
    this._spawnBeamLine(beamFrom, beamTo, color, 1.4, 0.6);

    // 着弾点に巨大な光柱
    const bigPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 3.0, 36, 32, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    bigPillar.position.set(land.x, land.y + 18, land.z);
    this.scene.add(bigPillar);
    this.flashes.push({ mesh: bigPillar, life: 1.4, age: 0, startScale: 0.4, endScale: 1.5 });

    // 着弾点の十字光 (4方向、地面付近)
    for (let i = 0; i < 4; i++) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      beam.position.set(land.x, land.y + 1, land.z);
      beam.rotation.y = (Math.PI / 2) * i;
      this.scene.add(beam);
      this.flashes.push({ mesh: beam, life: 0.9, age: 0, startScale: 0.4, endScale: 1.8 });
    }
    // 着弾点に天使輪 + 地面リング
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(3.5, 0.22, 12, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    halo.position.set(land.x, land.y + 5, land.z);
    halo.rotation.x = Math.PI / 2;
    this.scene.add(halo);
    this.flashes.push({ mesh: halo, life: 1.1, age: 0, startScale: 0.3, endScale: 2.2 });
    this._spawnFlashRing(land, color, 1.0, 14, 0.7);
    // 着弾点に追加パーティクル
    this._ultimateBaseBurst(land, color, 7, 60);
  }

  // owl_oto: 羽根の竜巻 (紫) — 前方に向かって竜巻が突進
  ultimateOwlOto(pos, dir) {
    const color = 0xc77bff;
    const fwd = (dir && dir.lengthSq() > 0.0001) ? dir.clone().normalize() : new THREE.Vector3(0, 0, -1);
    fwd.y = 0; if (fwd.lengthSq() < 0.001) fwd.set(0, 0, -1); fwd.normalize();
    this._ultimateBaseBurst(pos, color, 6, 50);

    // 前方に複数段の竜巻 (距離別に4個並べる)
    for (let seg = 0; seg < 4; seg++) {
      const fwdDist = 4 + seg * 4;
      const segPos = pos.clone().addScaledVector(fwd, fwdDist);
      const tornado = new THREE.Mesh(
        new THREE.ConeGeometry(3.0 + seg * 0.3, 11, 24, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      tornado.position.set(segPos.x, segPos.y + 5.5, segPos.z);
      this.scene.add(tornado);
      this.flashes.push({ mesh: tornado, life: 1.3, age: 0, startScale: 0.5, endScale: 1.5 });
    }

    // 渦巻く羽根 (前方に向かう)
    for (let i = 0; i < 50; i++) {
      const feather = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.7, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      const th = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 3;
      const fwdOff = Math.random() * 14;
      const spawn = pos.clone().addScaledVector(fwd, fwdOff);
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      feather.position.set(
        spawn.x + Math.cos(th) * r * 0.3 + right.x * Math.sin(th) * r * 0.7,
        spawn.y + 0.5 + Math.random() * 8,
        spawn.z + Math.sin(th) * r * 0.3 + right.z * Math.sin(th) * r * 0.7
      );
      feather.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.scene.add(feather);
      // 前進 + 周回成分
      const vel = fwd.clone().multiplyScalar(10 + Math.random() * 4);
      vel.x += -Math.sin(th) * 6;
      vel.z += Math.cos(th) * 6;
      vel.y += 3 + Math.random() * 3;
      this.particles.push({
        mesh: feather,
        vel,
        life: 1.4, age: 0, fade: true, gravity: -1.5,
        spin: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8),
      });
    }
  }

  // キャラクター ID から振り分け (pos, dir, characterId, targetPos)
  triggerUltimate(pos, dir, characterId, targetPos) {
    if (characterId === 'cat_neko') this.ultimateCatNeko(pos, dir);
    else if (characterId === 'sensei') this.ultimateSensei(pos, dir, targetPos);
    else if (characterId === 'owl_oto') this.ultimateOwlOto(pos, dir);
    else this._ultimateBaseBurst(pos, 0xffffff, 6, 50);
  }
}
