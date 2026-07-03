// プレイヤー操作（DBZ風ダッシュ + スマブラ風コマンド攻撃）
// 操作:
//  WASD/Arrow←→: 平面移動 / ArrowUp: 上昇 / ArrowDown: 下降
//  マウス移動: 視点（キャンバスクリックで Pointer Lock）
//  ShiftL/R: ダッシュ（短時間ブースト）
//  KeyZ: 通常弾 / KeyB: 特殊弾（キャラ別）
//  KeyX: 軽攻撃（方向で派生・空中で空中技）
//  KeyC: 重攻撃（スマッシュ・上スマで上振り/下スマで下振り）

import * as THREE from 'three';
import { makeShieldVisual } from './items.js';
import { getTerrainHeightAt } from './stage.js';

// 既定移動。要望「縦横無尽・全方位スムーズ」に合わせて速度・加速とも引き上げ。
// 減衰(DAMPING)はやや弱めに下げて、停止時にスーッと滑るような慣性を残す。
const MOVE_SPEED = 34;
const ASCEND_SPEED = 28;
const DESCEND_SPEED = 28;
const ACCEL = 120;
const DAMPING = 2.4;
const ROT_LERP = 0.2;
const BOB_AMP = 0.08;
const BOB_FREQ = 1.8;
const FIRE_COOLDOWN = 0.12;

// マウス感度（Pointer Lock 中の movementX/Y に乗算）
const MOUSE_YAW_SENS = 0.0025;
const MOUSE_PITCH_SENS = 0.0022;

// ダッシュ
const DASH_DURATION = 0.32;
const DASH_SPEED = 60;
const DASH_ACCEL = 240;
const DASH_DAMPING = 1.2;
const DASH_COOLDOWN = 0.45;
const DASH_TILT = 0.35; // ダッシュ中の機体傾き

// 剣の待機姿勢
const SWORD_REST_ANGLE = -Math.PI / 3;

// レガシー互換用（外部から参照される）
export const SWORD_RANGE = 2.8;
export const SWORD_ARC_HALF = Math.PI / 3;
export const SWORD_DAMAGE = 28;

// 攻撃テーブル：キャラ別。各キャラで「テンポ・リーチ・火力・色・エフェクト種別」を大きく変える。
// anim.sw: 剣の最終回転 (x, y, z)
// anim.lean: 体の傾き (x: ピッチ, z: ロール)
// anim.armSwing: 腕の振り角（右腕基準、左は対称）
// next: 連打時に派生する次の攻撃キー
// hitFx: 'note' (音符) | 'staff' (五線譜) | 'feather' (羽根) | 'default'

// --- 作曲ネコ：軽快・高速・短リーチ・連打型・黄色い音符 ---
// motion: 'spin'(全身回転) | 'pounce'(高くジャンプ) | 'thrust'(突進) | 'flap'(羽ばたき) |
//         'dive'(急降下) | 'rise'(急上昇) | 'spiral'(上昇+回転) | 'flyby'(大ダッシュ) |
//         'slam'(沈み込み→振り下ろし) | 'overhead'(振りかぶり→振り下ろし) | 'sweep'(横半回転) |
//         'uppoint'(剣を高く突き上げ) | undefined(デフォルト)
// impulse: { fwd: 前方向の初速, up: 上方向の初速, spin: 攻撃中に加算する全身回転(rad), spinHz: flap用 }
const ATTACKS_CAT = {
  jab1: {
    duration: 0.16, hitStart: 0.03, hitEnd: 0.10,
    dmg: 6, range: 1.8, arc: Math.PI / 3, kb: 3,
    anim: { sw: [Math.PI / 2, 0, Math.PI / 6], lean: [0.06, 0.05], armSwing: 1.3 },
    motion: 'thrust', impulse: { fwd: 6 },
    next: 'jab2', hitColor: 0xfff8b0, hitFx: 'note', label: '爪',
  },
  jab2: {
    duration: 0.16, hitStart: 0.03, hitEnd: 0.10,
    dmg: 6, range: 1.8, arc: Math.PI / 3, kb: 3,
    anim: { sw: [-Math.PI / 2, 0, -Math.PI / 6], lean: [-0.05, -0.05], armSwing: -1.3 },
    motion: 'thrust', impulse: { fwd: 6 },
    next: 'jab3', hitColor: 0xfff8b0, hitFx: 'note', label: '逆爪',
  },
  jab3: {
    duration: 0.28, hitStart: 0.07, hitEnd: 0.18,
    dmg: 14, range: 2.4, arc: Math.PI / 2.4, kb: 12,
    anim: { sw: [Math.PI / 2.5, Math.PI / 4, Math.PI / 3], lean: [0.18, 0.12], armSwing: 1.8 },
    motion: 'spin', impulse: { fwd: 8, spin: Math.PI * 2 },
    next: null, hitColor: 0xffee70, hitFx: 'note', label: '音符斬り',
  },
  sideTilt: {
    duration: 0.30, hitStart: 0.06, hitEnd: 0.20,
    dmg: 12, range: 2.4, arc: Math.PI / 1.6, kb: 10,
    anim: { sw: [0, Math.PI / 2.5, Math.PI / 3], lean: [0, 0.25], armSwing: 1.5 },
    motion: 'spin', impulse: { spin: Math.PI * 3 },
    next: null, hitColor: 0xfff0a0, hitFx: 'note', label: 'キャットスピン',
  },
  upTilt: {
    duration: 0.32, hitStart: 0.08, hitEnd: 0.22,
    dmg: 12, range: 2.4, arc: Math.PI / 2.5, kb: 12,
    anim: { sw: [-Math.PI / 1.4, 0, 0], lean: [-0.22, 0], armSwing: -1.6 },
    motion: 'upSwing', impulse: { up: 6 },
    next: null, hitColor: 0xa0ffe0, hitFx: 'note', label: '上爪振り',
  },
  downTilt: {
    duration: 0.26, hitStart: 0.07, hitEnd: 0.17,
    dmg: 10, range: 2.2, arc: Math.PI / 2.5, kb: 6,
    anim: { sw: [Math.PI / 1.4, 0, 0], lean: [0.28, 0], armSwing: 1.6 },
    motion: 'downSwing', impulse: { up: -4 },
    next: null, hitColor: 0xffc070, hitFx: 'note', label: '尻尾払い',
  },
  aerial: {
    duration: 0.34, hitStart: 0.10, hitEnd: 0.22,
    dmg: 16, range: 2.6, arc: Math.PI / 2, kb: 12,
    anim: { sw: [Math.PI / 2, Math.PI / 4, Math.PI / 3], lean: [0.12, 0.2], armSwing: 1.8 },
    motion: 'spin', impulse: { spin: Math.PI * 2.5 },
    next: null, hitColor: 0xfff080, hitFx: 'note', label: 'エアスクラッチ',
  },
  aerialUp: {
    duration: 0.30, hitStart: 0.08, hitEnd: 0.20,
    dmg: 14, range: 2.4, arc: Math.PI / 2.4, kb: 14,
    anim: { sw: [-Math.PI / 1.2, 0, 0], lean: [-0.25, 0], armSwing: -1.8 },
    motion: 'upSwing', impulse: { up: 12 },
    next: null, hitColor: 0xbfffff, hitFx: 'note', label: '空上：星屑',
  },
  aerialDown: {
    duration: 0.36, hitStart: 0.10, hitEnd: 0.26,
    dmg: 18, range: 2.6, arc: Math.PI / 2.2, kb: 10,
    anim: { sw: [Math.PI / 1.2, 0, 0], lean: [0.35, 0], armSwing: 2.0 },
    motion: 'downSwing', impulse: { up: -14 },
    next: null, hitColor: 0xffa050, hitFx: 'note', label: '空下：ベース叩き',
  },
  aerialBack: {
    duration: 0.32, hitStart: 0.10, hitEnd: 0.22,
    dmg: 16, range: 2.6, arc: Math.PI / 2, kb: 14,
    anim: { sw: [0, -Math.PI / 2.4, -Math.PI / 3], lean: [0.05, -0.3], armSwing: -1.8 },
    motion: 'sweep', impulse: { fwd: -6, spin: -Math.PI * 1.5 },
    next: null, hitColor: 0xffe080, hitFx: 'note', label: '空後：背面爪',
  },
  sideSmash: {
    duration: 0.55, hitStart: 0.20, hitEnd: 0.40,
    dmg: 28, range: 3.2, arc: Math.PI / 1.6, kb: 22,
    anim: { sw: [0, Math.PI / 2.5, Math.PI / 2], lean: [0.05, 0.42], armSwing: 2.1 },
    motion: 'spin', impulse: { fwd: 10, spin: Math.PI * 4 },
    next: null, hitColor: 0xffd040, hitFx: 'note', label: '音符バースト',
  },
  upSmash: {
    duration: 0.55, hitStart: 0.20, hitEnd: 0.38,
    dmg: 28, range: 3.0, arc: Math.PI / 2.4, kb: 24,
    anim: { sw: [-Math.PI / 1.1, 0, 0], lean: [-0.35, 0], armSwing: -2.0 },
    motion: 'upSwing', impulse: { up: 18 },
    next: null, hitColor: 0xa0f0ff, hitFx: 'note', label: 'ハイノート振り上げ',
  },
  downSmash: {
    duration: 0.55, hitStart: 0.20, hitEnd: 0.38,
    dmg: 28, range: 3.0, arc: Math.PI / 2.2, kb: 16,
    anim: { sw: [Math.PI / 1.05, 0, 0], lean: [0.45, 0], armSwing: 2.0 },
    motion: 'downSwing', impulse: { up: -12 },
    next: null, hitColor: 0xffb050, hitFx: 'note', label: 'ローグルーヴ振り下ろし',
  },
  specialFire: {
    label: '炎の三連弾', cooldown: 0.7,
    bullet: {
      count: 3, spread: 0.22, speed: 48, dmg: 14, life: 1.6, homing: 0,
      radius: 0.45, style: 'fire',
      color: 0xff5a18, coreColor: 0xfff0a0,
    },
  },
};

