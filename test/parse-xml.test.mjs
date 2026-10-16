import { parseYandexResults } from "../dist/yandex-xml.js"

const sample = `<?xml version="1.0" encoding="utf-8"?>
<yandexsearch>
  <request><query>тест запрос</query><page>0</page></request>
  <response version="2.0">
    <found>2</found>
    <results>
      <grouping mode="flat" onpage="10" groups-on-page="10" docs-in-group="1">
        <group>
          <doc>
            <url>https://example.com/article</url>
            <domain>example.com</domain>
            <title><hlword>Тест</hlword> статьи по поиску</title>
            <passages>
              <passage>Здесь текст <hlword>отрывка</hlword> с описанием результата.</passage>
            </passages>
            <modtime>2024-05-01T10:30:00.000Z</modtime>
            <headline>Заголовок сниппета</headline>
          </doc>
        </group>
        <group>
          <doc>
            <url>https://example.org/other</url>
            <title>Второй результат без отрывка</title>
            <modtime>2023-12-15T00:00:00Z</modtime>
          </doc>
        </group>
      </grouping>
    </results>
  </response>
</yandexsearch>`

const results = parseYandexResults(sample)
console.log(JSON.stringify(results, null, 2))

// assertions
if (results.length !== 2) throw new Error(`expected 2 results, got ${results.length}`)
const first = results[0]
if (first.url !== "https://example.com/article") throw new Error(`bad url: ${first.url}`)
if (first.title !== "Тест статьи по поиску") throw new Error(`bad title: ${first.title}`)
if (first.content !== "Здесь текст отрывка с описанием результата.")
  throw new Error(`bad content: ${first.content}`)
if (first.published !== Date.parse("2024-05-01T10:30:00.000Z"))
  throw new Error(`bad published: ${first.published}`)
const second = results[1]
if (second.title !== "Второй результат без отрывка") throw new Error(`bad title2: ${second.title}`)
if (second.content !== undefined) throw new Error(`expected no content, got ${second.content}`)
if (second.published !== Date.parse("2023-12-15T00:00:00Z")) throw new Error(`bad published2: ${second.published}`)

console.log("OK: parseYandexResults works correctly")

// Yandex real-world modtime format: YYYYMMDDTHHMMSS (local time, interpreted as UTC for stability).
const realSample = `<?xml version="1.0"?><yandexsearch><response>
<results><grouping mode="flat">
<group><doc id="X">
<url>https://yandex.cloud/ru/services/search-api</url>
<title><hlword>Yandex</hlword> Search API</title>
<headline>Сервис для получения ответов поисковой базы Яндекса.</headline>
<modtime>20231030T195854</modtime>
</doc></group>
</grouping></results></response></yandexsearch>`
const real = parseYandexResults(realSample)
if (real.length !== 1) throw new Error(`expected 1 real result, got ${real.length}`)
if (real[0].url !== "https://yandex.cloud/ru/services/search-api") throw new Error("bad real url")
if (real[0].title !== "Yandex Search API") throw new Error(`bad real title: ${real[0].title}`)
if (real[0].content !== "Сервис для получения ответов поисковой базы Яндекса.")
  throw new Error(`bad real content: ${real[0].content}`)
// 2023-10-30T19:58:54 UTC
const expectedMs = Date.UTC(2023, 9, 30, 19, 58, 54)
if (real[0].published !== expectedMs) throw new Error(`bad real published: ${real[0].published} expected ${expectedMs}`)
console.log("OK: real-world modtime format (YYYYMMDDTHHMMSS) parsed; published=", new Date(real[0].published).toISOString())