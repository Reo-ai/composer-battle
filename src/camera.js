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

// 一人称視点カメラ（FPS モード用）
// - プレイヤーの目線位置に配置し、yaw/pitch で視線方向を決める
// - 三人称と同じ .shake() インターフェースを提供
const FPS_EYE_HEIGHT = 1.7;

export class FirstPersonCamera {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target; // Player
    this._shakeMag = 0;
    this._shakeDecay = 6;
    this._lookAt = new THREE.Vector3();
    this._forward = new THREE.Vector3();
  }

  shake(magnitude = 0.25, decay = 6) {
    this._shakeMag = Math.max(this._shakeMag, magnitude);
    this._shakeDecay = decay;
  }

  update(dt = 0.016) {
    const p = this.target.object.position;
    const yaw = this.target.yaw;
    const pitch = this.target.pitch;

    // 目線位置(Player の視覚オフセット、たとえば着地時の沈み込みを反映)
    const yOffset = (typeof this.target.getCameraYOffset === 'function')
      ? this.target.getCameraYOffset()
      : 0;
    this.camera.position.set(p.x, p.y + FPS_EYE_HEIGHT + yOffset, p.z);

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

    // yaw/pitch から視線方向を算出（ThirdPersonCamera と同じ座標系）
    // ThirdPersonCamera では offset = (sin(yaw)*cos(pitch), -sin(pitch), cos(yaw)*cos(pitch)) * dist で
    // プレイヤーの後方に置くため、視線方向はその逆向き（プレイヤーが向いている先）
    this._forward.set(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    );
    this._lookAt.copy(this.camera.position).add(this._forward);
    this.camera.lookAt(this._lookAt);
  }
}