// --- 先生：重厚・低速・長リーチ・五線譜の青 ---
const ATTACKS_SENSEI = {
  jab1: {
    duration: 0.30, hitStart: 0.10, hitEnd: 0.22,
    dmg: 10, range: 3.0, arc: Math.PI / 2.5, kb: 6,
    anim: { sw: [Math.PI / 2.5, 0, 0], lean: [0.15, 0], armSwing: 1.2 },
    motion: 'thrust', impulse: { fwd: 4 },
    next: 'jab2', hitColor: 0xe8f0ff, hitFx: 'staff', label: '指揮棒1拍',
  },
  jab2: {
    duration: 0.30, hitStart: 0.10, hitEnd: 0.22,
    dmg: 10, range: 3.0, arc: Math.PI / 2.5, kb: 6,
    anim: { sw: [-Math.PI / 2.5, 0, 0], lean: [-0.12, 0], armSwing: -1.2 },
    motion: 'thrust', impulse: { fwd: 4 },
    next: 'jab3', hitColor: 0xe8f0ff, hitFx: 'staff', label: '指揮棒2拍',
  },
  jab3: {
    duration: 0.55, hitStart: 0.28, hitEnd: 0.42,
    dmg: 26, range: 3.6, arc: Math.PI / 2.2, kb: 22,
    anim: { sw: [Math.PI / 1.4, 0, 0], lean: [0.35, 0], armSwing: 2.4 },
    motion: 'overhead', impulse: { up: 4 },
    next: null, hitColor: 0x80b0ff, hitFx: 'staff', label: '指揮棒フィナーレ',
  },
  sideTilt: {
    duration: 0.50, hitStart: 0.18, hitEnd: 0.38,
    dmg: 18, range: 3.8, arc: Math.PI / 1.4, kb: 14,
    anim: { sw: [0, Math.PI / 2.2, Math.PI / 2.2], lean: [0.05, 0.35], armSwing: 1.8 },
    motion: 'sweep', impulse: { spin: Math.PI * 1.0 },
    next: null, hitColor: 0x90c0ff, hitFx: 'staff', label: '楽譜薙ぎ',
  },
  upTilt: {
    duration: 0.45, hitStart: 0.18, hitEnd: 0.34,
    dmg: 18, range: 3.4, arc: Math.PI / 2.4, kb: 16,
    anim: { sw: [-Math.PI / 1.2, 0, 0], lean: [-0.35, 0], armSwing: -2.0 },
    motion: 'upSwing', impulse: { up: 8 },
    next: null, hitColor: 0xb0e0ff, hitFx: 'staff', label: '天指揮',
  },
  downTilt: {
    duration: 0.45, hitStart: 0.20, hitEnd: 0.34,
    dmg: 18, range: 3.2, arc: Math.PI / 2.0, kb: 12,
    anim: { sw: [Math.PI / 1.4, 0, 0], lean: [0.4, 0], armSwing: 2.0 },
    motion: 'downSwing', impulse: { up: -10 },
    next: null, hitColor: 0xc0c0e0, hitFx: 'staff', label: '床叩き',
  },
  aerial: {
    duration: 0.55, hitStart: 0.20, hitEnd: 0.38,
    dmg: 24, range: 3.2, arc: Math.PI / 2, kb: 18,
    anim: { sw: [Math.PI / 2.5, Math.PI / 4, Math.PI / 3], lean: [0.15, 0.25], armSwing: 1.8 },
    motion: 'thrust', impulse: { fwd: 10 },
    next: null, hitColor: 0x90b0ff, hitFx: 'staff', label: '楽譜盾突進',
  },
  aerialUp: {
    duration: 0.42, hitStart: 0.14, hitEnd: 0.30,
    dmg: 20, range: 3.0, arc: Math.PI / 2.4, kb: 18,
    anim: { sw: [-Math.PI / 1.15, 0, 0], lean: [-0.35, 0], armSwing: -2.2 },
    motion: 'upSwing', impulse: { up: 14 },
    next: null, hitColor: 0xb0d8ff, hitFx: 'staff', label: '空上：指揮の天井',
  },
  aerialDown: {
    duration: 0.55, hitStart: 0.18, hitEnd: 0.40,
    dmg: 26, range: 3.2, arc: Math.PI / 2.0, kb: 16,
    anim: { sw: [Math.PI / 1.1, 0, 0], lean: [0.4, 0], armSwing: 2.4 },
    motion: 'downSwing', impulse: { up: -18 },
    next: null, hitColor: 0x80a0ff, hitFx: 'staff', label: '空下：四分音符落下',
  },
  aerialBack: {
    duration: 0.45, hitStart: 0.14, hitEnd: 0.32,
    dmg: 22, range: 3.0, arc: Math.PI / 2, kb: 18,
    anim: { sw: [0, -Math.PI / 2.0, -Math.PI / 3], lean: [0.05, -0.35], armSwing: -2.0 },
    motion: 'sweep', impulse: { fwd: -8, spin: -Math.PI * 1.2 },
    next: null, hitColor: 0xa0c0ff, hitFx: 'staff', label: '空後：背面拍子',
  },
  specialFire: {
    label: '大火球三連（吸命）', cooldown: 1.0,
    bullet: {
      count: 3, spread: 0.18, speed: 38, dmg: 20, life: 2.0, homing: 0,
      radius: 0.6, style: 'fire',
      color: 0xff4010, coreColor: 0xffe8a0,
      healOnHit: 6, // 先生限定: ヒット1発につきHPを少し回復
    },
  },
  sideSmash: {
    duration: 0.85, hitStart: 0.40, hitEnd: 0.60,
    dmg: 42, range: 4.4, arc: Math.PI / 1.3, kb: 30,
    anim: { sw: [0, Math.PI / 2, Math.PI / 1.8], lean: [0.08, 0.55], armSwing: 2.6 },
    motion: 'sweep', impulse: { spin: Math.PI * 1.4, fwd: 4 },
    next: null, hitColor: 0x5080ff, hitFx: 'staff', label: 'マエストロ一閃',
  },
  upSmash: {
    duration: 0.85, hitStart: 0.40, hitEnd: 0.60,
    dmg: 42, range: 3.6, arc: Math.PI / 2.2, kb: 32,
    anim: { sw: [-Math.PI / 1.05, 0, 0], lean: [-0.45, 0], armSwing: -2.3 },
    motion: 'upSwing', impulse: { up: 18 },
    next: null, hitColor: 0x80c0ff, hitFx: 'staff', label: '天上指揮',
  },
  downSmash: {
    duration: 0.85, hitStart: 0.45, hitEnd: 0.62,
    dmg: 42, range: 3.8, arc: Math.PI / 2, kb: 26,
    anim: { sw: [Math.PI / 1.05, 0, 0], lean: [0.5, 0], armSwing: 2.4 },
    motion: 'downSwing', impulse: { up: -14 },
    next: null, hitColor: 0x6090e0, hitFx: 'staff', label: '床震指揮',
  },
};

// --- フクロウ音符：機動的・打ち上げ多め・羽根の紫 ---
const ATTACKS_OWL = {
  jab1: {
    duration: 0.20, hitStart: 0.05, hitEnd: 0.13,
    dmg: 8, range: 2.0, arc: Math.PI / 3, kb: 4,
    anim: { sw: [Math.PI / 2.2, 0, 0], lean: [0.1, 0], armSwing: 1.4 },
    motion: 'thrust', impulse: { fwd: 7 },
    next: 'jab2', hitColor: 0xd0a0ff, hitFx: 'feather', label: 'くちばし突き',
  },
  jab2: {
    duration: 0.20, hitStart: 0.05, hitEnd: 0.13,
    dmg: 8, range: 2.0, arc: Math.PI / 3, kb: 4,
    anim: { sw: [-Math.PI / 2.2, 0, 0], lean: [-0.08, 0], armSwing: -1.4 },
    motion: 'thrust', impulse: { fwd: 7 },
    next: 'jab3', hitColor: 0xd0a0ff, hitFx: 'feather', label: '二の突き',
  },
  jab3: {
    duration: 0.34, hitStart: 0.12, hitEnd: 0.24,
    dmg: 18, range: 2.8, arc: Math.PI / 2.4, kb: 16,
    anim: { sw: [Math.PI / 1.8, 0, Math.PI / 3], lean: [0.3, 0.15], armSwing: 1.9 },
    motion: 'dive', impulse: { up: -10, fwd: 8 },
    next: null, hitColor: 0xa080ff, hitFx: 'feather', label: '急降下フィニッシュ',
  },
  sideTilt: {
    duration: 0.40, hitStart: 0.08, hitEnd: 0.32,
    dmg: 14, range: 2.8, arc: Math.PI / 1.8, kb: 10,
    anim: { sw: [0, Math.PI / 2.2, Math.PI / 2.5], lean: [0.05, 0.3], armSwing: 1.7 },
    motion: 'flap', impulse: { up: 4 },
    next: null, hitColor: 0xc0a0ff, hitFx: 'feather', label: '翼一閃',
  },
  upTilt: {
    duration: 0.34, hitStart: 0.10, hitEnd: 0.24,
    dmg: 14, range: 2.6, arc: Math.PI / 2.4, kb: 18,
    anim: { sw: [-Math.PI / 1.3, 0, 0], lean: [-0.3, 0], armSwing: -1.8 },
    motion: 'upSwing', impulse: { up: 12 },
    next: null, hitColor: 0x90c0ff, hitFx: 'feather', label: '上空舞い',
  },
  downTilt: {
    duration: 0.32, hitStart: 0.10, hitEnd: 0.22,
    dmg: 14, range: 2.8, arc: Math.PI / 2.4, kb: 10,
    anim: { sw: [Math.PI / 1.3, 0, 0], lean: [0.36, 0], armSwing: 1.8 },
    motion: 'downSwing', impulse: { up: -10 },
    next: null, hitColor: 0x9070d0, hitFx: 'feather', label: '急降下キック',
  },
  aerial: {
    duration: 0.42, hitStart: 0.10, hitEnd: 0.30,
    dmg: 20, range: 3.0, arc: Math.PI / 1.8, kb: 16,
    anim: { sw: [Math.PI / 2, Math.PI / 3, Math.PI / 3], lean: [0.15, 0.25], armSwing: 1.9 },
    motion: 'flap', impulse: { up: 6 },
    next: null, hitColor: 0xb090ff, hitFx: 'feather', label: 'シャドウクロー',
  },
  aerialUp: {
    duration: 0.30, hitStart: 0.08, hitEnd: 0.22,
    dmg: 16, range: 2.6, arc: Math.PI / 2.4, kb: 18,
    anim: { sw: [-Math.PI / 1.15, 0, 0], lean: [-0.3, 0], armSwing: -2.0 },
    motion: 'upSwing', impulse: { up: 16 },
    next: null, hitColor: 0xc0a0ff, hitFx: 'feather', label: '空上：螺旋羽根',
  },
  aerialDown: {
    duration: 0.36, hitStart: 0.12, hitEnd: 0.26,
    dmg: 22, range: 2.8, arc: Math.PI / 2.0, kb: 12,
    anim: { sw: [Math.PI / 1.15, 0, 0], lean: [0.4, 0], armSwing: 2.0 },
    motion: 'downSwing', impulse: { up: -20 },
    next: null, hitColor: 0x7040b0, hitFx: 'feather', label: '空下：蜜月急襲',
  },
  aerialBack: {
    duration: 0.34, hitStart: 0.10, hitEnd: 0.24,
    dmg: 18, range: 2.8, arc: Math.PI / 1.9, kb: 16,
    anim: { sw: [0, -Math.PI / 2.2, -Math.PI / 3], lean: [0.05, -0.3], armSwing: -1.9 },
    motion: 'sweep', impulse: { fwd: -6, spin: -Math.PI * 1.4 },
    next: null, hitColor: 0xa080ff, hitFx: 'feather', label: '空後：背面風切り',
  },
  specialFire: {
    label: '誘導炎弾三連', cooldown: 0.7,
    bullet: {
      count: 3, spread: 0.28, speed: 50, dmg: 12, life: 1.6, homing: 0.45,
      radius: 0.42, style: 'fire',
      color: 0xff6a30, coreColor: 0xfff2c0,
    },
  },
  sideSmash: {
    duration: 0.60, hitStart: 0.20, hitEnd: 0.48,
    dmg: 32, range: 3.6, arc: Math.PI / 1.6, kb: 22,
    anim: { sw: [0, Math.PI / 2.2, Math.PI / 2], lean: [0.08, 0.45], armSwing: 2.2 },
    motion: 'flyby', impulse: { fwd: 22, spin: Math.PI * 1.5 },
    next: null, hitColor: 0x7040c0, hitFx: 'feather', label: 'フライバイ',
  },
  upSmash: {
    duration: 0.65, hitStart: 0.22, hitEnd: 0.50,
    dmg: 32, range: 3.0, arc: Math.PI / 2.0, kb: 30,
    anim: { sw: [-Math.PI / 1.05, 0, 0], lean: [-0.38, 0], armSwing: -2.1 },
    motion: 'upSwing', impulse: { up: 20 },
    next: null, hitColor: 0xa080ff, hitFx: 'feather', label: '螺旋上昇',
  },
  downSmash: {
    duration: 0.60, hitStart: 0.22, hitEnd: 0.46,
    dmg: 32, range: 3.6, arc: Math.PI / 2.2, kb: 20,
    anim: { sw: [Math.PI / 1.05, 0, 0], lean: [0.42, 0], armSwing: 2.1 },
    motion: 'downSwing', impulse: { up: -22 },
    next: null, hitColor: 0x6040b0, hitFx: 'feather', label: 'ダイブボム',
  },
};

const ATTACK_SETS = {
  cat_neko: ATTACKS_CAT,
  sensei:   ATTACKS_SENSEI,
  owl_oto:  ATTACKS_OWL,
};

// デフォルト（互換用）。getAttackData は this.attackSetId を見て切替。
const ATTACKS = ATTACKS_CAT;

const COMBO_WINDOW_AFTER_HIT = 0.25; // 攻撃終了後に次の派生を受け付ける秒数

