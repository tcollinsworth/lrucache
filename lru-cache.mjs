import { LRUCache } from 'lru-cache'
import { scheduleTask } from 'cronosjs'
import merge from 'lodash.merge'

// Object entries indexes
const EntryName = 0
const EntryValue = 1

const defaultStats = {
  hits: 0,
  misses: 0,
  periodicClearing: false,
  periodicPruning: false,
}

const defaultCacheOptions = {
  periodicClearing: {
    schedule: '0 0 0 * * * *', // midnight UTC
    autoStart: false,
    running: false,
  },
  periodicPruning: {
    schedule: '0 0 * * * * *', // start of every hour
    autoStart: false, // 350 ms for 1M entries
    running: false,
  },
  nativeCacheOptions: {
    max: 10000, // override from undefined/forever
    ttl: 86400000, // 24 hours
    updateAgeOnGet: false, // (native default false) if true, resets TTL, still removes if max entries based on LRU
  },
}

/**
 * This is generic LRU Cache.
 *
 * The default TTL will not reset to 0 on get, therefore entries will only be returned for the TTL
 * The cache can be configured to reset to 0 on get.
 *
 * There is a process that can be started to periodically
 * - clear the cache at a specific time
 * - prune entries with expired TTL
 *
 * <pre>
 * https://www.npmjs.com/package/cronosjs
 * second, minute, hour, day of month, month, day of week, year
 * scheduled to run every Saturday @ 8:00:10pm  === '10 0 20 * * 6 *'
 * /*
 *   *  *  *  *  *  *  *    Field              Allowed values    Special symbols
 *   |  |  |  |  |  |  |    -----------------  ---------------   ---------------
 *   `--|--|--|--|--|--|->  Second (optional)  0-59              * / , -
 *      `--|--|--|--|--|->  Minute             0-59              * / , -
 *         `--|--|--|--|->  Hour               0-23              * / , -
 *            `--|--|--|->  Day of Month       1-31              * / , - ? L W
 *               `--|--|->  Month              1-12 or JAN-DEC   * / , -
 *                  `--|->  Day of Week        0-7 or SUN-SAT    * / , - ? L #
 *                     `->  Year (optional)    0-275759          * / , -
 * <pre>
 * @type {{periodicCacheclearSchedule: string}}
 */
export class LruCache {
  static caches = {}

  /**
   * Constructs a new LruCache, pass name and override options.
   *
   * Below are option with defaults if not specified. This class overrides some native lru-cache options.
   * See all native lru-cache options at {@link https://www.npmjs.com/package/lru-cache}
   * <pre>
   *   {
   *     periodicClearing: {
   *       schedule: '0 0 0 * * * *', // midnight UTC
   *       autoStart: false,
   *       running: false,
   *     },
   *     periodicPruning: {
   *       schedule: '0 0 * * * * *', // start of every hour
   *       autoStart: false,
   *       running: false,
   *     },
   *     nativeCacheOptions: {
   *       max: 10000, // override from undefined/forever
   *       ttl: 86400000, // 24 hours
   *       updateAgeOnGet: false, // (native default false) if true, resets TTL, still removes if max entries based on LRU
   *   }
   * </pre>
   * @param options
   */
  constructor(name, optionOverrides = defaultCacheOptions) {
    if (LruCache.caches[name] != null) throw new Error(`cache already exists for ${name}`)

    this.name = name
    LruCache.caches[name] = {}

    this.options = JSON.parse(JSON.stringify(defaultCacheOptions))
    this.options = merge(this.options, optionOverrides)

    this.cache = new LRUCache(this.options.nativeCacheOptions)
    this.resetStats()

    LruCache.caches[name].lruCache = this

    if (this.options.periodicClearing.autoStart) this.startPeriodicClearing()
    if (this.options.periodicPruning.autoStart) this.startPeriodicPruning()
  }

  /**
   * See set at {@link https://www.npmjs.com/package/lru-cache}
   *
   * Keys and values must not be null or undefined.
   *
   *
   * @param key - not null or undefined
   * @param value
   * @param options see set at {@link https://www.npmjs.com/package/lru-cache}
   * @returns {*} the cache object
   */
  put(key, value, options = {}) {
    return this.cache.set(key, value, options)
  }

  /**
   * Returns the cached object or undefined if no entry or expired TTL.
   *
   * See get at {@link https://www.npmjs.com/package/lru-cache}
   *
   * Options:
   * <pre>
   *   {
   *     updateAgeOnGet, // default false
   *     allowStale, // default false
   *     status
   *   }
   * </pre>
   *
   * @param key
   * @param value
   * @param options see get at {@link https://www.npmjs.com/package/lru-cache}
   * @returns {*} object from cache or undefined
   */
  get(key, value, options = {}) {
    const _value = this.cache.get(key, options)
    if (_value == null) {
      ++this.stats.misses
    } else {
      ++this.stats.hits
    }
    return _value
  }

