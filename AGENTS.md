# AGENTS.md

> Начни с чтения [**README.md**](./README.md) — там полная инструкция по установке,
> настройке и использованию проекта.

## Проект

`opencode-yc-search` — плагин для [OpenCode](https://opencode.ai), который добавляет
провайдера веб-поиска через **Yandex Cloud Web Search API**.

Плагин регистрирует `websearch`-провайдера с ID `yandex`, интеграцию `yandex`
(источники `key`/`env`) и умеет подставлять Yandex как поисковик по умолчанию.

## Ключевые факты

- **Стек:** TypeScript + Promise API плагинов OpenCode (`@opencode/plugin`).
- **Endpoint:** Yandex Search API — `https://searchapi.api.cloud.yandex.net/v2/web/search`.
- **API-ключ:** ищется в порядке: опция плагина `apiKey` → интеграция `yandex` →
  переменная окружения `YC_API_KEY`.
- **Ответ API:** `rawData` в теле ответа — это **base64**-закодированный XML
  (дешифруется в `src/index.ts` через `decodeRawData`).

## Структура

- `src/index.ts` — запись плагина: регистрация интеграции `yandex` + websearch-провайдера,
  `execute` делает POST к Yandex Search API.
- `src/yandex-xml.ts` — декодирование/парсинг XML-ответа (`<doc>` → `url`, `title`,
  `passage`, `modtime`) в стандартный `WebSearch.Result`. `modtime` в формате
  `YYYYMMDDTHHMMSS`, у тегов есть `<hlword>`-обёртки.
- `test/` — юнит-тесты парсера (`parse-xml.test.mjs`) и smoke-тест setup
  (`smoke-setup.test.mjs`).
- `package.json` — build/typecheck/test скрипты.

## Команды

```sh
npm install       # установка зависимостей
npm run build     # сборка в dist/
npm run typecheck # проверка типов (tsc --noEmit)
npm test          # сборка + запуск тестов
```

## Замечания при изменениях

- **Тип контракта `WebSearch.Result`:** возвращай `{ url, title?, content?, time: { published? } }`.
- **`execute`** должен кооперативно отменяться через `context.signal` и иметь таймаут.
- После изменения исходников — `npm run build`. Плагин в глобальном конфиге
  (`~/.config/opencode/plugins/yc-search`) — это копия `dist/`; для обновления её нужно
  перекопировать и выполнить `opencode service restart`.
- Парсинг XML максимально лёгкий (без внешних XML-зависимостей) — сохраняй этот подход.