export class Player {
  constructor(characterGroup, options = {}) {
    this.object = characterGroup;
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.fireCooldown = 0;
    this.specialCooldown = 0;     // KeyB 特殊技用クールダウン
    this.ufoLightningCooldown = 0; // UFO搭乗中の KeyB 雷攻撃クールダウン
    // 連射/攻撃速度ブースト（パワーアップアイテム用）
    // 残時間が 0 より大きい間、fireCooldown と specialCooldown を fireRateMul 倍に短縮する
    this.fireRateMul = 1;
    this.fireBoostTimer = 0;
    // 武器ピックアップ：弾の威力倍率（projectile 側で this.bulletDmgMul を読み取って乗算）
    this.bulletDmgMul = 1;
    this.weaponBoostTimer = 0;
    // 乗り物ピックアップ：移動速度倍率（XZ/上下クランプに乗算）
    this.moveSpeedMul = 1;
    this.vehicleBoostTimer = 0;

    // ---- 装備系(武器・盾・乗り物) ----
    this.equippedWeapon = null;       // weapons.js のカタログ entry(剣/銃/杖)
    this.equippedWeaponModel = null;  // armR にぶら下げる THREE.Object3D
    this.weaponTimer = 0;
    this.equippedShield = null;       // shield catalog entry
    this.equippedShieldModel = null;
    this.shieldTimer = 0;
    this.shieldHp = 0;
    this.shieldReflect = 0;
    this.dmgReduce = 0;               // 盾効果(0〜1)
    this.mountedVehicle = null;       // vehicles.js のカタログ entry
    this.mountedVehicleModel = null;  // object 直下にぶら下げる THREE.Object3D
    this.mountTimer = 0;
    // ドラゴン火炎放射(KeyB)
    this.dragonFireTimer = 0;         // 演出(顎開け)残り時間(秒)
    this.dragonFireCooldown = 0;      // 再使用クールダウン
    this.dragonFireballsLeft = 0;     // 火の玉バーストの残弾
    this.dragonFireballTimer = 0;     // 次弾までの間隔タイマー
    this._dragonFireSpawnAcc = 0;     // 弾スポーン用アキュムレータ
    this._dragonExhaustAcc = 0;       // レッドドラゴンのエンジン後方噴射用
    // スカイボード追い風(Shift中に発動): 後方に風の帯を吐いて範囲ダメージ
    this._skyBoardWindJet = null;
    this._skyBoardWindDamageAcc = 0;
    // ホバーバイク時間経過加速: 移動継続でチャージが 0→1 に上昇し、停止でリセット
    // charge=1 のとき、hoverBikeベース(+90%)からさらに加速して総速度 +180% になる
    this._hoverBikeCharge = 0;
    // ---- 必殺技 ----
    this.ultimateCharge = 0;          // 0〜100
    this.ultimateMax = 100;
    this.ultimateActive = false;
    this.ultimateTimer = 0;

    this.ownerId = options.ownerId ?? 'player';
    this.bulletColor = options.bulletColor ?? 0xffe066;
    this.attackSetId = options.attackSetId ?? 'cat_neko';

    // HP メモリ制度: デフォ 4 メモリ、オーバーヒール取得で 5 メモリへ
    this.baseSegmentHp = options.baseSegmentHp ?? 33;   // 1メモリあたりの HP
    this.maxSegments = 4;
    this.maxHp = options.maxHp ?? (this.baseSegmentHp * this.maxSegments);
    this.hp = this.maxHp;
    this.alive = true;
    // キャラ固有ベース値（UI 表示用 & 移動スピードスケール）
    this.baseMoveSpeed = options.moveSpeed ?? 6;
    this.baseAttackMul = (options.attack ?? 10) / 10;
    // キャラクター表示倍率（characters.js 側で CHARACTER_SCALE=2.0）に合わせて
    // 当たり判定半径も拡張する
    this.radius = 1.0 * 2.0;

    // 剣ホルダー（_collectLimbs() 後に armR にぶら下げる。armR がなければ object 直下にフォールバック）
    this.swordHolder = new THREE.Group();
    this.sword = createSword();
    this.sword.rotation.x = SWORD_REST_ANGLE;
    this.swordHolder.add(this.sword);
    // 実際の parent 付け替えは _collectLimbs の後 (_attachSwordToArm) で行う

    // 攻撃ステート
    this.currentAttack = null;   // ATTACKS のキー
    this.attackTimer = -1;       // 攻撃経過秒
    this.comboTimer = 0;         // コンボ受付残り
    this.nextBuffered = false;   // 連打バッファ
    this._attackHits = new WeakSet(); // 1攻撃中の重複ヒット防止
    this.attackCooldown = 0;     // 次の攻撃まで
    this._attackSpinTotal = 0;   // 攻撃中に消化する全身回転量(rad)
    this._attackSpinElapsed = 0; // 既に消化した回転量(rad)

    // ダッシュ
    this.dashTimer = -1;
    this.dashCooldown = 0;
    this.dashDir = new THREE.Vector3();
    this._dashWasDown = false;

    // 腕の参照（差し替え時に再収集）
    this._armL = null;
    this._armR = null;
    this._collectLimbs();
    this._attachSwordToArm();

    // 初期スポーン位置を地形の上に揃える
    const groundY0 = getTerrainHeightAt(this.object.position.x, this.object.position.z);
    if (this.object.position.y < groundY0 + 1) this.object.position.y = groundY0 + 3;
  }

  // --- 公開API ---

  getAimDirection() {
    // カメラはプレイヤーの後ろ(+sin(yaw), +cos(yaw))・Yはピッチに対し -sin(pitch) で配置されている
    // → カメラから見た「奥側(=視線方向)」は XZ がプレイヤー前方、Y は +sin(pitch)
    //   こうしないと、見下ろし視点(pitch<0)で弾が上に飛んでしまう
    return new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
  }

  getForwardXZ() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  getMuzzlePosition() {
    const dir = this.getAimDirection();
    const pos = this.object.position.clone();
    // 仕様: キャラクター2倍化に合わせ、銃口の高さ・前方オフセットも2倍
    pos.y += 2.0;
    pos.addScaledVector(dir, 1.6);
    return pos;
  }

  canFire() { return this.alive && this.fireCooldown <= 0; }
  resetFireCooldown(rateScale = 1) { this.fireCooldown = FIRE_COOLDOWN * this.fireRateMul * rateScale; }

  // 連射/攻撃速度ブーストを付与（重ねがけは「より強い倍率」と「より長い残時間」を採用）
  applyFireBoost(mul = 0.5, duration = 8) {
    this.fireRateMul = Math.min(this.fireRateMul, mul);
    this.fireBoostTimer = Math.max(this.fireBoostTimer, duration);
  }

  // ワープ：位置と速度を瞬時に書き換え（速度はリセットして酔いを防ぐ）
  warpTo(position) {
    this.object.position.copy(position);
    this.velocity.set(0, 0, 0);
  }

  // 回復オーブ用：HP を amount だけ回復
  //  - opts.full       : true なら現在の最大HPまで全回復
  //  - opts.overheal   : true なら HP バーのメモリを 1 個追加(最大5)し、
  //                      その分だけ最大HPを増加。現在HPも同量だけ加算。
  //                      amount は無視（メモリ単位で増えるため）
  heal(amount, opts = {}) {
    if (!this.alive) return 0;
    const before = this.hp;
    if (opts && opts.overheal) {
      // すでに5メモリの場合はメモリ追加はせず、満タンまで回復のみ
      if (this.maxSegments < 5) {
        this.maxSegments += 1;
        this.maxHp += this.baseSegmentHp;
        this.hp += this.baseSegmentHp;
      } else {
        this.hp = Math.min(this.maxHp, this.hp + amount);
      }
      return this.hp - before;
    }
    if (opts && opts.full) {
      this.hp = this.maxHp;
      return this.hp - before;
    }
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }

  // 武器ピックアップ：弾威力倍率と連射倍率を同時にブースト
  // 重ねがけは「より強い倍率」と「より長い残時間」を採用
  applyWeaponBoost(dmgMul = 1.6, fireMul = 0.6, duration = 10) {
    this.bulletDmgMul = Math.max(this.bulletDmgMul, dmgMul);
    this.weaponBoostTimer = Math.max(this.weaponBoostTimer, duration);
    // 連射側は applyFireBoost と同じロジック
    this.fireRateMul = Math.min(this.fireRateMul, fireMul);
    this.fireBoostTimer = Math.max(this.fireBoostTimer, duration);
  }

  // 乗り物ピックアップ：移動速度倍率をブースト
  applyVehicleBoost(speedMul = 1.6, duration = 12) {
    this.moveSpeedMul = Math.max(this.moveSpeedMul, speedMul);
    this.vehicleBoostTimer = Math.max(this.vehicleBoostTimer, duration);
  }

  // ===== 武器装備 ===========================================================
  // weaponCfg: { id, name, factory, dmgMul, fireMul, duration, projectileStyle, ... }
  equipWeapon(weaponCfg) {
    if (!weaponCfg) return;
    // 旧モデル外し
    if (this.equippedWeaponModel && this.equippedWeaponModel.parent) {
      this.equippedWeaponModel.parent.remove(this.equippedWeaponModel);
    }
    // デフォルト剣を非表示にし、新モデルを armR(_armR) にぶら下げる
    if (this.sword) this.sword.visible = false;
    const model = weaponCfg.factory ? weaponCfg.factory() : null;
    if (model) {
      // 持ち手として armR にアタッチ(swordHolder の親)
      const parent = (this.swordHolder && this.swordHolder.parent) ? this.swordHolder.parent : this.object;
      parent.add(model);
      // 武器ごとに少し位置補正
      model.position.set(0, -0.4, 0.0);
      model.rotation.set(SWORD_REST_ANGLE, 0, 0);
      this.equippedWeaponModel = model;
    }
    this.equippedWeapon = weaponCfg;
    this.weaponTimer = weaponCfg.duration ?? 25;
    // 既存の倍率ブーストにも反映(連射と威力)
    this.applyWeaponBoost(weaponCfg.dmgMul ?? 1.5, weaponCfg.fireMul ?? 0.7, weaponCfg.duration ?? 25);
  }

  _unequipWeapon() {
    if (this.equippedWeaponModel && this.equippedWeaponModel.parent) {
      this.equippedWeaponModel.parent.remove(this.equippedWeaponModel);
    }
    this.equippedWeaponModel = null;
    this.equippedWeapon = null;
    if (this.sword) this.sword.visible = true;
  }