  /**
   * Purge cache entries with expired TTL.
   */
  prune() {
    console.info(`start cache pruning of stale entries for ${this.name}`)
    this.cache.purgeStale()
    console.info(`end cache pruning of stale entries for ${this.name}`)
  }

  /**
   * Clear all entries in the cache.
   */
  clearCache() {
    console.info(`clear cache for ${this.name}`)
    this.cache.clear()
  }

  /**
   * Returns:
   * <pre>
   *   {
   *     hits: 0,
   *     misses: 0,
   *     entryCount: 0,
   *     periodicClearing: false,
   *     periodicPruning: false,
   *   }
   * </pre>
   */
  getStats() {
    const stats = JSON.parse(JSON.stringify(this.stats))
    stats.entryCount = this.cache.size
    stats.periodicClearing = this.periodicClearingId != null
    stats.periodicPruning = this.periodicPruningId != null
    return stats
  }

  /**
   * Resets stats to 0.<br>
   * The entryCount is dynamically computed and will still reflect the number of entries in the cache.
   */
  resetStats() {
    this.stats = JSON.parse(JSON.stringify(defaultStats))
  }

  /**
   * Start periodic cache clearing to remove all entries from the cache.
   *
   * @param schedule
   */
  startPeriodicClearing(schedule = this.options.periodicClearing.schedule) {
    if (this.periodicClearingId != null) {
      console.log(`periodic clearing for ${this.name} already running`)
      return
    }
    console.info(`initialized periodic cache clearing for ${this.name}`)
    this.periodicClearingId = scheduleTask(schedule, () => {
      try {
        console.info(`periodic cache clearing for ${this.name}`)
        this.cache.clear()
        /* c8 ignore next 3 */
      } catch (e) {
        console.error(`Error during periodic cache clearing for ${this.name}: ${e.message}`)
      }
    }, {
      timezone: 'UTC',
      missingHour: 'offset',
    })
  }

  /**
   * Stops periodic clearing if running.
   */
  stopPeriodicClearing() {
    if (this.periodicClearingId != null) {
      console.log(`stopping periodic clearing for ${this.name} already running`)
      clearInterval(this.periodicClearingId)
      this.periodicClearingId = undefined
    }
  }

  /**
   * Start periodic cache pruning to remove entries with expired TTL.
   *
   * @param schedule
   */
  startPeriodicPruning(schedule = this.options.periodicPruning.schedule) {
    if (this.periodicPruningId != null) {
      console.log(`periodic pruning for ${this.name} already running`)
      return
    }
    console.info(`initialized periodic cache pruning of stale entries for ${this.name}`)
    this.periodicPruningId = scheduleTask(schedule, () => {
      try {
        console.info(`periodic cache pruning for ${this.name}`)
        this.cache.purgeStale()
        /* c8 ignore next 3 */
      } catch (e) {
        console.error(`Error during periodic cache pruning for ${this.name}: ${e.message}`)
      }
    }, {
      timezone: 'UTC',
      missingHour: 'offset',
    })
  }

  /**
   * Stops periodic pruning if running.
   */
  stopPeriodicPruning() {
    if (this.periodicPruningId != null) {
      console.log(`stopping periodic pruning for ${this.name} already running`)
      clearInterval(this.periodicPruningId)
      this.periodicPruningId = undefined
    }
  }

  /**
   * Stops periodic clearing and pruning if running.
   */
  shutdown() {
    this.stopPeriodicClearing()
    this.stopPeriodicPruning()
  }

  /**
   * Returns the options for all LruCaches.
   *
   * <pre>
   *   {
   *     <cacheName>: {
   *       <options>
   *     },
   *     ...
   *   }
   * </pre>
   *
   * @returns {{}}
   */
  static getOptions() {
    const options = {}
    const caches = Object.entries(LruCache.caches)
    for (let i = 0; i < caches.length; i++) {
      options[caches[i][EntryName]] = caches[i][EntryValue].lruCache.options
    }
    return options
  }

  /**
   * Returns the status for all LruCaches.
   *
   * <pre>
   *   {
   *     <cacheName>: {
   *       <status>
   *     },
   *     ...
   *   }
   * </pre>
   *
   * @returns {{}}
   */
  static getStatus() {
    const status = {}
    const caches = Object.entries(LruCache.caches)
    for (let i = 0; i < caches.length; i++) {
      status[caches[i][EntryName]] = caches[i][EntryValue].lruCache.getStats()
    }
    return status
  }
}
