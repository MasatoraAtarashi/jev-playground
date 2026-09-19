// 実験6: 事業アイデアの分解評価とネクストアクション提案
import { choice, noul, score } from "@typesafe-ai/sdk";
import { makeClient } from "../src/lib/client.ts";
import { table, writeReport } from "../src/lib/report.ts";

const client = makeClient();

type Idea = { id: string; title: string; pitch: string; context: string; myView: { verdict: string; next: string } };
const ideas: Idea[] = [
  { id: "i1", title: "飲食店向け AI シフト自動作成 SaaS", pitch: "スタッフの希望と売上予測から最適なシフトを自動生成。LINE で希望収集、店長の作業を週 3 時間→10 分に。", context: "提案者: 飲食チェーンで 5 年店長経験のあるエンジニア 1 名。競合に既存シフト管理 SaaS が複数あるが AI 自動生成は弱い。", myView: { verdict: "有望だが差別化が要", next: "research" } },
  { id: "i2", title: "猫専用の SNS", pitch: "猫の飼い主が猫の写真を投稿し、猫同士がフォローし合う SNS。広告と有料スタンプで収益化。", context: "提案者: 学生 2 名。Instagram に猫アカウントは既に大量にある。", myView: { verdict: "厳しい", next: "drop" } },
  { id: "i3", title: "製造業向け図面 PDF の自動見積もり", pitch: "町工場に届く図面 PDF を読み取り、材料費・加工時間から見積もりを 1 分で作成。現在は熟練者が半日かける。", context: "提案者: 大手製造業出身 2 名、うち 1 名は生産技術。すでに町工場 3 社から PoC 参加の内諾あり。", myView: { verdict: "有望", next: "prototype" } },
  { id: "i4", title: "個人間の中古ゲーム貸し借りアプリ", pitch: "近所の人同士でゲームソフトを貸し借り。保証金をアプリが預かる。", context: "提案者: 1 名。ダウンロード販売の比率が年々上昇中。法務（貸与権）の論点あり。", myView: { verdict: "市場が縮小方向", next: "drop" } },
  { id: "i5", title: "介護施設向け夜間見守り音声 AI", pitch: "居室の音（転倒音・うなり声・呼びかけ）を検知して職員に通知。カメラを使わないためプライバシー配慮。", context: "提案者: 音響信号処理の研究者と介護施設運営者。施設 1 か所で実証済み、検知精度 92%。ハード込みの提供が必要。", myView: { verdict: "有望・社会的意義大", next: "collab" } },
  { id: "i6", title: "Web3 で学歴を証明する分散型 ID", pitch: "大学が卒業証明を NFT で発行、就職時に企業が検証。改ざん不可能。", context: "提案者: 1 名。大学側の導入インセンティブが不明確。既に類似プロジェクトが複数あり、普及していない。", myView: { verdict: "厳しい", next: "drop" } },
  { id: "i7", title: "社内 Slack の質問を自動で FAQ 化するツール", pitch: "Slack の質問と回答のやり取りを検出し、承認フローを経て社内 FAQ に蓄積。新入社員の同じ質問を減らす。", context: "提案者: 情シス経験者 1 名。Slack/Notion 連携で構築可能。Notion AI や Glean が近い機能を持つ。", myView: { verdict: "小さく作れるが競合強い", next: "prototype" } },
  { id: "i8", title: "地方自治体向け補助金マッチング", pitch: "中小企業の情報を入力すると受給可能な補助金を提示し、申請書の下書きまで生成。成功報酬型。", context: "提案者: 行政書士 1 名とエンジニア 1 名。補助金の情報は散在しており、集約に労力がかかる。士業の独占業務との線引きに注意。", myView: { verdict: "有望・規制確認が必要", next: "research" } },
];

