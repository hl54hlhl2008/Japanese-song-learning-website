// 本项目只发布网页端（Vite + React），不再构建 Android / Windows 客户端。
// 历史代码里保留了原生平台分支与相关组件，这里提供与 @capacitor/* 同形的浏览器实现：
// 原生判断恒为 false；HTTP 走 fetch（与 Capacitor 在浏览器中的行为一致）；
// 原生插件调用返回未实现的拒绝。这样这些分支在网页上恒走非原生路径，仓库也不再依赖 Capacitor 包。

const rejectAsUnimplemented = (name) => {
  const error = new Error(`${name}() is not implemented on web`)
  error.code = 'UNIMPLEMENTED'
  return Promise.reject(error)
}

function createPluginProxy(name) {
  const methods = new Map()
  return new Proxy({}, {
    get(_target, property) {
      if (typeof property !== 'string') return undefined
      if (!methods.has(property)) {
        methods.set(property, () => rejectAsUnimplemented(`${name}.${property}`))
      }
      return methods.get(property)
    },
  })
}

export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web',
  isPluginAvailable: () => false,
  convertFileSrc: (url) => url,
}

export const registerPlugin = (name) => createPluginProxy(name)

async function httpRequest({ url, method = 'GET', headers = {}, data, responseType = 'json' } = {}) {
  const init = { method, headers: { ...headers } }
  if (data !== undefined && data !== null) {
    if (typeof data === 'string' || (typeof Blob !== 'undefined' && data instanceof Blob)) {
      init.body = data
    } else {
      init.body = JSON.stringify(data)
      init.headers['Content-Type'] = init.headers['Content-Type'] ?? 'application/json'
    }
  }
  const response = await fetch(url, init)
  let payload
  if (responseType === 'blob') payload = await response.blob()
  else if (responseType === 'arraybuffer') payload = await response.arrayBuffer()
  else if (responseType === 'text') payload = await response.text()
  else {
    const text = await response.text()
    try { payload = JSON.parse(text) } catch { payload = text }
  }
  return {
    data: payload,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    url: response.url,
  }
}

export const CapacitorHttp = {
  request: httpRequest,
  get: (options) => httpRequest({ ...options, method: 'GET' }),
  post: (options) => httpRequest({ ...options, method: 'POST' }),
  put: (options) => httpRequest({ ...options, method: 'PUT' }),
  patch: (options) => httpRequest({ ...options, method: 'PATCH' }),
  delete: (options) => httpRequest({ ...options, method: 'DELETE' }),
}

export const App = {
  addListener: async () => ({ remove: async () => {} }),
  removeAllListeners: async () => {},
  exitApp: async () => {},
  minimizeApp: async () => {},
  getInfo: async () => ({ version: 'web', build: 'web' }),
  getState: async () => ({ isActive: true }),
}

export const Browser = {
  open: async ({ url } = {}) => {
    if (typeof url === 'string' && url) window.open(url, '_blank', 'noopener,noreferrer')
  },
  close: async () => {},
}
