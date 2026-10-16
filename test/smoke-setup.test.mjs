import plugin from "../dist/index.js"

const editorMethods = []
const editorAdds = []
const integrationTransforms = []
const websearchTransforms = []

const integrationEditor = {
  update(id, fn) {
    const it = { name: id }
    fn(it)
    integrationTransforms.push({ op: "update", id, name: it.name })
  },
  method: {
    update(input) {
      editorMethods.push(input)
    },
  },
}

const websearchEditor = {
  add(def) {
    editorAdds.push(def)
  },
}

let transformCalls = 0
const ctx = {
  options: {},
  integration: {
    transform: (cb) => {
      transformCalls++
      cb(integrationEditor)
      return Promise.resolve({ dispose: async () => {} })
    },
    connection: {
      active: async () => undefined,
      resolve: async () => undefined,
    },
  },
  websearch: {
    transform: (cb) => {
      transformCalls++
      cb(websearchEditor)
      return Promise.resolve({ dispose: async () => {} })
    },
  },
}

const cleanup = await plugin.setup(ctx)
console.log("setup returned cleanup:", typeof cleanup)
await cleanup()

if (transformCalls !== 2) throw new Error(`expected 2 transform calls, got ${transformCalls}`)
if (integrationTransforms.length !== 1) throw new Error("integration.update not called once")
if (integrationTransforms[0].name !== "Yandex Cloud Search")
  throw new Error(`bad integration name: ${integrationTransforms[0].name}`)
if (editorMethods.length !== 2) throw new Error(`expected 2 methods, got ${editorMethods.length}`)
if (editorMethods[0].method.type !== "key") throw new Error("expected key method first")
if (editorMethods[1].method.type !== "env") throw new Error("expected env method second")
if (JSON.stringify(editorMethods[1].method.names) !== '["YC_API_KEY","YANDEX_FOLDER_ID"]')
  throw new Error(`bad env names: ${JSON.stringify(editorMethods[1].method.names)}`)
if (editorAdds.length !== 1) throw new Error("websearch provider not added")
const provider = editorAdds[0]
if (provider.id !== "yandex") throw new Error(`bad provider id: ${provider.id}`)
if (provider.name !== "Yandex Cloud Search") throw new Error(`bad provider name: ${provider.name}`)
if (typeof provider.execute !== "function") throw new Error("provider.execute is not a function")

console.log("SMOKE OK: setup registers integration (key + env) and websearch provider (yandex)")