/**
 * niconico AI Comment - content script (Step 1 / モック描画版)
 *
 * 役割:
 *   1. ニコニコ動画プレイヤーの <video> 要素を検知する。
 *   2. video.currentTime を監視し、モックコメントを時刻同期で出現させる。
 *   3. プレイヤー上に重ねた透過レイヤーへ、右→左へ流れる弾幕として描画する。
 *
 * 注意: ニコニコのサーバーへは一切送信せず、ブラウザ上でのみ描画する。
 */
(() => {
  "use strict";

  // 二重注入ガード（SPA遷移で複数回実行されるのを防ぐ）
  if (window.__nicoAiCommentLoaded) return;
  window.__nicoAiCommentLoaded = true;

  // ── ペルソナ定義（色・フォントのカスタマイズ）───────────────────────
  const PERSONAS = {
    fan: { color: "#ffffff", weight: "bold" }, // 大ファン
    tsukkomi: { color: "#ff5555", weight: "bold" }, // ツッコミ役
    expert: { color: "#55aaff", weight: "normal" }, // 有識者
    default: { color: "#ffffff", weight: "bold" }
  };

  // ── 弾幕パラメータ ─────────────────────────────────────────────
  const DURATION_SEC = 8; // 画面幅を横断するのにかかる秒数
  const LANE_GAP_PX = 6; // レーン間の縦マージン
  const SEEK_THRESHOLD = 0.6; // これ以上の時刻ジャンプはシーク扱い

  const overlay = document.createElement("div");
  overlay.className = "nico-ai-overlay";

  const state = {
    video: null,
    comments: [], // time昇順のモックデータ
    cursor: 0, // 次に出現させるコメントの添字
    active: [], // 描画中の弾幕 { el, x, width, lane, speed }
    lanes: [], // 各レーンの末尾弾幕（衝突回避用）
    fontSize: 24,
    laneHeight: 34,
    lastTime: 0,
    lastFrame: null
  };

  // ── 起動: video要素の出現を待つ ─────────────────────────────────
  function waitForVideo() {
    const video = document.querySelector("video");
    if (video && video.videoWidth >= 0) {
      attach(video);
      return;
    }
    // プレイヤーは非同期に生成されるため MutationObserver で待機
    const observer = new MutationObserver(() => {
      const v = document.querySelector("video");
      if (v) {
        observer.disconnect();
        attach(v);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function attach(video) {
    state.video = video;
    const src = window.NICO_AI_MOCK_COMMENTS || [];
    state.comments = src.slice().sort((a, b) => a.time - b.time);
    state.cursor = 0;

    document.body.appendChild(overlay);
    syncOverlayRect();
    state.lastTime = video.currentTime;

    // 描画ループ開始
    state.lastFrame = null;
    requestAnimationFrame(loop);
  }

  // ── オーバーレイをvideoの表示矩形に追従させる ──────────────────────
  function syncOverlayRect() {
    const r = state.video.getBoundingClientRect();
    overlay.style.left = `${r.left}px`;
    overlay.style.top = `${r.top}px`;
    overlay.style.width = `${r.width}px`;
    overlay.style.height = `${r.height}px`;
    // 動画が見えない（別タブ等）ときは非表示
    overlay.style.display = r.width > 0 && r.height > 0 ? "block" : "none";

    // フォント/レーン高さを高さに応じてスケール
    state.fontSize = Math.max(16, Math.min(40, Math.round(r.height / 18)));
    state.laneHeight = state.fontSize + LANE_GAP_PX;
    const laneCount = Math.max(1, Math.floor(r.height / state.laneHeight));
    if (state.lanes.length !== laneCount) {
      state.lanes = new Array(laneCount).fill(null);
    }
  }

  // ── メインループ ───────────────────────────────────────────────
  function loop(now) {
    if (!state.video) return;
    const dt = state.lastFrame == null ? 0 : (now - state.lastFrame) / 1000;
    state.lastFrame = now;

    syncOverlayRect();
    handleSync();

    // 一時停止中は動かさない（コメントも固定）
    if (!state.video.paused) {
      moveComments(dt);
    }

    requestAnimationFrame(loop);
  }

  // ── 再生時間の同期・シーク検出 ─────────────────────────────────
  function handleSync() {
    const t = state.video.currentTime;

    // シーク検出（大きな時刻ジャンプ）→ カーソル再計算＆弾幕クリア
    if (Math.abs(t - state.lastTime) > SEEK_THRESHOLD) {
      clearActive();
      state.cursor = firstIndexAtOrAfter(t);
    }
    state.lastTime = t;

    // 到来したコメントを出現させる
    while (state.cursor < state.comments.length && state.comments[state.cursor].time <= t) {
      spawn(state.comments[state.cursor]);
      state.cursor++;
    }
  }

  function firstIndexAtOrAfter(t) {
    // 二分探索で time >= t の最初の添字を返す
    let lo = 0;
    let hi = state.comments.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (state.comments[mid].time < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // ── 弾幕の生成 ─────────────────────────────────────────────────
  function spawn(comment) {
    const persona = PERSONAS[comment.user] || PERSONAS.default;
    const el = document.createElement("span");
    el.className = "nico-ai-comment";
    el.textContent = comment.text;
    el.style.color = comment.color || persona.color;
    el.style.fontWeight = persona.weight;
    el.style.fontSize = `${state.fontSize}px`;
    overlay.appendChild(el);

    const width = el.offsetWidth; // 描画後に実幅を測定
    const overlayWidth = overlay.clientWidth;
    // 全弾幕を等速にすることで、同一レーンでの追突（重なり）を防ぐ
    const speed = overlayWidth / DURATION_SEC; // px/sec

    const lane = pickLane(width, overlayWidth);
    const x = overlayWidth; // 右端外から出現
    const y = lane * state.laneHeight;
    el.style.transform = `translateX(${x}px)`;
    el.style.top = `${y}px`;

    const item = { el, x, width, lane, speed };
    state.active.push(item);
    state.lanes[lane] = item;
  }

  // 末尾弾幕が完全に画面内へ入ったレーンを優先。無ければ最も空いたレーンへ。
  function pickLane(width, overlayWidth) {
    let best = 0;
    let bestClear = -Infinity;
    for (let i = 0; i < state.lanes.length; i++) {
      const last = state.lanes[i];
      if (!last || last.x + last.width < overlayWidth) return i; // 完全に入場済み＝空き
      const clearance = overlayWidth - (last.x + last.width);
      if (clearance > bestClear) {
        bestClear = clearance;
        best = i;
      }
    }
    return best;
  }

  // ── 弾幕の移動・破棄 ───────────────────────────────────────────
  function moveComments(dt) {
    for (let i = state.active.length - 1; i >= 0; i--) {
      const item = state.active[i];
      item.x -= item.speed * dt;
      item.el.style.transform = `translateX(${item.x}px)`;
      if (item.x + item.width < 0) {
        item.el.remove();
        state.active.splice(i, 1);
        if (state.lanes[item.lane] === item) state.lanes[item.lane] = null;
      }
    }
  }

  function clearActive() {
    for (const item of state.active) item.el.remove();
    state.active = [];
    state.lanes = state.lanes.map(() => null);
  }

  // ── 実行 ───────────────────────────────────────────────────────
  waitForVideo();
})();