const lv = (a: string, b: string, c: string, d: string) => [a, b, c, d];
const questions = {
  market: score("`pitch` が狙う市場の規模は？", lv("ニッチで小さい（数億円未満）", "中規模（数十億円）", "大きい（数百億円）", "巨大（数千億円以上）")),
  pain: score("`pitch` が解く課題の深刻さ（顧客の痛みの強さ）は？", lv("あれば便利程度", "明確な不便がある", "業務上の大きな負担・コスト", "事業や生命に関わる")),
  feasibility: score("`pitch` を `context` のチームが 12 か月以内に実現できる技術的・実行的な見込みは？", lv("かなり困難", "難しいが可能", "現実的", "容易")),
  differentiation: score("`pitch` の競合・代替手段に対する差別化は？", lv("ほぼ無い", "弱い", "明確", "強い参入障壁になる")),
  monetization: score("`pitch` の収益化の見通しは？", lv("不明確", "可能だが単価が低い", "明確", "高単価で継続課金が見込める")),
  teamFit: score("`context` のチームは `pitch` を実現するのに適しているか？", lv("ミスマッチ", "一部不足", "概ね適切", "理想的")),
  regulatoryRisk: noul("`pitch` には法規制・許認可・独占業務などの法的リスクがあるか？"),
  timing: noul("`pitch` は今（2026年）が参入のよいタイミングか？"),
  next: choice("`pitch` と `context` を踏まえ、提案者が次にとるべき行動は？", {
    research: "市場調査・顧客インタビューで仮説を検証する",
    prototype: "小さなプロトタイプを作って実顧客に試してもらう",
    collab: "販売チャネルや専門知識を持つパートナーと組む",
    pivot: "課題は良いが解き方を変える",
    drop: "見送る・別のアイデアに進む",
  }),
  pursue: noul("提案者はこのアイデアに本気で時間を投じるべきか？"),
};

const t0 = performance.now();
const results = await Promise.all(ideas.map((i) => client.systemOne({ state: { pitch: `${i.title}: ${i.pitch}`, context: i.context }, questions })));
const elapsed = performance.now() - t0;
const rows: (string | number)[][] = [];
const ranked: { id: string; title: string; composite: number; pursue: number }[] = [];
let nextAgree = 0;
ideas.forEach((i, k) => {
  const a = results[k].answers as any;
  // 分解スコアを自前の重みで合成（コードで重み付けを変えられるのが System One の売り）
  const composite = 0.2 * a.market.score + 0.25 * a.pain.score + 0.15 * a.feasibility.score + 0.2 * a.differentiation.score + 0.1 * a.monetization.score + 0.1 * a.teamFit.score;
  ranked.push({ id: i.id, title: i.title, composite, pursue: a.pursue.noul });
  if (a.next.choice === i.myView.next) nextAgree++;
  rows.push([i.id, i.title, a.market.score.toFixed(1), a.pain.score.toFixed(1), a.feasibility.score.toFixed(1), a.differentiation.score.toFixed(1), a.monetization.score.toFixed(1), a.teamFit.score.toFixed(1), a.regulatoryRisk.noul.toFixed(2), a.timing.noul.toFixed(2), `${a.next.choice}(${a.next.confidence.toFixed(2)})`, a.pursue.noul.toFixed(2), `${i.myView.verdict} / ${i.myView.next}`]);
});
ranked.sort((x, y) => y.composite - x.composite);
writeReport("06-business-ideas", `# 実験6: 事業アイデアの分解評価とネクストアクション

- 日時: ${new Date().toISOString()} / モデル: jev-latest / ${ideas.length} アイデア並列で合計 ${elapsed.toFixed(0)} ms
- 公式の推奨どおり「このピッチを評価せよ」ではなく **6 軸の score（0–3）＋ 2 つの noul ＋ネクストアクション choice ＋本気で取り組むべきか noul** に分解
- 「私見」は実験者（Claude）が事前に付けた判断。正解ではなく比較用
- 軸: 市場 / 痛み / 実現性 / 差別化 / 収益 / チーム適合。各 0–3

${table(["id", "アイデア", "市場", "痛み", "実現", "差別", "収益", "チーム", "法的", "時期", "次の行動", "本気", "私見(判断/次)"], rows)}

## 合成スコアによるランキング（重み: 痛み .25, 市場 .2, 差別化 .2, 実現 .15, 収益 .1, チーム .1）

${table(["順位", "id", "アイデア", "合成 (0–3)", "本気 noul"], ranked.map((r, i) => [i + 1, r.id, r.title, r.composite.toFixed(2), r.pursue.toFixed(2)]))}

- ネクストアクションが私見と一致: ${nextAgree}/${ideas.length}

## 所見

（実行後に追記）
`);
console.table(rows); console.log(ranked);
