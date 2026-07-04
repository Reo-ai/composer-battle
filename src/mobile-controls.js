// スマホ向けオンスクリーンコントローラ
// 右下のトグルボタン(🎮)で表示/非表示を切替
// 表示中:
//   左下: アナログ十字キー(WASD) + 上昇/下降ボタン(ArrowUp/Down)
//   中央下: 視点操作パッド(マウスデルタを注入)
//   右下: コマンドボタン Z / X / C / B / V / Shift

const CSS = `
#mobile-toggle {
  position: fixed; right: 16px; bottom: 16px;
  width: 56px; height: 56px; border-radius: 50%;
  background: rgba(0, 0, 0, 0.55); color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.35);
  font-size: 26px; line-height: 1; text-align: center;
  display: flex; align-items: center; justify-content: center;
  z-index: 10001; user-select: none; -webkit-user-select: none;
  cursor: pointer; touch-action: manipulation;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
#mobile-toggle.active {
  background: rgba(80, 180, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.7);
}
#mobile-controls {
  position: fixed; inset: 0;
  pointer-events: none; z-index: 10000;
  display: none;
  font-family: -apple-system, "Hiragino Sans", sans-serif;
  color: #fff;
}
#mobile-controls.active { display: block; }

/* 左下 十字キー + 上下ボタン */
.mc-left {
  position: absolute; left: 20px; bottom: 20px;
  pointer-events: auto;
  display: flex; align-items: flex-end; gap: 12px;
}
.mc-stick {
  width: 150px; height: 150px; border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  border: 2px solid rgba(255, 255, 255, 0.4);
  position: relative;
  touch-action: none;
}
.mc-stick-knob {
  width: 60px; height: 60px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  border: 2px solid rgba(255, 255, 255, 0.9);
  position: absolute; left: 45px; top: 45px;
  pointer-events: none;
  transition: transform 0.05s linear;
}
.mc-vert {
  display: flex; flex-direction: column; gap: 8px;
}
.mc-btn {
  min-width: 56px; height: 56px; padding: 0 10px; border-radius: 12px;
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.4);
  color: #fff; font-size: 16px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  user-select: none; -webkit-user-select: none;
  touch-action: none; pointer-events: auto;
}
.mc-btn.pressed {
  background: rgba(80, 180, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.9);
}

/* 中央下 視点パッド */
.mc-look {
  position: absolute; left: 50%; bottom: 20px;
  transform: translateX(-50%);
  width: 160px; height: 160px; border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  border: 2px dashed rgba(255, 255, 255, 0.4);
  pointer-events: auto; touch-action: none;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: rgba(255, 255, 255, 0.6);
}

/* 右下 コマンドボタン群 */
.mc-right {
  position: absolute; right: 20px; bottom: 90px;
  pointer-events: auto;
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 8px;
}
.mc-right .mc-btn {
  min-width: 60px; height: 60px;
  font-size: 14px;
}
.mc-right .mc-btn small {
  display: block; font-size: 10px; font-weight: 400; opacity: 0.75;
}
`;

const HTML = `
<button id="mobile-toggle" aria-label="コントローラ切替">🎮</button>
<div id="mobile-controls">
  <div class="mc-left">
    <div class="mc-stick" data-role="stick">
      <div class="mc-stick-knob"></div>
    </div>
    <div class="mc-vert">
      <div class="mc-btn" data-key="ArrowUp">上昇</div>
      <div class="mc-btn" data-key="ArrowDown">下降</div>
    </div>
  </div>
  <div class="mc-look" data-role="look">視点</div>
  <div class="mc-right">
    <div class="mc-btn" data-key="KeyZ">Z<small>音符</small></div>
    <div class="mc-btn" data-key="KeyX">X<small>剣</small></div>
    <div class="mc-btn" data-key="KeyC">C<small>強</small></div>
    <div class="mc-btn" data-key="KeyB">B<small>特殊</small></div>
    <div class="mc-btn" data-key="KeyV">V<small>奥義</small></div>
    <div class="mc-btn" data-key="ShiftLeft">Shift<small>ダッシュ</small></div>
    <div class="mc-btn" data-key="Space">跳<small>ジャンプ/よじ登り</small></div>
    <div class="mc-btn" data-tap="KeyO">O<small>スコープ倍率</small></div>
  </div>
</div>
`;

