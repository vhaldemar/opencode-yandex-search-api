import { Plugin } from "@opencode/plugin"
import type { WebSearch } from "@opencode/plugin"
import { parseYandexResults } from "./yandex-xml.js"

/**
 * Yandex Cloud Web Search endpoint.
 * https://aistudio.yandex.ru/ru/docs/search-api/api-ref/WebSearch/search
 */
export const ENDPOINT = "https://searchapi.api.cloud.yandex.net/v2/web/search"

/** Environment variable used as the default API-key source. */
export const API_KEY_ENV = "YC_API_KEY"

/** Optional environment variable for the catalog (folder) ID. */
export const FOLDER_ID_ENV = "YANDEX_FOLDER_ID"

export interface YandexOptions {
  /** API key; overrides the active integration credential and the YC_API_KEY env var. */
  readonly apiKey?: string
  /** Catalog (folder) ID used as the `x-folder-id` header. */
  readonly folderId?: string
  readonly region?: string
  readonly groupsOnPage?: number
  readonly docsInGroup?: number
  readonly maxPassages?: number
}

interface Body {
  query: { queryText: string; searchType: string; familyMode: string }
  groupSpec: { groupMode: string; groupsOnPage: string; docsInGroup: string }
  maxPassages: string
  responseFormat: string
  region?: string
}

const buildBody = (query: string, options: YandexOptions): Body => ({
  query: { queryText: query, searchType: "SEARCH_TYPE_RU", familyMode: "FAMILY_MODE_NONE" },
  groupSpec: {
    groupMode: "GROUP_MODE_FLAT",
    groupsOnPage: options.groupsOnPage ? String(options.groupsOnPage) : "10",
    docsInGroup: options.docsInGroup ? String(options.docsInGroup) : "1",
  },
  maxPassages: options.maxPassages ? String(options.maxPassages) : "1",
  responseFormat: "FORMAT_XML",
  ...(options.region ? { region: options.region } : {}),
})

/**
 * `rawData` ships as a base64-encoded XML string. Decode it; if it is already
 * XML text (for example from a mock), return it unchanged.
 */
const decodeRawData = (rawData: string): string => {
  const trimmed = rawData.trim()
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) return trimmed
  try {
    const decoded = Buffer.from(rawData, "base64").toString("utf-8")
    return decoded.startsWith("<") ? decoded : rawData
  } catch {
    return rawData
  }
}

/** Resolves the API key: explicit option → active integration credential → env. */
async function resolveApiKey(
  integration: Plugin.Context["integration"],
  explicit?: string,
  folderId?: string,
): Promise<{ apiKey: string; folderId?: string }> {
  let apiKey = explicit
  let resolvedFolderId = folderId ?? process.env[FOLDER_ID_ENV]
  if (!apiKey) {
    try {
      const connection = await integration.connection.active("yandex")
      if (connection) {
        const credential = await integration.connection.resolve(connection)
        if (credential?.type === "key") apiKey = credential.key
      }
    } catch {
      // Fall through to the env default.
    }
  }
  apiKey = apiKey ?? process.env[API_KEY_ENV]
  if (!apiKey)
    throw new Error(
      "Yandex Search API key is missing. Set it via /integrations, the plugin apiKey option, or the YC_API_KEY environment variable.",
    )
  return { apiKey, folderId: resolvedFolderId }
}

const scopeAbort = (ms: number, signal?: AbortSignal) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  const onAbort = () => controller.abort()
  signal?.addEventListener("abort", onAbort, { once: true })
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
    },
  }
}

export function makeExecute(integration: Plugin.Context["integration"], options: YandexOptions) {
  return async (
    input: WebSearch.ProviderInput,
    context: { readonly signal: AbortSignal },
  ): Promise<readonly WebSearch.Result[]> => {
    const { query } = input
    const { signal } = context
    const { apiKey, folderId } = await resolveApiKey(integration, options.apiKey, options.folderId)
    const guard = scopeAbort(25_000, signal)
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        signal: guard.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(folderId ? { "x-folder-id": folderId } : {}),
        },
        body: JSON.stringify(buildBody(query, options)),
      })
      if (!response.ok) {
        const detail = await response.text().catch(() => "")
        throw new Error(`Yandex Web Search failed (${response.status}): ${detail.slice(0, 300)}`)
      }
      const payload = (await response.json()) as { rawData?: string }
      if (!payload.rawData) throw new Error("Yandex Web Search returned no rawData")
      // `rawData` is a base64-encoded XML document.
      const xml = decodeRawData(payload.rawData)
      return parseYandexResults(xml).map((r) => ({
        url: r.url,
        ...(r.title ? { title: r.title } : {}),
        ...(r.content ? { content: r.content } : {}),
        time: { ...(r.published ? { published: r.published } : {}) },
      }))
    } finally {
      guard.done()
    }
  }
}

export default Plugin.define({
  id: "opencode.yc-search",
  setup(ctx) {
    const options = (ctx.options ?? {}) as YandexOptions
    const disposers: Array<() => Promise<void>> = []

    void ctx.integration
      .transform((editor) => {
        editor.update("yandex", (it) => {
          it.name = "Yandex Cloud Search"
        })
        editor.method.update({ integrationID: "yandex", method: { type: "key", label: "Yandex Search API key" } })
        editor.method.update({ integrationID: "yandex", method: { type: "env", names: [API_KEY_ENV, FOLDER_ID_ENV] } })
      })
      .then((r) => disposers.push(() => r.dispose()))

    void ctx.websearch
      .transform((editor) =>
        editor.add({
          id: "yandex",
          name: "Yandex Cloud Search",
          execute: makeExecute(ctx.integration, options),
        }),
      )
      .then((r) => disposers.push(() => r.dispose()))

    return () => Promise.all(disposers.map((d) => d())).then(() => {})
  },
})