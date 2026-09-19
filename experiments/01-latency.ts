// 実験1: 質問数と state サイズを変えたときのレイテンシ
import { choice, noul, score } from "@typesafe-ai/sdk";
import { makeClient } from "../src/lib/client.ts";
import { stats, table, writeReport } from "../src/lib/report.ts";

const client = makeClient();
const para = "本日、決済システムの一部で障害が発生し、約30分間にわたり一部のお客様の決済が失敗する事象が発生しました。現在は復旧しており、原因はデータベースの接続プール枯渇と判明しています。再発防止として接続数の監視アラートを追加します。";

function makeQuestions(n: number) {
  const qs: Record<string, any> = {};
  for (let i = 0; i < n; i++) {
    const k = i % 3;
    qs[`q${i}`] =
      k === 0 ? noul(`\`text\` は障害報告か？（${i}）`)
      : k === 1 ? choice(`\`text\` の主題は？（${i}）`, { incident: "障害", release: "リリース", other: "その他" })
      : score(`\`text\` の深刻度は？（${i}）`, ["軽微", "中程度", "重大"]);
  }
  return qs;
}

async function measure(label: string, state: unknown, questions: Record<string, any>, reps = 5) {
  const lat: number[] = [];
  let usage = { input_tokens: 0, output_tokens: 0 };
  for (let i = 0; i < reps; i++) {
    const t0 = performance.now();
    const r = await client.systemOne({ state, questions });
    lat.push(performance.now() - t0);
    usage = r.usage;
  }
  const s = stats(lat);
  console.log(label, s);
  return [label, s.p50, s.p90, s.max, usage.input_tokens, usage.output_tokens];
}

const rows: (string | number)[][] = [];
// A: 質問数を変える（state 固定）
for (const n of [1, 3, 10, 30]) rows.push(await measure(`質問 ${n} 件 / state 1段落`, { text: para }, makeQuestions(n)));
// B: state サイズを変える（質問 3 件固定）
for (const m of [1, 10, 50, 100]) rows.push(await measure(`質問 3 件 / state ${m}段落`, { text: Array(m).fill(para).join("\n") }, makeQuestions(3)));

writeReport("01-latency", `# 実験1: レイテンシ（質問数 × state サイズ）

- 日時: ${new Date().toISOString()}
- モデル: jev-latest / 各条件 5 回計測 / 東京からの HTTPS / 単位 ms
- state は日本語の障害報告 1 段落（約 130 文字）を段落数分繰り返したもの

${table(["条件", "p50", "p90", "max", "input_tokens", "output_tokens"], rows)}

## 所見

（実行後に追記）
`);
