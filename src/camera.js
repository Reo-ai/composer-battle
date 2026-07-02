// 三人称追尾カメラ（ダッシュ時にカメラ引き＋シェイク）

import * as THREE from 'three';

// キャラクター2倍化に合わせ、距離・高さオフセットも約1.6倍に拡張
// (完全2倍だと画面が遠くなりすぎるため少し控えめに)
const DISTANCE_BASE = 10;
const DASH_DISTANCE_BONUS = 3.5;
const HEIGHT_OFFSET = 2.6;
const LERP = 0.12;

export class ThirdPersonCamera {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target; // Player
    this._desired = new THREE.Vector3();
    this._curDist = DISTANCE_BASE;
    this._shakeMag = 0;
    this._shakeDecay = 6;
  }

  // 外部から呼ぶ：揺れを足す（衝突・撃破時など）
  shake(magnitude = 0.25, decay = 6) {
    this._shakeMag = Math.max(this._shakeMag, magnitude);
    this._shakeDecay = decay;
  }

  update(dt = 0.016) {
    const p = this.target.object.position;
    const yaw = this.target.yaw;
    const pitch = this.target.pitch;

    // ダッシュ中はカメラを少し引く
    const dashing = !!this.target.isDashing && this.target.isDashing();
    const targetDist = DISTANCE_BASE + (dashing ? DASH_DISTANCE_BONUS : 0);
    this._curDist += (targetDist - this._curDist) * 0.15;

    const offset = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch) * this._curDist,
      -Math.sin(pitch) * this._curDist + HEIGHT_OFFSET,
      Math.cos(yaw) * Math.cos(pitch) * this._curDist
    );

    this._desired.copy(p).add(offset);
    this.camera.position.lerp(this._desired, LERP);

    // シェイク
    if (this._shakeMag > 0.001) {
      const m = this._shakeMag;
      this.camera.position.x += (Math.random() - 0.5) * m;
      this.camera.position.y += (Math.random() - 0.5) * m;
      this.camera.position.z += (Math.random() - 0.5) * m;
      this._shakeMag *= Math.exp(-this._shakeDecay * dt);
    } else {
      this._shakeMag = 0;
    }

    const lookAt = new THREE.Vector3(p.x, p.y + 1.6, p.z);
    this.camera.lookAt(lookAt);
  }
}
