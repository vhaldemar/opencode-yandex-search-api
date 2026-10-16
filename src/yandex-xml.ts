/** Parses Yandex Web Search XML (decoded from base64 `rawData`) into OpenCode `WebSearch.Result` items. */

export interface ParsedResult {
  readonly url: string
  readonly title?: string
  readonly content?: string
  readonly published?: number
}

const unwrap = (xml: string, tag: string): string | undefined => {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`)
  const match = xml.match(re)
  if (!match) return undefined
  const text = stripTags(match[1])
  return text.length > 0 ? text : undefined
}

const findAll = (xml: string, tag: string): string[] => {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g")
  const out: string[] = []
  for (const match of xml.matchAll(re)) {
    const text = stripTags(match[1])
    if (text.length > 0) out.push(text)
  }
  return out
}

/** Removes XML/HTML tags and collapses whitespace. */
const stripTags = (value: string): string =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()

/**
 * Yandex `modtime` is `YYYYMMDDTHHMMSS` (e.g. `20231030T195854`) in local timezone.
 * Parse it into a UTC epoch millisecond timestamp.
 */
const parseModtime = (value: string): number | undefined => {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})[Tt](\d{2})(\d{2})(\d{2})$/)
  if (!m) {
    // Fall back to Date.parse for other formats.
    const time = Date.parse(value)
    return Number.isFinite(time) ? time : undefined
  }
  const [, y, mo, d, h, mi, s] = m
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  return Number.isFinite(ms) ? ms : undefined
}

/**
 * Extracts one or more `<doc>` blocks from a Yandex XML `rawData` fragment
 * (the base64-decoded XML). Each result includes url, title, snippet and
 * publication time.
 */
export const parseYandexResults = (rawData: string): ParsedResult[] => {
  const results: ParsedResult[] = []
  const docRe = /<doc(?:[^>]*)>([\s\S]*?)<\/doc>/g
  for (const match of rawData.matchAll(docRe)) {
    const doc = match[1]
    const url = unwrap(doc, "url") ?? unwrap(doc, "Url") ?? unwrap(doc, "URL")
    if (!url) continue
    const title = unwrap(doc, "title") ?? unwrap(doc, "Title")
    // Prefer passages, then headline, then extended-text as the snippet.
    const passages = findAll(doc, "passage")
    const content =
      passages[0] ?? unwrap(doc, "headline") ?? unwrap(doc, "extended-text")
    const modtime = unwrap(doc, "modtime")
    results.push({
      url,
      ...(title ? { title } : {}),
      ...(content ? { content } : {}),
      ...(modtime ? { published: parseModtime(modtime) } : {}),
    })
  }
  return results
}