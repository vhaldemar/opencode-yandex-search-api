# opencode-yc-search

Плагин для [OpenCode](https://opencode.ai), добавляющий провайдера веб-поиска через
**Yandex Cloud Web Search API** (`searchapi.api.cloud.yandex.net`).

## Возможности

- Регистрирует `websearch`-провайдера с ID **`yandex`**.
- Автоматически подставляет Yandex как поисковик по умолчанию (`websearch.provider`).
- Парсит XML-ответ Yandex (`<doc>` → `url`, `title`, `passage`, `modtime`) в стандартные
  результаты OpenCode `WebSearch.Result`.
- Поддерживает кооперативную отмену (`AbortSignal`) и таймаут запроса.
- API-ключ берётся из активного соединения интеграции `yandex` или переменной окружения
  `YC_API_KEY`.

## Быстрый старт

```sh
# 1. Собрать плагин
npm install
npm run build
```

Дальше подключите плагин в OpenCode (см. раздел «Установка»).

## Установка

### Требования

- Node.js ≥ 20 (для сборки).
- Активный OpenCode (проверено на v2.0.27, работает и на v2.0.31).

### Способ 1: глобально (рекомендуется) — плагин работает во всех проектах

Плагин подключается через legacy-конфиг OpenCode (ключ `plugin`), который используется
в установленных бинарях v2.0.x. Команды ниже кладут плагин в глобальный каталог конфига
и прописывают его в глобальный `opencode.json`.

```sh
# директория плагинов (если её ещё нет)
mkdir -p ~/.config/opencode/plugins

# скопировать собранный плагин
cp -r dist ~/.config/opencode/plugins/yc-search/dist
cp package.json ~/.config/opencode/plugins/yc-search/
printf 'export { default } from "./dist/index.js"\n' \
  > ~/.config/opencode/plugins/yc-search/index.js
```

Затем добавьте в `~/.config/opencode/opencode.json` запись в массив `plugin` (V1-формат —
это пара `[путь, options]`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "ai-studio/deepseek-v4-flash",
  "providers": { /* ... */ },
  "plugin": [
    ["./plugins/aisuite-hooks.mjs", { /* ... */ }],
    // 👇 наш плагин
    ["/home/<user>/.config/opencode/plugins/yc-search", {}]
  ],
  // необязательно, но удобно — сразу сделает Yandex поисковиком по умолчанию
  "websearch": { "provider": "yandex" }
}
```

### Способ 2: только в проекте — через `.opencode/plugins/`

Плагин, положенный в `.opencode/plugins/<name>/`, подхватывается автоматически:

```sh
mkdir -p .opencode/plugins/yc-search
cp -r dist .opencode/plugins/yc-search/dist
cp package.json .opencode/plugins/yc-search/
printf 'export { default } from "./dist/index.js"\n' \
  > .opencode/plugins/yc-search/index.js
```

### Способ 3: через конфиг V2 (`plugins`)

На свежих версиях (v2.0.31+) работает и штатный V2-ключ `plugins`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "/absolute/path/to/opencode-yc-search"
  ]
}
```

Либо как npm-пакет:

```jsonc
{
  "plugins": ["opencode-yc-search"]
}
```

### Перезапуск сервиса

После любого изменения конфига или кода плагина перезапустите сервис OpenCode:

```sh
opencode service restart
```

## Настройка API-ключа

Провайдер ищет ключ в следующем порядке:

1. Опция плагина `apiKey` (см. ниже).
2. Активное соединение интеграции `yandex`, заданное через меню интеграций
   (`/integrations`) методом **key**.
3. Переменная окружения **`YC_API_KEY`**.

Самый простой способ — просто задать переменную окружения:

```sh
export YC_API_KEY="AQVN..."
```

Ключ подойдёт тот же, что и для Yandex AI Studio (формат `AQVN...`).

### Через опции плагина

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/home/<user>/.config/opencode/plugins/yc-search",
      "options": {
        "apiKey": "AQVN...",
        "folderId": "b1g..."  // опционально, для API-ключа каталога
      }
    }
  ]
}
```

### Опционально: каталог (folder ID)

Для API-ключа каталога передайте идентификатор через опцию `folderId` или переменную
окружения `YANDEX_FOLDER_ID`. Отправится в заголовке `x-folder-id`.

## Как использовать

Веб-поиск в OpenCode — это **инструмент агента** (Web Search), а не отдельная команда.
Провайдер (`yandex`) подставляется автоматически, когда это настроено в `websearch.provider`
или агент выбирает его из доступных.

Просто попросите агента поискать в интернете обычным текстом:

- «Поищи в интернете, что такое X»
- «Найди последние новости про Y»
- «Сделай веб-поиск по запросу Z»

Агент вызовет инструмент **Web Search**, который пойдёт через Yandex, и вернёт результат с
ссылками.

### Проверка через API

```sh
# запрос через указанного провайдера
opencode api post /api/websearch --data '{"query":"тест","providerID":"yandex"}'

# запрос через провайдера по умолчанию
opencode api post /api/websearch --data '{"query":"тест"}'
```

Проверить список доступных провайдеров:

```sh
opencode api get /api/websearch/provider
```

## Как это работает

- `src/index.ts` — регистрация интеграции `yandex` (источники `key`/`env`) и
  `websearch`-провайдера; `execute` делает POST к Yandex Search API.
- `src/yandex-xml.ts` — декодирует и парсит XML-ответ Yandex
  (`<doc>` → `url`, `title`, `passage`, `modtime`) в стандартные `WebSearch.Result`.

## Разработка

```sh
npm run typecheck   # проверка типов
npm test            # сборка + юнит-тесты парсера и setup
```