// アナログスティックをセットアップ
// 中央からのずれに応じて KeyW/A/S/D を on/off する（しきい値 0.35）
function setupStick(stickEl, input) {
  const knob = stickEl.querySelector('.mc-stick-knob');
  const rectSize = 150; // CSS 側と一致
  const knobSize = 60;
  const centerOffset = (rectSize - knobSize) / 2;
  const radius = rectSize / 2;
  let touchId = null;

  const setKeys = (nx, ny) => {
    // nx, ny は -1..1
    const th = 0.35;
    input.keys['KeyW'] = ny < -th;
    input.keys['KeyS'] = ny > th;
    input.keys['KeyA'] = nx < -th;
    input.keys['KeyD'] = nx > th;
  };

  const reset = () => {
    knob.style.transform = 'translate(0px, 0px)';
    setKeys(0, 0);
    touchId = null;
  };

  const move = (clientX, clientY) => {
    const rect = stickEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const max = radius - knobSize / 2;
    if (dist > max) {
      dx = (dx / dist) * max;
      dy = (dy / dist) * max;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    setKeys(dx / max, dy / max);
  };

  stickEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchId !== null) return;
    const t = e.changedTouches[0];
    touchId = t.identifier;
    move(t.clientX, t.clientY);
  }, { passive: false });

  stickEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    e.stopPropagation();
    for (const t of e.changedTouches) {
      if (t.identifier === touchId) {
        move(t.clientX, t.clientY);
        break;
      }
    }
  }, { passive: false });

  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touchId) {
        reset();
        e.preventDefault();
        e.stopPropagation();
        break;
      }
    }
  };
  stickEl.addEventListener('touchend', end, { passive: false });
  stickEl.addEventListener('touchcancel', end, { passive: false });
}

// 視点パッド: ドラッグ量を input.addMouseDelta に流し込む
function setupLook(lookEl, input) {
  let touchId = null;
  let lastX = 0, lastY = 0;
  const SENS = 1.2;

  lookEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchId !== null) return;
    const t = e.changedTouches[0];
    touchId = t.identifier;
    lastX = t.clientX;
    lastY = t.clientY;
  }, { passive: false });

  lookEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    e.stopPropagation();
    for (const t of e.changedTouches) {
      if (t.identifier === touchId) {
        const dx = t.clientX - lastX;
        const dy = t.clientY - lastY;
        lastX = t.clientX;
        lastY = t.clientY;
        input.addMouseDelta(dx * SENS, dy * SENS);
        break;
      }
    }
  }, { passive: false });

  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touchId) {
        touchId = null;
        e.preventDefault();
        e.stopPropagation();
        break;
      }
    }
  };
  lookEl.addEventListener('touchend', end, { passive: false });
  lookEl.addEventListener('touchcancel', end, { passive: false });
}

// タップで1回だけ keydown を発火するボタン(モード切替・スコープ切替などトグル系用)
// keydownリスナー(main.js の KeyO 等)が拾えるようにダミーの KeyboardEvent を投げる
function bindTapButton(btnEl, keyCode) {
  const fire = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 表示上のフィードバック
    btnEl.classList.add('pressed');
    setTimeout(() => btnEl.classList.remove('pressed'), 120);
    // window の keydown リスナー宛に発火
    const ev = new KeyboardEvent('keydown', { code: keyCode, key: keyCode, bubbles: true });
    window.dispatchEvent(ev);
  };
  btnEl.addEventListener('touchstart', fire, { passive: false });
  // マウスでのテストも一応対応
  btnEl.addEventListener('mousedown', fire);
}

// 押している間だけ keys[code] を true にするボタン
function bindHoldButton(btnEl, input, keyCode) {
  const press = (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.keys[keyCode] = true;
    btnEl.classList.add('pressed');
  };
  const release = (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.keys[keyCode] = false;
    btnEl.classList.remove('pressed');
  };
  btnEl.addEventListener('touchstart', press, { passive: false });
  btnEl.addEventListener('touchend', release, { passive: false });
  btnEl.addEventListener('touchcancel', release, { passive: false });
  // マウスでのテストも一応対応
  btnEl.addEventListener('mousedown', press);
  btnEl.addEventListener('mouseup', release);
  btnEl.addEventListener('mouseleave', release);
}

export function initMobileControls(input) {
  // 既に初期化済みなら何もしない
  if (document.getElementById('mobile-toggle')) return;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.innerHTML = HTML;
  // トグルとコントロール本体を body 直下へ
  while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

  const toggle = document.getElementById('mobile-toggle');
  const panel = document.getElementById('mobile-controls');

  // トグル: canvas のクリック(=Pointer Lock 要求)にイベントが流れないように stopPropagation
  const toggleFn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const on = panel.classList.toggle('active');
    toggle.classList.toggle('active', on);
    // OFF にしたときに押しっぱなしのキーを全解除
    if (!on) {
      ['KeyW', 'KeyA', 'KeyS', 'KeyD',
       'ArrowUp', 'ArrowDown',
       'KeyZ', 'KeyX', 'KeyC', 'KeyB', 'KeyV',
       'ShiftLeft', 'Space'].forEach((k) => { input.keys[k] = false; });
      panel.querySelectorAll('.mc-btn.pressed').forEach((el) => el.classList.remove('pressed'));
    }
  };
  toggle.addEventListener('click', toggleFn);
  toggle.addEventListener('touchend', toggleFn, { passive: false });

  // 各パーツ
  setupStick(panel.querySelector('[data-role="stick"]'), input);
  setupLook(panel.querySelector('[data-role="look"]'), input);
  panel.querySelectorAll('.mc-btn[data-key]').forEach((btn) => {
    bindHoldButton(btn, input, btn.dataset.key);
  });
  // タップ1回で keydown を投げるボタン(スコープ倍率切替など)
  panel.querySelectorAll('.mc-btn[data-tap]').forEach((btn) => {
    bindTapButton(btn, btn.dataset.tap);
  });
}
