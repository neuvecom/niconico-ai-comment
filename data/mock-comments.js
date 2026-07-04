// モックコメントデータ（Step 1: 外部API連携前の動作確認用）
//
// - time  : 動画の再生時間（秒）。この時刻を過ぎたら弾幕を出現させる。
// - text  : コメント本文。
// - user  : ペルソナ識別子（content.js の PERSONAS と対応）。
// - color : 文字色。未指定ならペルソナ既定色を使用。
//
// content.js から `window.NICO_AI_MOCK_COMMENTS` として参照される。
window.NICO_AI_MOCK_COMMENTS = [
  { time: 1.5, text: "うぽつ！", user: "fan", color: "#ffffff" },
  { time: 2.4, text: "待ってました！", user: "fan" },
  { time: 3.2, text: "ここおかしいだろww", user: "tsukkomi", color: "#ff5555" },
  { time: 4.0, text: "画質綺麗だな", user: "expert" },
  { time: 5.1, text: "888888888", user: "fan" },
  { time: 6.3, text: "いや情報が古いですね、正確には", user: "expert", color: "#55aaff" },
  { time: 7.0, text: "早口すぎて草", user: "tsukkomi" },
  { time: 8.2, text: "神回きたわ", user: "fan" },
  { time: 9.5, text: "そこ突っ込むところじゃないだろ", user: "tsukkomi" },
  { time: 10.4, text: "この構成は理にかなっている", user: "expert" },
  { time: 11.1, text: "テンポ良き", user: "fan" },
  { time: 12.6, text: "急に真面目でワロタ", user: "tsukkomi" },
  { time: 13.8, text: "参考になります", user: "expert" },
  { time: 14.5, text: "もう一回見る", user: "fan" },
  { time: 15.2, text: "オチが読めたわwww", user: "tsukkomi" }
];
