// Run with: bun src/lib/rank.test.ts
import { bm25, fuse, split } from "./rank";

// Throws when two values differ
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
};

equal(split("a\n\nb").length, 1);
equal(split("x".repeat(2500)).map((chunk) => chunk.length), [1000, 1000, 500]);
equal(split("   "), []);

const texts = ["plants make food from sunlight", "the stock market rose", "sunlight and water feed plants"];
const keyword = bm25("plants sunlight", texts);
equal(keyword[1], 0);
equal(keyword[0] > 0 && keyword[2] > 0, true);

// Common words alone score nothing
equal(bm25("the and of", texts), [0, 0, 0]);

// A chunk ranked first by both lists beats one ranked first by a single list
const fused = fuse([[3, 2, 1], [3, 1, 2]]);
equal(fused[0] > fused[1] && fused[0] > fused[2], true);
equal(fuse([[0, 0]]), [0, 0]);
console.log("rank ok");
