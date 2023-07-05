// eslint-disable-next-line import/no-unresolved
import test from 'ava'
import delay from 'delay'
import { LruCache } from '../lru-cache.mjs'

test('chunked pruning max time', async (t) => {
  const cache = new LruCache('fooCache', {
    nativeCacheOptions: {
      max: 100000,
    },
  })

  for (let i = 0; i < 100000; i++) {
    cache.put(`a${i}`, i)
  }

  const startTs = Date.now()
  await cache.prune()
  const time = Date.now() - startTs
  console.log(`prune took: ${time} ms`)
  // typically takes < 50 ms for 100K entries
  t.truthy(time <= 1000)
})

test('multiple caches', (t) => {
  const aCache = new LruCache('aCache')
  t.falsy(aCache.get('a1'))
  aCache.put('a1', 1)
  t.is(aCache.get('a1'), 1)
  aCache.put('a1', 2)
  const bCache = new LruCache('bCache')
  bCache.put('b1', 1)
  bCache.put('b1', 2)

  const aCacheExpectedOptions = {
    periodicClearing: { schedule: '0 0 0 * * * *', autoStart: false, running: false },
    periodicPruning: { schedule: '0 0 * * * * *', autoStart: false, running: false },
    nativeCacheOptions: { max: 10000, ttl: 86400000, updateAgeOnGet: false },
  }

  const bCacheExpectedOptions = {
    periodicClearing: { schedule: '0 0 0 * * * *', autoStart: false, running: false },
    periodicPruning: { schedule: '0 0 * * * * *', autoStart: false, running: false },
    nativeCacheOptions: { max: 10000, ttl: 86400000, updateAgeOnGet: false },
  }

  const aCacheExpectedStatus = {
    hits: 1,
    misses: 1,
    periodicClearing: false,
    periodicPruning: false,
    entryCount: 1,
  }

  const bCacheExpectedStatus = {
    hits: 0,
    misses: 0,
    periodicClearing: false,
    periodicPruning: false,
    entryCount: 1,
  }

  t.deepEqual(LruCache.getOptions().aCache, aCacheExpectedOptions, 'options')
  t.deepEqual(LruCache.getOptions().bCache, bCacheExpectedOptions, 'options')
  t.deepEqual(LruCache.getStatus().aCache, aCacheExpectedStatus, 'status')
  t.deepEqual(LruCache.getStatus().bCache, bCacheExpectedStatus, 'status')

  aCache.clearCache()
  t.falsy(aCache.get('a1'))
  t.falsy(aCache.get('a2'))

  t.falsy(aCache.getStats().periodicPruning)
  t.falsy(aCache.getStats().periodicClearing)
})

test('dupe cache name throws error', (t) => {
  try {
    // eslint-disable-next-line no-new
    new LruCache('xCache')
    // eslint-disable-next-line no-new
    new LruCache('xCache')
    t.fail('expected error')
  } catch (e) {
    t.pass('expected error')
  }
})

test('periodic pruning', async (t) => {
  const pCache = new LruCache('pCache', {
    ttl: 100,
    periodicPruning: {
      schedule: '* * * * * * *',
    },
  })
  pCache.put('p1', 1, { ttl: 1000 })
  t.is(pCache.get('p1'), 1)

  pCache.startPeriodicPruning()
  // intentionally call twice to ensure no error
  pCache.startPeriodicPruning()

  const timeout = Date.now() + 2000
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (pCache.get('p1', { allowStale: true }) != null) {
      if (Date.now() > timeout) throw new Error('timeout waiting for cache prune')
      await delay(100)
    } else {
      break
    }
  }

  pCache.shutdown()
})

test('periodic clearing', async (t) => {
  const cCache = new LruCache('cCache', {
    ttl: 100,
    periodicClearing: {
      schedule: '* * * * * * *',
    },
  })
  cCache.put('p1', 1, { ttl: 1000 })
  t.is(cCache.get('p1'), 1)

  cCache.startPeriodicClearing()
  // intentionally call twice to ensure no error
  cCache.startPeriodicClearing()

  const timeout = Date.now() + 2000
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (cCache.get('p1', { allowStale: true }) != null) {
      if (Date.now() > timeout) throw new Error('timeout waiting for cache prune')
      await delay(100)
    } else {
      break
    }
  }

  cCache.shutdown()
  t.falsy(cCache.getStats().periodicPruning)
  t.falsy(cCache.getStats().periodicClearing)
})

test('autostart pruning/clearing', (t) => {
  const zCache = new LruCache('zCache', {
    periodicPruning: {
      autoStart: true,
    },
    periodicClearing: {
      autoStart: true,
    },
  })
  t.truthy(zCache.getStats().periodicPruning)
  t.truthy(zCache.getStats().periodicClearing)
})

test('remove', (t) => {
  const dCache = new LruCache()

  t.falsy(dCache.get('d1'))
  dCache.put('d1', 1)
  t.is(dCache.get('d1'), 1)
  t.truthy(dCache.remove('d1'))
  t.falsy(dCache.get('d1'))
})