  // ===== 盾装備 =============================================================
  equipShield(shieldCfg) {
    if (!shieldCfg) return;
    if (this.equippedShieldModel && this.equippedShieldModel.parent) {
      this.equippedShieldModel.parent.remove(this.equippedShieldModel);
    }
    // 簡易シールドビジュアル(プレイヤーの周りに半透明オーラ + 小型盾モデル)
    const group = new THREE.Group();
    // 周囲のオーラ(防御フィールド)
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 24, 16),
      new THREE.MeshBasicMaterial({
        color: shieldCfg.color, transparent: true, opacity: 0.18, side: THREE.DoubleSide,
      })
    );
    group.add(aura);
    // 左腕側に小型の盾モデル
    try {
      const local = makeShieldVisual(shieldCfg);
      local.scale.set(0.5, 0.5, 0.5);
      local.position.set(-0.6, 0.4, 0.3);
      group.add(local);
    } catch (e) { /* fallback: aura only */ }
    this.object.add(group);
    this.equippedShieldModel = group;
    this.equippedShield = shieldCfg;
    this.shieldTimer = shieldCfg.duration ?? 30;
    this.shieldHp = shieldCfg.hp ?? 100;
    this.shieldReflect = shieldCfg.reflect ?? 0;
    this.dmgReduce = shieldCfg.dmgReduce ?? 0.3;
  }

  _unequipShield() {
    if (this.equippedShieldModel && this.equippedShieldModel.parent) {
      this.equippedShieldModel.parent.remove(this.equippedShieldModel);
    }
    this.equippedShieldModel = null;
    this.equippedShield = null;
    this.shieldTimer = 0;
    this.shieldHp = 0;
    this.shieldReflect = 0;
    this.dmgReduce = 0;
  }

  // ===== 乗り物搭乗 =========================================================
  mountVehicle(vehicleCfg) {
    if (!vehicleCfg) return;
    if (this.mountedVehicleModel && this.mountedVehicleModel.parent) {
      this.mountedVehicleModel.parent.remove(this.mountedVehicleModel);
    }
    const model = vehicleCfg.factory ? vehicleCfg.factory() : null;
    if (model) {
      const s = vehicleCfg.scale ?? 1;
      model.scale.set(s, s, s);
      // プレイヤー(object)に乗せる: オフセットで自然な位置に
      model.position.set(0, vehicleCfg.playerOffsetY ?? -0.4, vehicleCfg.playerOffsetZ ?? 0);
      this.object.add(model);
      this.mountedVehicleModel = model;
    }
    this.mountedVehicle = vehicleCfg;
    this.mountTimer = vehicleCfg.duration ?? 20;
    this.applyVehicleBoost(vehicleCfg.speedMul ?? 1.8, vehicleCfg.duration ?? 20);
  }

  _unmountVehicle() {
    if (this.mountedVehicleModel && this.mountedVehicleModel.parent) {
      this.mountedVehicleModel.parent.remove(this.mountedVehicleModel);
    }
    this.mountedVehicleModel = null;
    this.mountedVehicle = null;
    this.mountTimer = 0;
  }

  // ===== ラウンドリセット =================================================
  // バトル終了時に効果・装備・バフ・最大HPをリセットする
  // 必殺技ゲージ(ultimateCharge) は仕様により保持する
  resetForNewBattle(opts = {}) {
    // 装備系を全部はずす
    this._unequipWeapon();
    this._unequipShield();
    this._unmountVehicle();
    // バフ系倍率/タイマー全リセット
    this.bulletDmgMul = 1;
    this.weaponBoostTimer = 0;
    this.fireRateMul = 1;
    this.fireBoostTimer = 0;
    this.moveSpeedMul = 1;
    this.vehicleBoostTimer = 0;
    // 盾関連
    this.shieldHp = 0;
    this.shieldReflect = 0;
    this.dmgReduce = 0;
    this.shieldTimer = 0;
    // メモリ数をデフォ(4)に戻し、最大HPを再計算する(オーバーヒール解除)
    if (typeof opts.baseSegmentHp === 'number') {
      this.baseSegmentHp = opts.baseSegmentHp;
    }
    this.maxSegments = 4;
    this.maxHp = (typeof opts.maxHp === 'number') ? opts.maxHp : (this.baseSegmentHp * this.maxSegments);
    this.hp = this.maxHp;
    this.alive = true;
    // ドラゴンファイアタイマーも消しておく
    this.dragonFireTimer = 0;
    this.dragonFireCooldown = 0;
    this.dragonFireballsLeft = 0;
    this.dragonFireballTimer = 0;
    this._dragonFireSpawnAcc = 0;
    // ultimateCharge は意図的に残す
  }

  // ===== ダメージ受け(盾を経由) ============================================
  // 戻り値: 実際に体力に通ったダメージ量
  takeDamage(amount, opts = {}) {
    if (!this.alive) return 0;
    let dmg = amount;
    if (this.equippedShield && this.shieldHp > 0) {
      const reduced = dmg * (this.dmgReduce ?? 0);
      this.shieldHp -= reduced + dmg * 0.3; // 盾自体も削れる
      dmg = Math.max(0, dmg - reduced);
      // 盾で防いだ瞬間の金属音
      if (reduced > 0 && opts.audio && typeof opts.audio.shieldBlock === 'function') {
        opts.audio.shieldBlock(this.equippedShield);
      }
      if (this.shieldHp <= 0) this._unequipShield();
    }
    this.hp -= dmg;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return dmg;
  }

  // ===== 必殺技 =============================================================
  addUltimateCharge(v) {
    if (!this.alive) return;
    this.ultimateCharge = Math.min(this.ultimateMax, this.ultimateCharge + v);
  }
  isUltimateReady() { return this.ultimateCharge >= this.ultimateMax && !this.ultimateActive; }
  consumeUltimate() {
    if (!this.isUltimateReady()) return false;
    this.ultimateCharge = 0;
    this.ultimateActive = true;
    this.ultimateTimer = 3.5;
    return true;
  }

  // --- レッドドラゴン特殊技（KeyB）: 巨大火の玉を0.5秒間隔で3連射 ---
  // 1発のダメージは通常弾(BULLET_DAMAGE=10)の2倍。
  // 戻り値: true = バースト開始した / false = 開始できない
  tryStartDragonFire(projectiles, audio) {
    if (!this.alive) return false;
    if (!this.mountedVehicle || this.mountedVehicle.id !== 'veh_dragon') return false;
    if (this.dragonFireballsLeft > 0) return false;   // 連射中
    if (this.dragonFireTimer > 0) return false;       // 演出中
    if (this.dragonFireCooldown > 0) return false;    // クールダウン中
    this.dragonFireballsLeft = 3;
    this.dragonFireballTimer = 0;   // 次フレームで即1発目
    this.dragonFireTimer = 1.2;     // 顎開けアニメ用(3発目の直後まで)
    return true;
  }

  // --- 火の玉バースト進行: main.js のループから毎フレーム呼ぶ ---
  updateDragonFireballs(dt, projectiles, audio) {
    if (!this.dragonFireballsLeft) return;
    this.dragonFireballTimer -= dt;
    if (this.dragonFireballTimer > 0) return;

    // 発射起点: ドラゴンの口(なければプレイヤー前方)
    const aim = this.getAimDirection();
    const pos = this.object.position.clone();
    const mouthObj = this.mountedVehicleModel?.userData?.mouth;
    if (mouthObj) {
      mouthObj.getWorldPosition(pos);
      pos.addScaledVector(aim, 1.6); // 巨大化に合わせ頭にめり込まないよう前へ
    } else {
      pos.y += 1.6;
      pos.addScaledVector(aim, 1.0);
    }

    projectiles.spawn(pos, aim, 0xff5522, this.ownerId, {
      speed: 42,
      dmg: 50,          // 火の玉ダメージ50
      life: 3.5,
      radius: 2.0,      // 超巨大な火の玉(2まわり拡大)
      style: 'fire',
      coreColor: 0xffe680,
    });
    if (audio && typeof audio.dragonFireball === 'function') audio.dragonFireball();
    else if (audio && typeof audio.fire === 'function') audio.fire();

    this.dragonFireballsLeft--;
    this.dragonFireballTimer = 0.5; // 次弾まで0.5秒
  }

  // 噴射中フラグ
  isDragonFiring() { return this.dragonFireTimer > 0; }

  // --- UFO 搭乗中の KeyB: 真下に雷を落とす ---
  // 戻り値: true = 発動した / false = 発動できない
  tryUfoLightning(effects, enemies, audio) {
    if (!this.alive) return false;
    if (!this.mountedVehicle || this.mountedVehicle.id !== 'veh_ufo') return false;
    if (this.ufoLightningCooldown > 0) return false;
    if (!effects || typeof effects.spawnLightningStrike !== 'function') return false;
    // クールダウン: 0.55秒に1発（伝説強化で連射性も微UP）
    this.ufoLightningCooldown = 0.55;
    // 落雷地点: 自機の真下（地面高さ0想定）
    const pos = this.object.position;
    const groundY = 0;
    const groundPos = { x: pos.x, y: groundY, z: pos.z };
    // 視覚エフェクト: 機体→地面の落雷（伝説強化: 中央 + 周囲4本の同時落雷）
    effects.spawnLightningStrike(
      { x: pos.x, y: pos.y, z: pos.z },
      groundPos,
      0x88e0ff
    );
    // 周囲にもサテライト落雷を散らして「面で叩く」感を出す（一回り大きく）
    const satOffsets = [
      { x: 4.5, z: 0 }, { x: -4.5, z: 0 },
      { x: 0, z: 4.5 }, { x: 0, z: -4.5 },
      { x: 3.2, z: 3.2 }, { x: -3.2, z: 3.2 },
      { x: 3.2, z: -3.2 }, { x: -3.2, z: -3.2 },
    ];
    for (const o of satOffsets) {
      const jitterX = (Math.random() - 0.5) * 1.8;
      const jitterZ = (Math.random() - 0.5) * 1.8;
      const satTop = { x: pos.x + o.x + jitterX, y: pos.y - 1.0, z: pos.z + o.z + jitterZ };
      const satGround = { x: satTop.x, y: groundY, z: satTop.z };
      effects.spawnLightningStrike(satTop, satGround, 0xb6f0ff);
    }
    // 視覚エフェクト: 機体の頭上へ昇る雷柱（伝説強化で長く）
    if (typeof effects.spawnLightningPillarUp === 'function') {
      effects.spawnLightningPillarUp(
        { x: pos.x, y: pos.y + 0.5, z: pos.z },
        28,
        0x88e0ff
      );
    }
    // 範囲ダメージ（自分以外）— 伝説強化: 範囲 10→14、威力 58→75
    const radius = 14;
    const dmg = 75;
    if (enemies && enemies.length) {
      for (const e of enemies) {
        if (!e || !e.alive) continue;
        if (e.ownerId === this.ownerId) continue;
        const dx = e.object.position.x - pos.x;
        const dz = e.object.position.z - pos.z;
        const flat = Math.sqrt(dx * dx + dz * dz);
        if (flat <= radius) {
          e.takeDamage?.(dmg);
        }
      }
    }
    if (audio && typeof audio.ufoLightning === 'function') audio.ufoLightning();
    else if (audio && typeof audio.fire === 'function') audio.fire();
    return true;
  }

  // ---- 手続き型の炎テクスチャ生成（radial gradient + 若干のノイズ）----
  // 一度生成してキャッシュし、全ての炎スプライトで共有する
  _getFireTexture() {
    if (Player._fireTextureCache) return Player._fireTextureCache;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    // 中心が白、外側に向けて黄→オレンジ→赤→透明
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.00, 'rgba(255,255,255,1.0)');
    g.addColorStop(0.10, 'rgba(255,246,210,0.95)');
    g.addColorStop(0.25, 'rgba(255,205,120,0.80)');
    g.addColorStop(0.45, 'rgba(255,135,50,0.55)');
    g.addColorStop(0.70, 'rgba(220,60,20,0.28)');
    g.addColorStop(1.00, 'rgba(120,20,0,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // 軽くノイズ状の粒を上書きしてリアル感
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      img.data[i]     = Math.max(0, Math.min(255, img.data[i]     + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.7));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.4));
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    Player._fireTextureCache = tex;
    return tex;
  }

  // 炎ストリーム(スプライト群)の生成ヘルパー
  // 引数: length ストリーム全長(単位ユニット)
  // 戻り値: { group, sprites, length }
  _buildFlameStream(length = 14, spriteCount = 26) {
    const tex = this._getFireTexture();
    const group = new THREE.Group();
    group.visible = false;
    const sprites = [];
    const step = length / (spriteCount - 1);
    for (let i = 0; i < spriteCount; i++) {
      const t = i / (spriteCount - 1);
      // 色: 根元(白熱) → 黄 → オレンジ → 深赤(先端)
      // t=0 に近いほど白/黄、t=1 に近いほど赤/暗
      let color;
      if (t < 0.15) color = 0xffffff;
      else if (t < 0.30) color = 0xfff4b0;
      else if (t < 0.45) color = 0xffcc55;
      else if (t < 0.60) color = 0xff9a2a;
      else if (t < 0.78) color = 0xff5a1a;
      else color = 0xd42a10;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const sprite = new THREE.Sprite(mat);
      // 根元は太く、中央付近で最大、先端に向けて再び細くなる
      const bulge = Math.sin((0.15 + t * 0.85) * Math.PI); // 中盤ふくらむ
      const baseSize = 1.9 + bulge * 1.2 - t * 0.8;
      sprite.scale.set(baseSize, baseSize, 1);
      // ローカル +Z 方向に伸びる（Three.jsのGroup.lookAtは+Zを対象に向ける）
      sprite.position.set(0, 0, i * step);
      // 1スプライトあたり3枚重ねて厚みを出す（重なり演出のため2つコピーを追加）
      sprites.push({ sprite, baseSize, offset: i, tRatio: t });
      group.add(sprite);
    }
    // さらに揺らぎ用の外周炎(小さめ大量)を上乗せ
    const wispCount = 30;
    const wisps = [];
    for (let i = 0; i < wispCount; i++) {
      const t = Math.random();
      const color = (t < 0.35) ? 0xffe08a : (t < 0.7) ? 0xff8830 : 0xd83010;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const sprite = new THREE.Sprite(mat);
      const baseSize = 0.7 + Math.random() * 1.1;
      sprite.scale.set(baseSize, baseSize, 1);
      // ランダムに全長に沿って散らす（+Z方向）
      const z = t * length;
      sprite.position.set((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.0, z);
      wisps.push({ sprite, baseSize, tRatio: t, phase: Math.random() * Math.PI * 2 });
      group.add(sprite);
    }
    return { group, sprites, wisps, length };
  }

  // ドラゴン火炎放射: 連続する炎ストリーム(スプライト群) + 円錐範囲ダメージ
  _ensureDragonFlameJet(scene) {
    if (this._dragonFlameJet || !scene) return;
    const stream = this._buildFlameStream(18, 34); // 大型ドラゴン用に延長
    scene.add(stream.group);
    this._dragonFlameJet = stream;
    this._dragonFlameDamageAcc = 0;
  }

  updateDragonFireSpray(dt, scene, enemies) {
    this._ensureDragonFlameJet(scene);
    const jet = this._dragonFlameJet;
    if (!jet) return;

    if (this.dragonFireTimer <= 0) {
      jet.group.visible = false;
      if (jet.light) jet.light.intensity = 0;
      return;
    }

    // ---- ストリームの位置/向きを狙い方向に合わせる ----
    // three.js の Object3D(非Camera) の lookAt は local +Z が対象方向を向く。
    // sprite は +Z に並ぶので lookAt(basePos+aim) で aim 方向に炎が伸びる。
    // 火炎はキャラの口元(体の前面)から出す: getMuzzlePosition は前方 1.6 も
    // 前に出るため、火炎起点として遠すぎる(体との間に空白ができる)。
    // ここでは頭〜口の高さ(y+1.6)+ 前方わずか(0.3)を火炎の起点にする。
    const aim = this.getAimDirection();
    // ---- 発射起点: ドラゴンの口(モデルの userData.mouth)から出す ----
    // 口の Object3D をワールド座標に変換して起点にする。
    // 万一モデルに口が無い場合は従来のプレイヤー口元にフォールバック。
    const basePos = this.object.position.clone();
    const mouth = this.mountedVehicleModel?.userData?.mouth;
    if (mouth) {
      mouth.getWorldPosition(basePos);
      // 口の少し前から出して頭部と炎の重なりを防ぐ
      basePos.addScaledVector(aim, 0.4);
    } else {
      const fwd = this.getForwardXZ();
      basePos.y += 1.6;
      basePos.addScaledVector(fwd, 0.3);
    }
    jet.group.position.copy(basePos);
    const target = basePos.clone().add(aim);
    jet.group.lookAt(target);
    // 大型ドラゴンに合わせて火炎も太く
    jet.group.scale.set(2.6, 2.6, 1.15);
    jet.group.visible = true;

    // ---- 口元の炎ライト(明滅) ----
    if (!jet.light) {
      jet.light = new THREE.PointLight(0xff6622, 0, 26, 1.8);
      scene.add(jet.light);
    }
    jet.light.position.copy(basePos).addScaledVector(aim, 2.5);
    jet.light.intensity = 5.5 + Math.sin(performance.now() * 0.03) * 2.0;

    // ---- 見た目のアニメーション ----
    const time = performance.now() * 0.001;
    for (const n of jet.sprites) {
      const pulse = 1.0 + 0.14 * Math.sin(time * 15 + n.offset * 0.8);
      const size = n.baseSize * pulse;
      n.sprite.scale.set(size, size, 1);
      n.sprite.material.opacity = 0.78 + 0.20 * Math.sin(time * 20 + n.offset * 1.1);
    }
    // 外周の揺らぎ炎: ランダムに位置を再サンプリング
    for (const w of jet.wisps) {
      // 位置を毎フレーム少しずつずらす(生成消滅っぽく)
      w.tRatio += dt * 1.6;
      if (w.tRatio > 1) w.tRatio -= 1;
      const z = w.tRatio * jet.length;
      // 側方に広がるほど広がる (先端ほど広い)
      const spread = 0.4 + w.tRatio * 1.1;
      w.sprite.position.set(
        Math.sin(time * 6 + w.phase) * spread,
        Math.cos(time * 5 + w.phase * 1.3) * spread * 0.7,
        z,
      );
      const pulse = 0.85 + 0.35 * Math.sin(time * 22 + w.phase);
      w.sprite.scale.set(w.baseSize * pulse, w.baseSize * pulse, 1);
      // 消え際
      const fade = Math.sin(w.tRatio * Math.PI);
      w.sprite.material.opacity = 0.55 * fade;
    }

    // ---- 円錐範囲ダメージ ----
    // 大型化に合わせ射程・円錐半角を拡大(半角 0.6rad ≈ 34度)
    const range = jet.length + 3.0;
    const halfAngleCos = Math.cos(0.6);
    this._dragonFlameDamageAcc += dt;
    const damageTick = 0.1;
    while (this._dragonFlameDamageAcc >= damageTick) {
      this._dragonFlameDamageAcc -= damageTick;
      if (enemies && enemies.length) {
        // 大型ドラゴン強化: 130ダメージ/秒
        const dmg = 130 * damageTick;
        for (const e of enemies) {
          if (!e || !e.alive || !e.object) continue;
          if (e.ownerId === this.ownerId) continue;
          const dx = e.object.position.x - basePos.x;
          const dy = e.object.position.y - basePos.y;
          const dz = e.object.position.z - basePos.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > range) continue;
          if (dist < 0.001) { e.takeDamage?.(dmg); continue; }
          const dot = (dx * aim.x + dy * aim.y + dz * aim.z) / dist;
          if (dot >= halfAngleCos) e.takeDamage?.(dmg);
        }
      }
    }
  }

  // --- レッドドラゴンのエンジン後方噴射（移動中は常時オン） ---
  // 前方火炎放射と同じ「炎ストリーム(スプライト群)」を後方に常時展開し、
  // 円錐範囲ダメージも毎フレーム適用する
  _ensureDragonExhaustJet(scene) {
    if (this._dragonExhaustJet || !scene) return;
    const stream = this._buildFlameStream(9, 18); // 前方より短め
    scene.add(stream.group);
    this._dragonExhaustJet = stream;
    this._dragonExhaustDamageAcc = 0;
  }

  updateDragonExhaustFire(dt, scene, enemies) {
    const veh = this.mountedVehicle;
    if (!veh || !veh.dragonExhaustFire) {
      // 乗ってない時はメッシュを隠す
      if (this._dragonExhaustJet) this._dragonExhaustJet.group.visible = false;
      return;
    }
    this._ensureDragonExhaustJet(scene);
    const jet = this._dragonExhaustJet;
    if (!jet) return;

    // 移動判定
    const vx = this.velocity.x;
    const vz = this.velocity.z;
    const flatSp = Math.hypot(vx, vz);
    if (flatSp < 2.0) {
      jet.group.visible = false;
      return;
    }

    // 後方向き = 進行方向の逆
    const backDir = new THREE.Vector3(-vx / flatSp, 0, -vz / flatSp);
    // 発射基準位置: 機体中央のやや上(エンジン付近)
    const baseY = this.object.position.y + 1.6; // 大型ドラゴンの尾部高さ
    const behindOffset = 2.6;                    // 尻尾の後ろから噴射
    const basePos = new THREE.Vector3(
      this.object.position.x + backDir.x * behindOffset,
      baseY,
      this.object.position.z + backDir.z * behindOffset,
    );
    jet.group.position.copy(basePos);
    // sprite が +Z に並ぶストリームなので、backDir 方向に炎を伸ばすには
    // lookAt(basePos + backDir) にする(local +Z が対象を向くため)
    const target = basePos.clone().add(backDir);
    jet.group.lookAt(target);
    jet.group.visible = true;

    // アニメーション
    const time = performance.now() * 0.001;
    for (const n of jet.sprites) {
      const pulse = 1.0 + 0.16 * Math.sin(time * 18 + n.offset * 1.1);
      const size = n.baseSize * pulse;
      n.sprite.scale.set(size, size, 1);
      n.sprite.material.opacity = 0.80 + 0.18 * Math.sin(time * 24 + n.offset * 1.3);
    }
    for (const w of jet.wisps) {
      w.tRatio += dt * 2.0;
      if (w.tRatio > 1) w.tRatio -= 1;
      const z = w.tRatio * jet.length;
      const spread = 0.35 + w.tRatio * 0.9;
      w.sprite.position.set(
        Math.sin(time * 7 + w.phase) * spread,
        Math.cos(time * 6 + w.phase * 1.3) * spread * 0.6,
        z,
      );
      const pulse = 0.85 + 0.35 * Math.sin(time * 25 + w.phase);
      w.sprite.scale.set(w.baseSize * pulse, w.baseSize * pulse, 1);
      const fade = Math.sin(w.tRatio * Math.PI);
      w.sprite.material.opacity = 0.5 * fade;
    }

    // 円錐範囲ダメージ(後方コーン)
    const range = jet.length + 1.5;
    const halfAngleCos = Math.cos(0.42);
    this._dragonExhaustDamageAcc += dt;
    const damageTick = 0.1;
    while (this._dragonExhaustDamageAcc >= damageTick) {
      this._dragonExhaustDamageAcc -= damageTick;
      if (enemies && enemies.length) {
        // 威力 1.5倍(45→67.5 /sec)
        const dmg = 67.5 * damageTick;
        for (const e of enemies) {
          if (!e || !e.alive || !e.object) continue;
          if (e.ownerId === this.ownerId) continue;
          const dx = e.object.position.x - basePos.x;
          const dy = e.object.position.y - basePos.y;
          const dz = e.object.position.z - basePos.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > range) continue;
          if (dist < 0.001) { e.takeDamage?.(dmg); continue; }
          const dot = (dx * backDir.x + dy * backDir.y + dz * backDir.z) / dist;
          if (dot >= halfAngleCos) e.takeDamage?.(dmg);
        }
      }
    }
  }

  // --- スカイボード追い風 ---
  // 風テクスチャ(白青のふわっと帯)を Canvas で生成しキャッシュ
  _getWindTexture() {
    if (Player._windTextureCache) return Player._windTextureCache;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    // 中央にラジアルグラデーション(白コア→水色→透明)
    const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    grad.addColorStop(0.0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(200,235,255,0.85)');
    grad.addColorStop(0.7, 'rgba(120,180,255,0.35)');
    grad.addColorStop(1.0, 'rgba(80,140,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    Player._windTextureCache = tex;
    return tex;
  }

  // 風ストリーム(スプライト群) 生成
  // 火炎ストリームと同構造。色は白→水色→薄青の寒色寄り。
  _buildWindStream(length = 11, spriteCount = 20) {
    const tex = this._getWindTexture();
    const group = new THREE.Group();
    group.visible = false;
    const sprites = [];
    const step = length / (spriteCount - 1);
    for (let i = 0; i < spriteCount; i++) {
      const t = i / (spriteCount - 1);
      // 根元は白、中央は水色、先端は淡い青
      let color;
      if (t < 0.2) color = 0xffffff;
      else if (t < 0.5) color = 0xd6f0ff;
      else if (t < 0.8) color = 0x8fc4ff;
      else color = 0x5c9dff;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const sprite = new THREE.Sprite(mat);
      const bulge = Math.sin((0.1 + t * 0.9) * Math.PI);
      const baseSize = 1.6 + bulge * 1.1 - t * 0.4;
      sprite.scale.set(baseSize, baseSize, 1);
      // ローカル +Z 方向に伸ばす(lookAtで対象方向に向く)
      sprite.position.set(0, 0, i * step);
      sprites.push({ sprite, baseSize, offset: i, tRatio: t });
      group.add(sprite);
    }
    // 揺らぎ用の外周(渦を表現する小スプライト群)
    const wispCount = 24;
    const wisps = [];
    for (let i = 0; i < wispCount; i++) {
      const t = Math.random();
      const color = (t < 0.4) ? 0xffffff : (t < 0.75) ? 0xbfe2ff : 0x77aaff;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const sprite = new THREE.Sprite(mat);
      const baseSize = 0.55 + Math.random() * 0.9;
      sprite.scale.set(baseSize, baseSize, 1);
      const z = t * length;
      sprite.position.set((Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 0.9, z);
      wisps.push({ sprite, baseSize, tRatio: t, phase: Math.random() * Math.PI * 2 });
      group.add(sprite);
    }
    return { group, sprites, wisps, length };
  }

  _ensureSkyBoardWindJet(scene) {
    if (this._skyBoardWindJet || !scene) return;
    // メインの後方風(太く長く)
    const stream = this._buildWindStream(13, 24);
    scene.add(stream.group);
    // 左右のサイド風(短めで細め)
    const leftStream = this._buildWindStream(9, 16);
    scene.add(leftStream.group);
    const rightStream = this._buildWindStream(9, 16);
    scene.add(rightStream.group);
    this._skyBoardWindJet = stream;
    this._skyBoardWindJetLeft = leftStream;
    this._skyBoardWindJetRight = rightStream;

    // プレイヤーの周りを渦巻く風パーティクル(前方〜横〜後方まで包む)
    const tex = this._getWindTexture();
    const vortexGroup = new THREE.Group();
    vortexGroup.visible = false;
    const vortex = [];
    const vortexCount = 36;
    for (let i = 0; i < vortexCount; i++) {
      const t = i / vortexCount;
      const color = (t < 0.4) ? 0xffffff : (t < 0.75) ? 0xbfe2ff : 0x77aaff;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const sprite = new THREE.Sprite(mat);
      const baseSize = 0.55 + Math.random() * 0.9;
      sprite.scale.set(baseSize, baseSize, 1);
      vortexGroup.add(sprite);
      vortex.push({
        sprite,
        baseSize,
        // 前方(fwdOffset正)〜後方(負)の初期位置
        fwdOffset: -2 + Math.random() * 4.5,
        // 横方向の広がり(左右均等)
        sideOffset: (Math.random() - 0.5) * 2.4,
        // 高さ揺らぎ
        yOffset: (Math.random() - 0.5) * 1.4,
        phase: Math.random() * Math.PI * 2,
        speed: 6 + Math.random() * 4, // 後方へ流れる速度
      });
    }
    scene.add(vortexGroup);
    this._skyBoardWindVortex = { group: vortexGroup, particles: vortex };
  }

  // スカイボード追い風: Shift 押下時 + スカイボード搭乗中に発動。
  // 後方に風の帯を展開し、円錐範囲で継続ダメージを与える。
  updateSkyBoardWind(dt, scene, enemies, input) {
    const veh = this.mountedVehicle;
    const active =
      veh && veh.id === 'veh_skyBoard' &&
      input && (input.isDown?.('ShiftLeft') || input.isDown?.('ShiftRight'));
    if (!active) {
      if (this._skyBoardWindJet) this._skyBoardWindJet.group.visible = false;
      if (this._skyBoardWindJetLeft) this._skyBoardWindJetLeft.group.visible = false;
      if (this._skyBoardWindJetRight) this._skyBoardWindJetRight.group.visible = false;
      if (this._skyBoardWindVortex) this._skyBoardWindVortex.group.visible = false;
      return;
    }
    this._ensureSkyBoardWindJet(scene);
    const jet = this._skyBoardWindJet;
    if (!jet) return;

    // 進行方向を基準に、風は後方に流れる。停止時は視線の後方に。
    const vx = this.velocity.x;
    const vz = this.velocity.z;
    const flatSp = Math.hypot(vx, vz);
    let backDir;
    if (flatSp > 1.5) {
      backDir = new THREE.Vector3(-vx / flatSp, 0, -vz / flatSp);
    } else {
      const aim = this.getAimDirection();
      backDir = new THREE.Vector3(-aim.x, 0, -aim.z);
      if (backDir.lengthSq() < 0.001) backDir.set(0, 0, -1);
      backDir.normalize();
    }
    // 前方向・側方向
    const fwdDir = new THREE.Vector3(-backDir.x, 0, -backDir.z);
    const sideDir = new THREE.Vector3(-backDir.z, 0, backDir.x); // 右手側
    // 発射基準位置: ボード後方少し上
    const baseY = this.object.position.y + 0.4;
    const behindOffset = 0.6;
    const basePos = new THREE.Vector3(
      this.object.position.x + backDir.x * behindOffset,
      baseY,
      this.object.position.z + backDir.z * behindOffset,
    );
    jet.group.position.copy(basePos);
    const target = basePos.clone().add(backDir);
    jet.group.lookAt(target);
    // 追い風なので少し細長め
    jet.group.scale.set(1.2, 1.2, 1.0);
    jet.group.visible = true;

    // アニメーション(高速回転+ゆらぎ)
    const time = performance.now() * 0.001;
    for (const n of jet.sprites) {
      const pulse = 1.0 + 0.12 * Math.sin(time * 22 + n.offset * 1.3);
      const size = n.baseSize * pulse;
      n.sprite.scale.set(size, size, 1);
      n.sprite.material.opacity = 0.45 + 0.20 * Math.sin(time * 30 + n.offset * 1.7);
    }
    for (const w of jet.wisps) {
      w.tRatio += dt * 2.6;
      if (w.tRatio > 1) w.tRatio -= 1;
      const z = w.tRatio * jet.length;
      const spread = 0.35 + w.tRatio * 1.1;
      w.sprite.position.set(
        Math.sin(time * 10 + w.phase) * spread,
        Math.cos(time * 9 + w.phase * 1.2) * spread * 0.7,
        z,
      );
      const pulse = 0.85 + 0.35 * Math.sin(time * 28 + w.phase);
      w.sprite.scale.set(w.baseSize * pulse, w.baseSize * pulse, 1);
      const fade = Math.sin(w.tRatio * Math.PI);
      w.sprite.material.opacity = 0.5 * fade;
    }

    // 左右のサイド風: プレイヤーの横〜前方から後方へ流れる
    const updateSideStream = (streamObj, sideSign) => {
      if (!streamObj) return;
      const pos = new THREE.Vector3(
        this.object.position.x + sideDir.x * (1.3 * sideSign) + fwdDir.x * 0.4,
        baseY + 0.1,
        this.object.position.z + sideDir.z * (1.3 * sideSign) + fwdDir.z * 0.4,
      );
      streamObj.group.position.copy(pos);
      const tgt = pos.clone().add(backDir);
      streamObj.group.lookAt(tgt);
      streamObj.group.scale.set(0.9, 0.9, 1.0);
      streamObj.group.visible = true;
      for (const n of streamObj.sprites) {
        const pulse = 1.0 + 0.14 * Math.sin(time * 24 + n.offset * 1.5);
        const size = n.baseSize * pulse;
        n.sprite.scale.set(size, size, 1);
        n.sprite.material.opacity = 0.4 + 0.22 * Math.sin(time * 28 + n.offset * 1.7);
      }
      for (const w of streamObj.wisps) {
        w.tRatio += dt * 3.0;
        if (w.tRatio > 1) w.tRatio -= 1;
        const z = w.tRatio * streamObj.length;
        const spread = 0.25 + w.tRatio * 0.9;
        w.sprite.position.set(
          Math.sin(time * 11 + w.phase) * spread,
          Math.cos(time * 10 + w.phase * 1.3) * spread * 0.6,
          z,
        );
        const pulse = 0.85 + 0.4 * Math.sin(time * 26 + w.phase);
        w.sprite.scale.set(w.baseSize * pulse, w.baseSize * pulse, 1);
        const fade = Math.sin(w.tRatio * Math.PI);
        w.sprite.material.opacity = 0.55 * fade;
      }
    };
    updateSideStream(this._skyBoardWindJetLeft, -1);
    updateSideStream(this._skyBoardWindJetRight, 1);

    // 渦(Vortex): プレイヤー周囲を包む風の粒。前方から後方へ絶えず流れる
    const vortex = this._skyBoardWindVortex;
    if (vortex) {
      vortex.group.visible = true;
      const px = this.object.position.x;
      const py = this.object.position.y;
      const pz = this.object.position.z;
      for (const p of vortex.particles) {
        // 前→後へ流す
        p.fwdOffset -= p.speed * dt;
        if (p.fwdOffset < -3.5) {
          // 再スポーン: 前方に戻す
          p.fwdOffset = 2.5 + Math.random() * 2.5;
          p.sideOffset = (Math.random() - 0.5) * 2.4;
          p.yOffset = (Math.random() - 0.5) * 1.4;
          p.phase = Math.random() * Math.PI * 2;
        }
        // 横方向のゆらぎ(スパイラル感)
        const swirl = Math.sin(time * 3.5 + p.phase) * 0.4;
        const sx = p.sideOffset + swirl;
        const sy = p.yOffset + Math.cos(time * 3.0 + p.phase) * 0.25;
        p.sprite.position.set(
          px + fwdDir.x * p.fwdOffset + sideDir.x * sx,
          py + 0.7 + sy,
          pz + fwdDir.z * p.fwdOffset + sideDir.z * sx,
        );
        // フェード: 前方は淡く、中央〜後方で濃く
        const t01 = Math.max(0, Math.min(1, (p.fwdOffset + 3.5) / 6.0));
        const fade = Math.sin(t01 * Math.PI); // 中央付近で最大
        p.sprite.material.opacity = 0.65 * fade;
        const pulse = 1.0 + 0.18 * Math.sin(time * 20 + p.phase);
        const sz = p.baseSize * pulse;
        p.sprite.scale.set(sz, sz, 1);
      }
    }

    // 後方円錐範囲ダメージ(火炎に比べ広め・威力低め)
    const range = jet.length + 1.5;
    const halfAngleCos = Math.cos(0.55); // ~31度半角
    this._skyBoardWindDamageAcc += dt;
    const damageTick = 0.1;
    // 体当たり用: プレイヤー自身の位置と接触範囲
    const bodyPos = this.object.position;
    const bodyRange = 1.6; // 体当たり判定半径
    while (this._skyBoardWindDamageAcc >= damageTick) {
      this._skyBoardWindDamageAcc -= damageTick;
      if (enemies && enemies.length) {
        // 30/sec の継続風ダメージ (追い風分)
        const dmg = 30 * damageTick;
        for (const e of enemies) {
          if (!e || !e.alive || !e.object) continue;
          if (e.ownerId === this.ownerId) continue;

          // 体当たり判定 (自分の体に触れている敵には追い風分のダメージ)
          const bx = e.object.position.x - bodyPos.x;
          const by = e.object.position.y - bodyPos.y;
          const bz = e.object.position.z - bodyPos.z;
          const bodyDist = Math.sqrt(bx * bx + by * by + bz * bz);
          const hitByBody = bodyDist <= bodyRange;

          // 後方風の円錐判定
          const dx = e.object.position.x - basePos.x;
          const dy = e.object.position.y - basePos.y;
          const dz = e.object.position.z - basePos.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          let hitByWind = false;
          if (dist <= range) {
            if (dist < 0.001) {
              hitByWind = true;
            } else {
              const dot = (dx * backDir.x + dy * backDir.y + dz * backDir.z) / dist;
              if (dot >= halfAngleCos) hitByWind = true;
            }
          }

          // 体当たり or 風のどちらかで当たっていれば同じダメージを 1 回入れる (二重ヒットは防ぐ)
          if (hitByBody || hitByWind) {
            e.takeDamage?.(dmg);
          }
        }
      }
    }
  }

  // --- 特殊技（KeyB）：キャラごとの specialFire 設定で弾を一斉発射 ---
  // 戻り値: true = 発射した / false = 発射しなかった（クールダウン中など）
  trySpecialFire(projectiles, audio) {
    if (!this.alive) return false;
    if (this.specialCooldown > 0) return false;
    const set = ATTACK_SETS[this.attackSetId] || ATTACKS_CAT;
    const sp = set.specialFire;
    if (!sp || !sp.bullet) return false;

    const b = sp.bullet;
    const baseDir = this.getAimDirection();
    const pos = this.getMuzzlePosition();
    const count = Math.max(1, b.count | 0);
    const spread = b.spread ?? 0;

    for (let i = 0; i < count; i++) {
      // count==1 のときは中央、複数のときは -spread/2 .. +spread/2 に均等分散
      const t = count === 1 ? 0 : (i / (count - 1) - 0.5);
      const yawOff = t * spread;
      const dir = baseDir.clone();
      // ワールド Y 軸まわりに yawOff だけ回転（プレイヤー前方の左右散らし）
      const c = Math.cos(yawOff);
      const s = Math.sin(yawOff);
      const nx = dir.x * c + dir.z * s;
      const nz = -dir.x * s + dir.z * c;
      dir.x = nx; dir.z = nz;
      dir.normalize();

      projectiles.spawn(pos, dir, b.color ?? this.bulletColor, this.ownerId, {
        speed:     b.speed,
        dmg:       b.dmg,
        life:      b.life,
        homing:    b.homing,
        radius:    b.radius,
        style:     b.style,
        coreColor: b.coreColor,
        healOnHit: b.healOnHit, // 先生のB攻撃などで使用
      });
    }

    this.specialCooldown = (sp.cooldown ?? 0.8) * this.fireRateMul;
    if (audio && typeof audio.shoot === 'function') audio.shoot();
    return true;
  }

  isDashing() { return this.dashTimer >= 0; }

  // --- 攻撃 API ---
  // kind: 'light' (KeyX) | 'heavy' (KeyC)
  // input: Input
  tryStartAttack(kind, input) {
    if (!this.alive) return null;
    // 攻撃中ならコンボバッファに溜める
    if (this.attackTimer >= 0) {
      this.nextBuffered = kind;
      return null;
    }
    if (this.attackCooldown > 0) return null;
    const key = this._selectAttack(kind, input);
    if (!key) return null;
    this._beginAttack(key);
    return key;
  }

  _selectAttack(kind, input) {
    const up    = input.isDown('ArrowUp');
    const down  = input.isDown('ArrowDown');
    const left  = input.isDown('KeyA') || input.isDown('ArrowLeft');
    const right = input.isDown('KeyD') || input.isDown('ArrowRight');
    const fwd   = input.isDown('KeyW');
    const back  = input.isDown('KeyS');
    const side  = left || right || fwd || back;
    // 空中判定：地面（y=1）から十分離れていれば空中扱い
    const airborne = this.object.position.y > 3.0;

    if (kind === 'light') {
      // コンボ進行優先
      if (this.comboTimer > 0 && this.currentAttack === null) {
        if (this._lastNext) {
          const k = this._lastNext;
          this._lastNext = null;
          return k;
        }
      }
      // 空中時は空中技に派生
      if (airborne) {
        if (up && !down) return 'aerialUp';
        if (down && !up) return 'aerialDown';
        if (back && !fwd) return 'aerialBack';
        return 'aerial';
      }
      if (up && !down) return 'upTilt';
      if (down && !up) return 'downTilt';
      if (side) return 'sideTilt';
      return 'jab1';
    } else { // heavy
      if (up && !down) return 'upSmash';
      if (down && !up) return 'downSmash';
      if (side) return 'sideSmash';
      return 'aerial';
    }
  }

  _beginAttack(key) {
    this.currentAttack = key;
    this.attackTimer = 0;
    this._attackHits = new WeakSet();
    this.comboTimer = 0;
    this.nextBuffered = false;

    // impulse 適用：前方向ダッシュ・上昇/下降・全身回転
    const d = this.getAttackData();
    if (d && d.impulse) {
      const imp = d.impulse;
      if (imp.fwd) {
        const fwd = this.getForwardXZ();
        this.velocity.addScaledVector(fwd, imp.fwd);
      }
      if (imp.up) {
        this.velocity.y += imp.up;
      }
      // 連続スピン量と所要時間を保存（update で消化）
      this._attackSpinTotal = imp.spin || 0;
      this._attackSpinElapsed = 0;
    } else {
      this._attackSpinTotal = 0;
      this._attackSpinElapsed = 0;
    }
  }

  // 攻撃セット切替（キャラクター固有技に切り替える）
  // stats を渡すとキャラ固有ステータス(最大HP/メモリ/移動速度/攻撃倍率)も同時適用する
  setAttackSet(id, stats = null) {
    if (ATTACK_SETS[id]) this.attackSetId = id;
    if (stats) this.applyCharacterStats(stats);
  }

  // キャラ固有ステータスを適用（バフ倍率はそのまま、ベース値だけ差し替え）
  applyCharacterStats(stats = {}) {
    if (typeof stats.baseSegmentHp === 'number') {
      this.baseSegmentHp = stats.baseSegmentHp;
    }
    // バトル中のキャラ切替でもメモリ数はデフォ(4)維持。最大HP/HPもベースに揃える
    this.maxSegments = 4;
    this.maxHp = (typeof stats.maxHp === 'number') ? stats.maxHp : (this.baseSegmentHp * this.maxSegments);
    // HP は割合維持(死んでなければ)。瀕死で切替して即死を避ける
    if (this.alive) {
      this.hp = Math.min(this.maxHp, this.hp > 0 ? this.hp : this.maxHp);
    } else {
      this.hp = this.maxHp;
      this.alive = true;
    }
    if (typeof stats.moveSpeed === 'number') this.baseMoveSpeed = stats.moveSpeed;
    if (typeof stats.attack === 'number') this.baseAttackMul = stats.attack / 10;
  }

  // 攻撃の現在パラメータ
  getAttackData() {
    if (!this.currentAttack) return null;
    const set = ATTACK_SETS[this.attackSetId] || ATTACKS_CAT;
    return set[this.currentAttack] || null;
  }

  // 現在キャラのラベル一覧（UI から参照）
  getAttackLabels() {
    const set = ATTACK_SETS[this.attackSetId] || ATTACKS_CAT;
    const out = {};
    for (const key of Object.keys(set)) out[key] = set[key].label;
    return out;
  }

  isHitActive() {
    const d = this.getAttackData();
    if (!d) return false;
    return this.attackTimer >= d.hitStart && this.attackTimer <= d.hitEnd;
  }

  hasHit(target) { return this._attackHits && this._attackHits.has(target); }
  markHit(target) { if (this._attackHits) this._attackHits.add(target); }

  // --- レガシー互換（main.js の resolveSword が呼ぶ可能性に備える） ---
  canSwing() { return this.alive && this.attackTimer < 0 && this.attackCooldown <= 0; }
  startSwing() { return !!this.tryStartAttack('light', { isDown: () => false }); }
  isSwingActive() { return this.isHitActive(); }
  get swingTimer() { return this.attackTimer; }
  get __currentSwingHits() { return this._attackHits; }
  set __currentSwingHits(v) { /* compat: 旧コードからの代入は無視（_attackHitsで管理） */ }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  // --- メイン更新 ---
  update(dt, input) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.specialCooldown > 0) this.specialCooldown -= dt;
    if (this.ufoLightningCooldown > 0) this.ufoLightningCooldown -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    // 連射ブースト残時間
    if (this.fireBoostTimer > 0) {
      this.fireBoostTimer -= dt;
      if (this.fireBoostTimer <= 0) {
        this.fireBoostTimer = 0;
        this.fireRateMul = 1;
      }
    }
    // 武器ブースト残時間（弾威力倍率を戻す。連射倍率は fireBoostTimer 側で戻る）
    if (this.weaponBoostTimer > 0) {
      this.weaponBoostTimer -= dt;
      if (this.weaponBoostTimer <= 0) {
        this.weaponBoostTimer = 0;
        this.bulletDmgMul = 1;
      }
    }
    // 乗り物ブースト残時間
    if (this.vehicleBoostTimer > 0) {
      this.vehicleBoostTimer -= dt;
      if (this.vehicleBoostTimer <= 0) {
        this.vehicleBoostTimer = 0;
        this.moveSpeedMul = 1;
      }
    }

    // 装備武器タイマー
    if (this.weaponTimer > 0) {
      this.weaponTimer -= dt;
      if (this.weaponTimer <= 0) this._unequipWeapon();
    }
    // 盾タイマー
    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) this._unequipShield();
    }
    // 搭乗タイマー
    if (this.mountTimer > 0) {
      this.mountTimer -= dt;
      if (this.mountTimer <= 0) this._unmountVehicle();
    }
    // 乗り物アニメーション(ドラゴンの翼はばたき・尻尾・顎など)
    if (this.mountedVehicleModel?.userData?.animate) {
      this.mountedVehicleModel.userData.animate(performance.now() * 0.001, {
        firing: this.dragonFireTimer > 0,
        speed: Math.hypot(this.velocity.x, this.velocity.z),
        flying: this.object.position.y > 1.2,
      });
    }
    // ドラゴン火炎放射タイマー
    if (this.dragonFireTimer > 0) {
      this.dragonFireTimer -= dt;
      if (this.dragonFireTimer <= 0) {
        this.dragonFireTimer = 0;
        this.dragonFireCooldown = 1.2; // 噴射後 1.2 秒は再使用不可
      }
    } else if (this.dragonFireCooldown > 0) {
      this.dragonFireCooldown -= dt;
      if (this.dragonFireCooldown < 0) this.dragonFireCooldown = 0;
    }
    // 必殺技タイマー
    if (this.ultimateActive) {
      this.ultimateTimer -= dt;
      if (this.ultimateTimer <= 0) {
        this.ultimateActive = false;
        this.ultimateTimer = 0;
      }
    }

    // 攻撃タイマー
    if (this.attackTimer >= 0) {
      this.attackTimer += dt;
      const d = this.getAttackData();
      if (d && this.attackTimer >= d.duration) {
        // 攻撃終了：next があればコンボ受付開始
        this._lastNext = d.next;
        this.attackTimer = -1;
        this.currentAttack = null;
        this.attackCooldown = 0.05;
        if (d.next) this.comboTimer = COMBO_WINDOW_AFTER_HIT;
      }
    }
    if (this.comboTimer > 0) this.comboTimer -= dt;
    else this._lastNext = null;

    // バッファされた次入力を消化
    if (this.attackTimer < 0 && this.nextBuffered) {
      const k = this.nextBuffered;
      this.nextBuffered = null;
      this.tryStartAttack(k, input);
    }

    // ダッシュタイマー
    if (this.dashTimer >= 0) {
      this.dashTimer += dt;
      if (this.dashTimer >= DASH_DURATION) {
        this.dashTimer = -1;
      }
    }

    this._updateAttackAnim();

    if (!this.alive) {
      const damp = Math.exp(-DAMPING * dt);
      this.velocity.multiplyScalar(damp);
      this.object.position.addScaledVector(this.velocity, dt);
      // 倒れた後も地形に埋もれないようサンプリング
      const groundYd = getTerrainHeightAt(this.object.position.x, this.object.position.z);
      const minYd = groundYd + 1;
      if (this.object.position.y < minYd) {
        this.object.position.y = minYd;
        if (this.velocity.y < 0) this.velocity.y = 0;
      }
      return;
    }

    // 視点回転（Pointer Lock 中のマウス移動量で yaw/pitch を更新）
    if (input.consumeMouseDelta) {
      const { dx, dy } = input.consumeMouseDelta();
      this.yaw   -= dx * MOUSE_YAW_SENS;
      this.pitch -= dy * MOUSE_PITCH_SENS;
    }
    this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch));

    // 入力ベクトル：
    //  WASD は「カメラの視線方向」に進む(FPS流) — 斜め上を向きながら W を押すと斜め上に進む
    //  ArrowUp/Down は世界基準の上下移動(視点に関係なく純粋に上昇/下降)
    let inputX = 0, inputZ = 0, inputY = 0;
    if (input.isDown('KeyW')) inputZ -= 1;
    if (input.isDown('KeyS')) inputZ += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft'))  inputX -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) inputX += 1;
    if (input.isDown('ArrowUp'))   inputY += 1;
    if (input.isDown('ArrowDown')) inputY -= 1;

    // 前方 = 視線方向(yaw + pitch)、右 = 前方 × 世界up を正規化
    const aim = this.getAimDirection(); // 単位ベクトル(視線方向)
    const forward = aim.clone();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, worldUp);
    if (right.lengthSq() < 1e-6) {
      // ほぼ真上/真下を向いている場合のフォールバック(yaw 基準)
      right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    } else {
      right.normalize();
    }

    const wish = new THREE.Vector3();
    wish.addScaledVector(forward, -inputZ); // -inputZ：W のとき前進
    wish.addScaledVector(right,    inputX);
    // ArrowUp/Down は世界Y方向に加算(視点に依存しない)
    wish.y += inputY;

    // 乗り物リアリティ: 地上専用は上下入力を無効、飛行可は上昇ブースト
    const _veh = this.mountedVehicle;
    if (_veh) {
      if (_veh.groundOnly) {
        // 視線が上下を向いていてもY成分を打ち消す(地表走行)
        wish.y = 0;
      } else if (_veh.flightCapable) {
        const ab = _veh.ascendBoost ?? 1;
        wish.y *= ab;
      }
    }

    if (wish.lengthSq() > 0) wish.normalize();

    // ダッシュトリガ（Shift押し始め）
    const dashDown = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    if (dashDown && !this._dashWasDown && this.dashCooldown <= 0 && this.dashTimer < 0) {
      // 入力方向、無ければカメラ前方
      let dd = wish.clone();
      if (dd.lengthSq() < 0.01) dd.copy(this.getAimDirection());
      dd.normalize();
      this.dashDir.copy(dd);
      this.dashTimer = 0;
      this.dashCooldown = DASH_COOLDOWN;
      // 初速付与
      this.velocity.addScaledVector(this.dashDir, DASH_SPEED * 0.35);
    }
    this._dashWasDown = dashDown;

    // 速度更新
    if (this.dashTimer >= 0) {
      // ダッシュ中：固定方向に強加速＋軽減衰
      this.velocity.addScaledVector(this.dashDir, DASH_ACCEL * dt);
      const dampD = Math.exp(-DASH_DAMPING * dt);
      this.velocity.multiplyScalar(dampD);
      // 上限を一時的に引き上げ
      const sp = this.velocity.length();
      if (sp > DASH_SPEED) this.velocity.multiplyScalar(DASH_SPEED / sp);
    } else {
      // 乗り物ブースト：移動上限を moveSpeedMul 倍に引き上げる
      // キャラ固有の baseMoveSpeed (6 が基準) で更にスケール
      let speedMul = this.moveSpeedMul;
      // ホバーバイクは移動継続で更に加速し、最終的に総速度 +240%(=3.4x) に到達する。
      // 停止(水平速度 ~0)で加速がリセットされ +30%(=1.3x) に戻る。
      if (_veh && _veh.id === 'veh_hoverBike') {
        // 移動入力があり かつ 実際に動いていれば加速チャージ、入力を離せば即リセット
        const wishLen = Math.hypot(wish.x, wish.z);
        const flatSpNow = Math.hypot(this.velocity.x, this.velocity.z);
        if (wishLen > 0.1 && flatSpNow > 0.5) {
          // 10秒でフル加速(0→1)
          this._hoverBikeCharge = Math.min(1, this._hoverBikeCharge + dt / 10.0);
        } else {
          this._hoverBikeCharge = 0;
        }
        const baseMul = _veh.speedMul ?? 1.3; // ホバーバイクは 1.3 (+30%)
        const targetMul = 3.0;                 // 最大到達 +200%
        const extra = 1 + this._hoverBikeCharge * (targetMul / baseMul - 1);
        speedMul *= extra;
      } else {
        // 別車両に乗り換え、または降車したらリセット
        this._hoverBikeCharge = 0;
      }

      // ACCEL は元々 ACCEL/DAMPING = 50 が終端速度になるため、
      // 想定上限 (MOVE_SPEED * speedMul = 34 * speedMul) に届かない。
      // 加速も speedMul に応じてスケールさせて上限まで実際に届くようにする。
      const accelScale = Math.max(1, speedMul);
      this.velocity.x += wish.x * ACCEL * accelScale * dt;
      this.velocity.z += wish.z * ACCEL * accelScale * dt;
      this.velocity.y += wish.y * ACCEL * accelScale * dt;

      // 空中ドリフト車両は水平方向の減衰を緩める(慣性的に滑る)
      let dampMul = 1;
      if (_veh && _veh.hoverDrift) dampMul = 0.35;
      const damp = Math.exp(-DAMPING * dampMul * dt);
      this.velocity.x *= damp;
      this.velocity.z *= damp;
      this.velocity.y *= damp;
      const charSpeedScale = (this.baseMoveSpeed ?? 6) / 6;
      const maxFlat = MOVE_SPEED * speedMul * charSpeedScale;
      let maxAsc  = ASCEND_SPEED * speedMul * charSpeedScale;
      let maxDesc = DESCEND_SPEED * speedMul * charSpeedScale;
      // 飛行可能車両は上昇/下降上限を ascendBoost 倍
      if (_veh && _veh.flightCapable) {
        const ab = _veh.ascendBoost ?? 1;
        maxAsc *= ab;
        maxDesc *= ab;
      }
      // 地上専用車両は縦速度を完全に殺す
      if (_veh && _veh.groundOnly) {
        maxAsc = 0;
        maxDesc = 0;
        if (this.velocity.y > 0) this.velocity.y = 0;
      }
      const flatLen = Math.hypot(this.velocity.x, this.velocity.z);
      if (flatLen > maxFlat) {
        const s = maxFlat / flatLen;
        this.velocity.x *= s;
        this.velocity.z *= s;
      }
      if (this.velocity.y >  maxAsc)  this.velocity.y =  maxAsc;
      if (this.velocity.y < -maxDesc) this.velocity.y = -maxDesc;
    }

    // 位置更新
    this.object.position.addScaledVector(this.velocity, dt);

    // 地形高さをサンプリングして床にする(なぞり移動)
    // 大型乗り物(ドラゴン等)は rideHeight 分だけ高く浮き、車体が地面に埋まらない
    const groundY = getTerrainHeightAt(this.object.position.x, this.object.position.z);
    const minY = groundY + 1 + (this.mountedVehicle?.rideHeight ?? 0);
    if (this.object.position.y < minY) {
      this.object.position.y = minY;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }
    if (this.object.position.y > groundY + 50) {
      this.object.position.y = groundY + 50;
      if (this.velocity.y > 0) this.velocity.y = 0;
    }

    // 地上専用車両は最大高度を制限(地表 + maxAltitude)
    if (_veh && _veh.groundOnly) {
      const maxY = minY + (_veh.maxAltitude ?? 1.0);
      if (this.object.position.y > maxY) {
        this.object.position.y = maxY;
        if (this.velocity.y > 0) this.velocity.y = 0;
      }
    }

    // 浮遊
    this.bobPhase += dt * BOB_FREQ * Math.PI * 2;
    const bob = Math.sin(this.bobPhase) * BOB_AMP;
    this.object.position.y += bob * dt;

    // 攻撃中の連続スピン (motion: 'spin'/'sweep'/'spiral'/'flyby' で impulse.spin が設定されている)
    const spinning = this._attackSpinTotal !== 0 && this.attackTimer >= 0;
    if (spinning) {
      const d = this.getAttackData();
      const dur = d ? d.duration : 0.3;
      const rate = this._attackSpinTotal / Math.max(0.05, dur);
      this.object.rotation.y += rate * dt;
      this._attackSpinElapsed += rate * dt;
    } else {
      // 通常の向き追従
      const flatLen = Math.hypot(this.velocity.x, this.velocity.z);
      if (this.dashTimer >= 0) {
        const targetYaw = Math.atan2(this.dashDir.x, this.dashDir.z);
        this._lerpYaw(targetYaw);
      } else if (flatLen > 0.5) {
        const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
        this._lerpYaw(targetYaw);
      } else {
        this._lerpYaw(this.yaw + Math.PI);
      }
    }

    // ダッシュ中のロール傾き
    this._applyBodyTiltFromDash();
  }

  _updateAttackAnim() {
    // デフォルト姿勢（攻撃なし）
    const d = this.getAttackData();
    if (!d) {
      this.sword.rotation.x = SWORD_REST_ANGLE;
      this.sword.rotation.y = 0;
      this.sword.rotation.z = 0;
      // 腕戻し
      if (this._armR) {
        this._armR.rotation.x *= 0.85;
        this._armR.rotation.z += (-0.3 - this._armR.rotation.z) * 0.2;
      }
      if (this._armL) {
        this._armL.rotation.x *= 0.85;
        this._armL.rotation.z += (0.3 - this._armL.rotation.z) * 0.2;
      }
      // 胴体の傾きは _applyBodyTiltFromDash 側で扱う
      return;
    }
    const t = Math.min(1, this.attackTimer / d.duration);
    // hit window 中央でピークになるカーブ
    const peak = (d.hitStart + d.hitEnd) * 0.5 / d.duration;
    const pulse = Math.sin(Math.PI * Math.min(1, t / Math.max(0.001, peak)));
    const [swX, swY, swZ] = d.anim.sw;
    this.sword.rotation.x = SWORD_REST_ANGLE + (swX - SWORD_REST_ANGLE) * pulse;
    this.sword.rotation.y = swY * pulse;
    this.sword.rotation.z = swZ * pulse;

    // 胴体の体重移動（攻撃ベクトル）
    const [leanX, leanZ] = d.anim.lean;
    // attackBodyLean は最終的に _applyBodyTiltFromDash で合算される
    this._attackLean = { x: leanX * pulse, z: leanZ * pulse };

    // motion 別の腕アニメーション（見た目を大袈裟に差別化）
    const motion = d.motion;
    const baseSwing = d.anim.armSwing;
    let armRX = baseSwing * pulse;
    let armLX = -baseSwing * 0.6 * pulse;
    let armRZ = -0.3;
    let armLZ = 0.3;

    if (motion === 'flap') {
      // 翼ばたき：両腕を6Hz前後で大きく開閉、Z軸で羽ばたく
      const flap = Math.sin(t * Math.PI * 12); // 攻撃中に約6サイクル
      armRZ = -0.3 - flap * 1.1;  // 右肩を下〜上へ大きく振る
      armLZ =  0.3 + flap * 1.1;
      armRX = baseSwing * 0.4 * pulse;
      armLX = -baseSwing * 0.4 * pulse;
    } else if (motion === 'thrust') {
      // 突進突き：右腕を真っ直ぐ前に突き出す
      armRX = baseSwing * 1.6 * pulse;
      armLX =  baseSwing * 0.3 * pulse; // 左腕も前へ
      armRZ = -0.15;
      armLZ =  0.15;
    } else if (motion === 'overhead') {
      // 振りかぶり→振り下ろし：前半上に持ち上げ、後半振り下ろす
      const phase = t < 0.5 ? -t * 2 : (t - 0.5) * 2; // 前半 -1→0、後半 0→1
      armRX = baseSwing * phase * 1.4;
      armLX = baseSwing * phase * 0.5;
    } else if (motion === 'sweep') {
      // 横なぎ：右腕を体側方向へ大きく開く
      armRX = baseSwing * 0.6 * pulse;
      armRZ = -0.3 - pulse * 1.4; // 横に振り抜く
      armLZ =  0.3 + pulse * 0.4;
    } else if (motion === 'uppoint') {
      // 突き上げ：剣を高く掲げる姿勢
      armRX = -baseSwing * 1.2 * pulse;  // 腕を上に
      armLX = -baseSwing * 0.6 * pulse;
      armRZ = -0.1;
    } else if (motion === 'slam') {
      // 振り下ろし：両腕を一気に下ろす
      armRX = baseSwing * 1.4 * pulse;
      armLX = baseSwing * 1.0 * pulse;
    } else if (motion === 'spiral' || motion === 'flyby') {
      // 回転ダッシュ：両腕を水平に広げる
      armRX = baseSwing * 0.3 * pulse;
      armLX = -baseSwing * 0.3 * pulse;
      armRZ = -0.3 - pulse * 1.0;
      armLZ =  0.3 + pulse * 1.0;
    } else if (motion === 'dive') {
      // 急降下：両腕を体に密着（流線形）
      armRX = baseSwing * 0.2 * pulse;
      armLX = -baseSwing * 0.2 * pulse;
      armRZ = -0.05;
      armLZ =  0.05;
    } else if (motion === 'rise') {
      // 急上昇：両腕を後方に流す
      armRX = -baseSwing * 0.8 * pulse;
      armLX = -baseSwing * 0.8 * pulse;
    } else if (motion === 'pounce') {
      // ジャンプ攻撃：両腕を後ろに引いて溜め→振り出し
      const split = t < 0.4 ? -t * 1.5 : (t - 0.4) * 1.5;
      armRX = baseSwing * split * 1.2;
      armLX = baseSwing * split * 0.6;
    } else if (motion === 'upSwing') {
      // 上振り：前半に腕を肩よりも後方へ引き、後半で頭上に振り上げる
      // armRX が負の値ほど腕が前から上方向にせり上がる動き
      const phase = t < 0.4 ? -t * 1.5 : (t - 0.4) * 2.0;
      armRX = -Math.abs(baseSwing) * (phase < 0 ? -phase : phase) * (phase < 0 ? -1 : -1) * 1.3;
      // ↑ 常に負方向に振り、t=peakで最大の振り上げに達する
      armRX = -Math.abs(baseSwing) * 1.3 * pulse;
      armLX = -Math.abs(baseSwing) * 0.5 * pulse;
      armRZ = -0.1;
      armLZ =  0.1;
    } else if (motion === 'downSwing') {
      // 下振り：前半に頭上にかぶせて溜め、後半で地面方向へ振り下ろす
      // armRX が正の値ほど腕が前方〜下方向に降ろされる
      armRX =  Math.abs(baseSwing) * 1.4 * pulse;
      armLX =  Math.abs(baseSwing) * 0.6 * pulse;
      armRZ = -0.05;
      armLZ =  0.05;
    }
    // motion === 'spin' や未指定はデフォルト挙動（全身回転が主役）

    if (this._armR) {
      this._armR.rotation.x = armRX;
      this._armR.rotation.z += (armRZ - this._armR.rotation.z) * 0.4;
    }
    if (this._armL) {
      this._armL.rotation.x = armLX;
      this._armL.rotation.z += (armLZ - this._armL.rotation.z) * 0.4;
    }
  }

  _applyBodyTiltFromDash() {
    // 攻撃側のリーン
    const aL = this._attackLean || { x: 0, z: 0 };
    // ダッシュ側のリーン
    let dx = 0, dz = 0;
    if (this.dashTimer >= 0) {
      // 進行方向のローカル成分から左右ロール
      const fwdYaw = this.object.rotation.y;
      const localX = this.dashDir.x * Math.cos(fwdYaw) - this.dashDir.z * Math.sin(fwdYaw);
      dz = -localX * DASH_TILT;
      dx = -Math.max(0, Math.abs(this.dashDir.y)) * 0.2 + 0.18; // 前のめり
    }
    const targetX = aL.x + dx;
    const targetZ = aL.z + dz;
    this.object.rotation.x += (targetX - this.object.rotation.x) * 0.25;
    this.object.rotation.z += (targetZ - this.object.rotation.z) * 0.25;
  }

  _lerpYaw(targetYaw) {
    let cur = this.object.rotation.y;
    let diff = targetYaw - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.object.rotation.y = cur + diff * ROT_LERP;
  }

  // swordHolder を _armR の子に付け替える。腕が無ければ object 直下にフォールバック。
  // armR が見つかった場合：腕の下端付近（手の位置）にぶら下げる
  // 見つからない場合：従来通り胴体中央のやや上に置く
  _attachSwordToArm() {
    // 既存の parent から外す
    if (this.swordHolder.parent) {
      this.swordHolder.parent.remove(this.swordHolder);
    }
    if (this._armR) {
      // 腕のローカル空間で手の位置（腕原点の少し下）にセット
      this.swordHolder.position.set(0, -0.5, 0);
      this.swordHolder.rotation.set(0, 0, 0);
      this._armR.add(this.swordHolder);
    } else {
      this.swordHolder.position.set(0, 0.5, 0);
      this.swordHolder.rotation.set(0, 0, 0);
      this.object.add(this.swordHolder);
    }
  }

  // キャラ群から腕らしきメッシュを収集（位置ヒューリスティック）
  _collectLimbs() {
    this._armL = null;
    this._armR = null;
    this.object.traverse((o) => {
      if (!o.isMesh) return;
      const px = o.position.x, py = o.position.y;
      if (Math.abs(px) >= 0.4 && Math.abs(px) <= 0.7 && py >= 0.6 && py <= 1.2) {
        if (px < 0 && !this._armL) this._armL = o;
        else if (px > 0 && !this._armR) this._armR = o;
      }
    });
  }

  swapCharacter(newGroup, scene) {
    const pos = this.object.position.clone();
    const rot = this.object.rotation.clone();
    // swordHolder を一旦 parent から取り外す（armR でも object でも対応）
    if (this.swordHolder.parent) {
      this.swordHolder.parent.remove(this.swordHolder);
    }
    scene.remove(this.object);
    newGroup.position.copy(pos);
    newGroup.rotation.copy(rot);
    scene.add(newGroup);
    this.object = newGroup;
    this._collectLimbs();
    this._attachSwordToArm();
  }
}

function createSword() {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1.3, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xdcdcdc, metalness: 0.6, roughness: 0.3 })
  );
  blade.position.y = 0.75;
  blade.castShadow = true;
  g.add(blade);
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.06, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.6 })
  );
  guard.position.y = 0.1;
  g.add(guard);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.25, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a2a14, roughness: 0.9 })
  );
  handle.position.y = -0.05;
  g.add(handle);
  g.position.set(0.4, 0, 0.3);
  return g;
}
