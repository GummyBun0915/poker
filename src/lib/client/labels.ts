export const BOT_STYLE_LABELS = {
  tight: "稳健",
  balanced: "均衡",
  aggressive: "激进",
} as const;

export function zhHandMessage(message: string): string {
  const exact: Record<string, string> = {
    "Cards are in the air": "发牌中",
    Preflop: "翻牌前",
    Flop: "翻牌",
    Turn: "转牌",
    River: "河牌",
    Showdown: "摊牌",
  };
  if (exact[message]) return exact[message];

  const takesPot = message.match(/^(.+) takes the pot$/);
  if (takesPot) return `${takesPot[1]} 收下底池`;

  const winsShowdown = message.match(/^(.+) wins the showdown$/);
  if (winsShowdown) return `${winsShowdown[1]} 摊牌获胜`;

  return message;
}

export function zhPokerAction(action?: string): string {
  if (!action) return "";
  if (action === "Fold") return "弃牌";
  if (action === "Check") return "过牌";

  const patterns: Array<[RegExp, string]> = [
    [/^Small blind (.+)$/, "小盲 $1"],
    [/^Big blind (.+)$/, "大盲 $1"],
    [/^All-in (.+)$/, "全下 $1"],
    [/^Call (.+)$/, "跟注 $1"],
    [/^Bet (.+)$/, "下注 $1"],
    [/^Raise to (.+)$/, "加注至 $1"],
  ];

  for (const [pattern, replacement] of patterns) {
    if (pattern.test(action)) return action.replace(pattern, replacement);
  }
  return action;
}
