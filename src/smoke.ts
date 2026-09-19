import { choice, noul, score } from "@typesafe-ai/sdk";
import { makeClient } from "./lib/client.ts";

const client = makeClient();
const t0 = performance.now();
const res = await client.systemOne({
  state: { message: "二重に課金されています。今すぐ返金してください！" },
  questions: {
    refund: noul("`message` は返金を求めているか？"),
    category: choice("`message` の主な内容は？", {
      billing: "請求・課金に関する問題",
      technical: "技術的な不具合",
      other: "その他",
    }),
    anger: score("`message` の怒りの度合いは？", [
      "落ち着いている",
      "不満だが丁寧",
      "強く怒っている",
    ]),
  },
});
console.log(JSON.stringify(res, null, 2));
console.log(`latency: ${(performance.now() - t0).toFixed(0)} ms`);
