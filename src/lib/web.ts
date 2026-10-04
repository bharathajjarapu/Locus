export const keyName = "tinyfishKey";
type Hit = { title: string; url: string; snippet: string };

// Jina's reader fetches pages for the browser, which most sites block cross-origin
const reader = "https://r.jina.ai/";

// Calls TinyFish, returning null without a key or on failure so the free fallback runs
async function tinyfish(url: string, init: RequestInit = {}) {
  const token = localStorage.getItem(keyName)?.trim();
  if (!token) return null;
  const response = await fetch(url, { ...init, headers: { "X-API-Key": token, "Content-Type": "application/json" } }).catch(() => null);
  return response?.ok ? response.json() : null;
}

// Searches the web with TinyFish, or DuckDuckGo without a key
export async function find(query: string): Promise<Hit[]> {
  const found = await tinyfish(`https://api.search.tinyfish.ai/?query=${encodeURIComponent(query)}`);
  if (found?.results) return found.results.slice(0, 5);
  const response = await fetch(`${reader}https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { "X-Return-Format": "html" } });
  if (!response.ok) throw new Error(`Search failed (${response.status})`);
  const page = new DOMParser().parseFromString(await response.text(), "text/html");
  return [...page.querySelectorAll(".web-result")].slice(0, 5).map((result) => {
    const link = result.querySelector<HTMLAnchorElement>(".result__a");
    // DuckDuckGo wraps each link in a redirect that carries the real address
    const url = new URL(link?.getAttribute("href") ?? "", "https://duckduckgo.com").searchParams.get("uddg") ?? "";
    return { title: link?.textContent?.trim() ?? "", url, snippet: result.querySelector(".result__snippet")?.textContent?.trim() ?? "" };
  });
}

// Reads a page as Markdown with TinyFish, or Jina without a key
export async function read(url: string) {
  if (!/^https?:\/\//i.test(url)) throw new Error("Give a full http or https address");
  const fetched = await tinyfish("https://api.fetch.tinyfish.ai", { method: "POST", body: JSON.stringify({ urls: [url] }) });
  let text: string = fetched?.results?.[0]?.text ?? "";
  if (!text) {
    const response = await fetch(reader + url);
    if (!response.ok) throw new Error(`Fetch failed (${response.status})`);
    text = await response.text();
  }
  return text.length > 6000 ? `${text.slice(0, 6000)}\n…` : text;
}
