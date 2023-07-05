# LruCache

This lib uses [lru-cache](https://www.npmjs.com/package/lru-cache).

It provides:

  * Express middleware for inspection and management of all caches
    * Statistics - hits, misses, entry count
  * Scheduled periodic pruning and clearing

# Usage

```javascript
const app = express()

const options = {
  periodicClearing: { autoStart: true },
  periodicPruning: { autoStart: true },
  nativeCacheOptions: { max: 10000, ttl: 86400000 },
}

const aCache = new LruCache(options)
const bCache = new LruCache(options)

const lruExpress = new LruCacheExpressMiddleware()

app.use('/lru-cache', lruExpress.getMiddleware())
```

# REST APIs

 * /purgeStale?cacheName=ALL | <cacheName>
 * /clearCache?cacheName=ALL | <cacheName>
 * /getOptions?cacheName=ALL | <cacheName>
 * /getStats?cacheName=ALL | <cacheName>
 * /resetStats?cacheName=ALL | <cacheName>

# Periodic Scheduling

Uses [cronosjs](https://www.npmjs.com/package/cronosjs)

```text
second, minute, hour, day of month, month, day of week, year
scheduled to run every Saturday @ 8:00:10pm  === '10 0 20 * * 6 *'
/*
  *  *  *  *  *  *  *    Field              Allowed values    Special symbols
  |  |  |  |  |  |  |    -----------------  ---------------   ---------------
  `--|--|--|--|--|--|->  Second (optional)  0-59              * / , -
     `--|--|--|--|--|->  Minute             0-59              * / , -
        `--|--|--|--|->  Hour               0-23              * / , -
           `--|--|--|->  Day of Month       1-31              * / , - ? L W
              `--|--|->  Month              1-12 or JAN-DEC   * / , -
                 `--|->  Day of Week        0-7 or SUN-SAT    * / , - ? L #
                    `->  Year (optional)    0-275759          * / , -
```
