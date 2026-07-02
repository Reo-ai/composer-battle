// 敵キャラクター（CPU AI）
// プレイヤーを追尾し、適度な距離を保ちながら音符弾を撃ってくる。

import * as THREE from 'three';
import { CHARACTERS } from './characters.js';
import { getTerrainHeightAt } from './stage.js';

const PREFERRED_DIST = 9;       // この距離を保ちたい
const ATTACK_RANGE = 14;        // この距離以内なら撃つ
const MAX_SPEED = 8.5;          // 最大速度（要望：敵をもう少し速く）
const FIRE_INTERVAL_MIN = 1.0;
const FIRE_INTERVAL_MAX = 2.0;

export class Enemy {
  constructor(charId, position, options = {}) {
    this.charId = charId;
    this.object = CHARACTERS[charId].create();
    this.object.position.copy(position);
    this.maxHp = options.maxHp ?? 100;
    this.hp = this.maxHp;
    this.alive = true;
    // キャラクター表示倍率（characters.js 側で CHARACTER_SCALE=2.0）に合わせて
    // 当たり判定半径も拡張する
    this.radius = 1.0 * 2.0;
    this.ownerId = options.ownerId ?? 'enemy';
    this.bobPhase = Math.random() * Math.PI * 2;
    this.hitFlashTime = 0;

    // AI 用ステート
    this.bulletColor = CHARACTERS[charId].color;
    this.velocity = new THREE.Vector3();
    this.fireCooldown =
      FIRE_INTERVAL_MIN + Math.random() * (FIRE_INTERVAL_MAX - FIRE_INTERVAL_MIN);
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeChangeTimer = 2 + Math.random() * 2;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this.hitFlashTime = 0.15;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  update(dt, ctx = {}) {
    // ふわふわ浮遊（生存中のみ）
    if (this.alive) {
      this.bobPhase += dt * 1.5;
    }

    // 被弾フラッシュ
    if (this.hitFlashTime > 0) {
      this.hitFlashTime -= dt;
      this.object.traverse((o) => {
        if (o.isMesh && o.material && o.material.emissive) {
          o.material.emissive.setRGB(0.6, 0, 0);
        }
      });
    } else {
      this.object.traverse((o) => {
        if (o.isMesh && o.material && o.material.emissive) {
          o.material.emissive.setRGB(0, 0, 0);
        }
      });
    }

    // 倒れたら沈める
    if (!this.alive) {
      this.object.position.y -= 1.5 * dt;
      this.object.rotation.z += 1.0 * dt;
      return;
    }

    // ---- AI ----
    const player = ctx.player;
    const projectiles = ctx.projectiles;
    if (!player || !player.alive) {
      // プレイヤー不在時はその場で浮遊だけ
      this.object.position.y += Math.sin(this.bobPhase) * 0.4 * dt;
      return;
    }

    const myPos = this.object.position;
    const plPos = player.object.position;
    const toPlayer = new THREE.Vector3().subVectors(plPos, myPos);
    const dist = toPlayer.length();

    // 水平方向の単位ベクトル
    const flat = new THREE.Vector3(toPlayer.x, 0, toPlayer.z);
    if (flat.lengthSq() < 1e-6) flat.set(0, 0, 1);
    flat.normalize();

    // ストレイフ方向タイマー
    this.strafeChangeTimer -= dt;
    if (this.strafeChangeTimer <= 0) {
      this.strafeDir = Math.random() > 0.5 ? 1 : -1;
      this.strafeChangeTimer = 2 + Math.random() * 2;
    }
    const strafe = new THREE.Vector3(-flat.z, 0, flat.x).multiplyScalar(this.strafeDir);

    // 望みの速度を作る
    const desired = new THREE.Vector3();
    if (dist > PREFERRED_DIST + 1.5) {
      // 距離が遠ければ近づく
      desired.addScaledVector(flat, MAX_SPEED);
    } else if (dist < PREFERRED_DIST - 1.5) {
      // 近すぎたら離れる
      desired.addScaledVector(flat, -MAX_SPEED * 0.8);
    } else {
      // 適正距離なら横ストレイフ
      desired.addScaledVector(strafe, MAX_SPEED * 0.7);
    }

    // 高さ追従
    const heightDiff = plPos.y - myPos.y;
    desired.y = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, heightDiff * 1.2));

    // ふわふわ揺れ加算
    desired.y += Math.sin(this.bobPhase) * 0.6;

    // velocity を desired に滑らかに寄せる（応答性アップ）
    this.velocity.lerp(desired, Math.min(1, dt * 3.6));
    myPos.addScaledVector(this.velocity, dt);

    // 地形に潜らない(地形高さをサンプリングして床にする)
    const groundY = getTerrainHeightAt(myPos.x, myPos.z);
    const minY = groundY + 1.5;
    if (myPos.y < minY) {
      myPos.y = minY;
      this.velocity.y = Math.max(0, this.velocity.y);
    }

    // プレイヤーの方を向く（水平のみ）
    const lookTarget = new THREE.Vector3(plPos.x, myPos.y, plPos.z);
    this.object.lookAt(lookTarget);

    // ---- 射撃 ----
    this.fireCooldown -= dt;
    if (this.fireCooldown <= 0 && dist < ATTACK_RANGE && projectiles) {
      // マズル位置（少し前方）
      const muzzle = myPos.clone().add(new THREE.Vector3(0, 0.2, 0)).addScaledVector(flat, 0.8);
      // 狙いに少しブレを入れる
      const aim = new THREE.Vector3(
        toPlayer.x / dist + (Math.random() - 0.5) * 0.08,
        toPlayer.y / dist + (Math.random() - 0.5) * 0.05,
        toPlayer.z / dist + (Math.random() - 0.5) * 0.08
      ).normalize();
      projectiles.spawn(muzzle, aim, this.bulletColor, this.ownerId);
      this.fireCooldown =
        FIRE_INTERVAL_MIN + Math.random() * (FIRE_INTERVAL_MAX - FIRE_INTERVAL_MIN);
    }
  }
}
