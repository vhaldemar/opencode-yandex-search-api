# opencode-yc-search

Плагин для [OpenCode](https://opencode.ai), добавляющий провайдера веб-поиска через
**Yandex Cloud Web Search API** (`searchapi.api.cloud.yandex.net`).

## Возможности

- Регистрирует `websearch`-провайдера с ID `yandex` — им можно пользоваться напрямую
  (`/websearch`, авто-поиск в агенте) или выбрать как провайдера по умолчанию.
- Парсит XML-ответ Yandex (`<doc>` → `url`, `title`, `passage`, `modtime`) в стандартные
  результаты OpenCode `WebSearch.Result`.
- Поддерживает кооперативную отмену (`AbortSignal`) и таймаут запроса.

## Установка

Соберите плагин:

```sh
npm install
npm run build
```

Подключите в конфигурации OpenCode (`opencode.json` в проекте или глобально):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "/absolute/path/to/opencode-yc-search",
    // или "./packages/opencode-yc-search"
  ]
}
```

Подключение через npm-пакет:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-yc-search"]
}
```

### Если плагин не подхватывается (legacy конфиг)

Установленный бинарь OpenCode может использовать legacy/V1 формат конфигурации
(ключ `plugin`, а не `plugins`). В этом случае положите плагин в `.opencode/plugins/`
любого проекта — он подключится автоматически:

```sh
mkdir -p .opencode/plugins/yc-search
cp -r <repo>/dist .opencode/plugins/yc-search/dist
cp <repo>/package.json .opencode/plugins/yc-search/
printf 'export { default } from "./dist/index.js"\n' \
  > .opencode/plugins/yc-search/index.js
```

После изменения конфига/плагина перезапустите сервис: `opencode service restart`.

## Настройка API-ключа

Провайдер ищет ключ в следующем порядке:

1. Опция плагина `apiKey` в `opencode.json` (не рекомендуется хранить ключ в конфиге).
2. Активное соединение интеграции `yandex`, заданное через меню интеграций
   (`/integrations`) методом **key**.
3. Переменная окружения **`YC_API_KEY`**.

```sh
export YC_API_KEY="AQVN..."
```

### Опционально: каталог (folder ID)

Для API-ключа каталога передайте идентификатор каталога:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-yc-search",
      "options": {
        "folderId": "b1g..."
      }
    }
  ],
  "websearch": { "provider": "yandex" }
}
```

Либо через переменную окружения `YANDEX_FOLDER_ID`.

## Проверка

После установки проверьте, что провайдер доступен:

```sh
opencode api post /api/websearch  # или в TUI: /websearch
```

## Как это работает

- `src/index.ts` — регистрация интеграции `yandex` (источники `key`/`env`) и
  `websearch`-провайдера.
- `src/yandex-xml.ts` — парсер XML-ответа Yandex в результаты.