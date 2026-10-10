// What 墨墨 says (and the voice reads out) when a word is written all correct. The praise grows
// with the streak of correct words. scripts/gen-tts.mjs records every line as public/audio/p/<id>.mp3.
// The text is a Chinese key — show it with t().

export const PRAISE = [
  // first word right (or the streak restarted)
  { id: 'a1', streak: 1, text: '对了！写得真好！' },
  { id: 'a2', streak: 1, text: '真棒，全对！' },
  { id: 'a3', streak: 1, text: '好样的！' },
  { id: 'a4', streak: 1, text: '写得很漂亮！' },
  { id: 'a5', streak: 1, text: '太好了，一笔都没错！' },
  // two in a row
  { id: 'b1', streak: 2, text: '又对了，真厉害！' },
  { id: 'b2', streak: 2, text: '连对两个，好棒！' },
  { id: 'b3', streak: 2, text: '越写越好了！' },
  // three in a row
  { id: 'c1', streak: 3, text: '连对三个，太厉害了！' },
  { id: 'c2', streak: 3, text: '哇，又对了！你是听写小高手！' },
  // four in a row
  { id: 'd1', streak: 4, text: '连对四个，了不起！' },
  { id: 'd2', streak: 4, text: '一个都没错，太厉害了！' },
  // five or more
  { id: 'e1', streak: 5, text: '连对这么多，听写小冠军就是你！' },
  { id: 'e2', streak: 5, text: '简直完美，你真是太了不起了！' },
  { id: 'e3', streak: 5, text: '停不下来啦！你太棒了！' },
  // a 再写一次 that came out right
  { id: 'r1', streak: 0, text: '这次写对啦，真棒！' },
  { id: 'r2', streak: 0, text: '你看，多练一次就会了！' },
]

/** A praise line for this streak (0 = a retry), not the same as the last one when there is a choice. */
export function pickPraise(streak, last = null) {
  const tier = streak === 0 ? 0 : Math.min(streak, 5)
  const lines = PRAISE.filter((p) => p.streak === tier && p.id !== last?.id)
  return lines[Math.floor(Math.random() * lines.length)] || PRAISE.find((p) => p.streak === tier)
}
