// Pure text ranking helpers for the document library

// Splits text into ~1,000-character chunks, ending at a paragraph or sentence break when one is near
export function split(text: string, size = 1000) {
  const chunks: string[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(text.length, start + size);
    if (end < text.length) {
      const paragraph = text.lastIndexOf("\n\n", end);
      const sentence = text.lastIndexOf(". ", end) + 1;
      end = paragraph > start + size / 2 ? paragraph : sentence > start + size / 2 ? sentence : end;
    }
    if (text.slice(start, end).trim()) chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks;
}

// Splits text into lowercase words for keyword scoring
const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

// Common words that match everything and say nothing about relevance
const stop = new Set("a an and are as at be by for from how i in is it me my of on or the to was what when where which who why with you your".split(" "));

// BM25 keyword score of each text for the query
export function bm25(query: string, texts: string[]) {
  const terms = [...new Set(words(query).filter((word) => !stop.has(word)))];
  const counts = texts.map((text) => {
    const count = new Map<string, number>();
    for (const word of words(text)) count.set(word, (count.get(word) ?? 0) + 1);
    return count;
  });
  const lengths = counts.map((count) => [...count.values()].reduce((sum, n) => sum + n, 0));
  const average = lengths.reduce((sum, n) => sum + n, 0) / texts.length || 1;
  const idf = terms.map((term) => {
    const df = counts.filter((count) => count.has(term)).length;
    return Math.log(1 + (texts.length - df + 0.5) / (df + 0.5));
  });
  return counts.map((count, i) =>
    terms.reduce((sum, term, t) => {
      const tf = count.get(term) ?? 0;
      return sum + (idf[t] * tf * 2.2) / (tf + 1.2 * (0.25 + (0.75 * lengths[i]) / average));
    }, 0),
  );
}

// Merges several score lists into one by reciprocal rank fusion
export function fuse(lists: number[][]) {
  const total: number[] = new Array(lists[0].length).fill(0);
  for (const scores of lists) {
    scores
      .map((score, index) => ({ score, index }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .forEach((hit, rank) => (total[hit.index] += 1 / (60 + rank)));
  }
  return total;
}
