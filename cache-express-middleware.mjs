import express from 'express'
import { LruCache } from './lru-cache.mjs'

// Object entries indexes
// const EntryName = 0
const EntryValue = 1

export class LruCacheExpressMiddleware {
  constructor() {
    this.router = express.Router()
    mountRoutes(this.router)
  }

  getMiddleware() {
    return this.router
  }
}

function mountRoutes(router) {
  router.post('/purgeStale', (req) => {
    handle('purgeStale', req.query.cacheName)
  })

  router.post('/clearCache', (req) => {
    handle('clearCache', req.query.cacheName)
  })

  router.get('/getOptions', (req, res) => {
    const stats = handle('getOptions', req.query.cacheName)
    res.status(200).send(stats)
  })

  router.get('/getStats', (req, res) => {
    const stats = handle('getStats', req.query.cacheName)
    res.status(200).send(stats)
  })

  router.post('/resetStats', (req) => {
    handle('resetStats', req.query.cacheName)
  })
}

function handle(functionName, cacheName) {
  if (cacheName == 'all') {
    const response = {}
    const caches = Object.entries(LruCache.caches)
    for (let i = 0; i < caches.length; i++) {
      response[cacheName] = caches[i][EntryValue].lruCache[functionName]()
    }
    return response
  }

  const cache = LruCache.caches[cacheName]
  if (cache == null) throw new Error(`no cache found for ${cacheName}`)
  const response = cache.lruCache[functionName]()
  return response
}
