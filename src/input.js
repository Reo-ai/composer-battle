// 入力管理（キーボード + マウス）
// WASD: 平面移動 / ArrowUp: 上昇 / ArrowDown: 下降 / Arrow←→: 左右移動
// マウス移動: 視点 / Z: 音符弾 / X: 剣 / C: 強攻撃 / B: 特殊技 / 1/2/3: キャラ切替

export class Input {
  constructor() {
    this.keys = {};
    this._mouseDX = 0;
    this._mouseDY = 0;
    this._lockTarget = null;

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      // 矢印キー / Space でブラウザのスクロールが起きないよう抑制
      if (e.code.startsWith('Arrow') || e.code === 'Space') {
        e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // フォーカスを失った時にキーが押されっぱなしになるのを防止
    window.addEventListener('blur', () => {
      this.keys = {};
    });

    // マウスデルタ蓄積（Pointer Lock 中のみ有効）
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) {
        this._mouseDX += e.movementX || 0;
        this._mouseDY += e.movementY || 0;
      }
    });
  }

  // 指定 DOM 要素を Pointer Lock のターゲットに設定
  // クリックで自動的にロック取得し、ESC で解除可能
  attachPointerLock(element) {
    this._lockTarget = element;
    element.addEventListener('click', () => {
      if (document.pointerLockElement !== element) {
        element.requestPointerLock?.();
      }
    });
  }

  // マウスデルタを 1 フレーム分取り出してリセット
  consumeMouseDelta() {
    const dx = this._mouseDX;
    const dy = this._mouseDY;
    this._mouseDX = 0;
    this._mouseDY = 0;
    return { dx, dy };
  }

  // モバイルの視点操作パッドから直接デルタを注入するためのメソッド
  // Pointer Lock 経由ではなくタッチ操作から視点を回すために使う
  addMouseDelta(dx, dy) {
    this._mouseDX += dx;
    this._mouseDY += dy;
  }

  isPointerLocked() {
    return !!document.pointerLockElement;
  }

  isDown(code) {
    return !!this.keys[code];
  }
}
