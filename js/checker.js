/* ============================================================
   URL-Checker
   Prüft im Browser, ob ein Link antwortet — ohne Backend, ohne API-Key.

   Drei Ergebnisse pro Link:
   - online   → der Server hat geantwortet (grün)
   - blocked  → nur dieser Link antwortet nicht: blockiert, offline oder
                zu langsam (rot)
   - network  → gar nichts geht raus; eine Kontroll-Anfrage an einen
                neutralen Server scheitert ebenfalls. Dann liegt es
                vermutlich am Netzwerk-/Schul-Filter, nicht am Link (orange).
   - unknown  → kein prüfbarer http(s)-Link

   Grenzen: Der Check läuft als `fetch(..., { mode: 'no-cors' })`. Es kommt ein
   undurchsichtiges ("opaque") Response-Objekt zurück, HTTP-Status und Inhalt
   sind aus Sicherheitsgründen nicht lesbar. Eine Filter-Seite, die mit
   HTTP 200 antwortet, sieht deshalb wie "online" aus. Ebenso wenig lässt sich
   prüfen, ob eine Seite das Einbetten im iframe erlaubt.
   ============================================================ */
(function () {
  'use strict';

  var CACHE_MS = 5 * 60 * 1000;
  var CONTROL_TTL = 30 * 1000;
  var CONTROL_URL = 'https://www.gstatic.com/generate_204';

  var cache = new Map(); // href -> { at, result }
  var control = { at: 0, ok: null }; // Ist überhaupt Internet da?

  var STATUS = Object.freeze({
    online: 'online',
    blocked: 'blocked',
    network: 'network',
    unknown: 'unknown'
  });

  function normalize(url) {
    if (!url || typeof url !== 'string') return null;
    try {
      var parsed = new URL(url, window.location.href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.href;
    } catch (err) {
      return null;
    }
  }

  /* Kontroll-Anfrage: unterscheidet "dieser Link ist kaputt" von
     "das ganze Netz ist blockiert". Ergebnis wird 30 s zwischengespeichert. */
  function networkReachable() {
    var now = Date.now();
    if (control.ok !== null && now - control.at < CONTROL_TTL) {
      return Promise.resolve(control.ok);
    }

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 5000);

    return fetch(CONTROL_URL, {
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal
    }).then(function () {
      return true;
    }).catch(function () {
      return false;
    }).then(function (ok) {
      clearTimeout(timer);
      control = { at: Date.now(), ok: ok };
      return ok;
    });
  }

  function check(url, options) {
    var opts = options || {};
    var timeout = opts.timeout || 7000;
    var useCache = opts.force !== true;
    var target = normalize(url);

    if (!target) {
      return Promise.resolve({
        url: url,
        status: STATUS.unknown,
        reason: 'unsupported-url',
        checkedAt: Date.now()
      });
    }

    var hit = cache.get(target);
    if (useCache && hit && Date.now() - hit.at < CACHE_MS) {
      return Promise.resolve(hit.result);
    }

    var controller = new AbortController();
    var timedOut = false;
    var timer = setTimeout(function () {
      timedOut = true;
      controller.abort();
    }, timeout);

    return fetch(target, {
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'follow',
      signal: controller.signal
    }).then(function () {
      return {
        url: target,
        status: STATUS.online,
        reason: 'answered',
        checkedAt: Date.now()
      };
    }, function () {
      return networkReachable().then(function (netOk) {
        return {
          url: target,
          status: netOk ? STATUS.blocked : STATUS.network,
          reason: netOk ? (timedOut ? 'timeout' : 'unreachable') : 'network-blocked',
          checkedAt: Date.now()
        };
      });
    }).then(function (result) {
      clearTimeout(timer);
      cache.set(target, { at: Date.now(), result: result });
      return result;
    });
  }

  function checkMany(urls, options) {
    var opts = options || {};
    var concurrency = Math.max(1, opts.concurrency || 4);
    var timeout = opts.timeout || 7000;
    var onResult = opts.onResult;

    var queue = [];
    var seen = new Set();
    (urls || []).forEach(function (url) {
      var target = normalize(url);
      var key = target || String(url);
      if (seen.has(key)) return;
      seen.add(key);
      queue.push(url);
    });

    var index = 0;
    var results = new Map();

    function worker() {
      if (index >= queue.length) return Promise.resolve();
      var current = queue[index++];
      return check(current, { timeout: timeout }).then(function (result) {
        results.set(current, result);
        if (typeof onResult === 'function') {
          try {
            onResult(current, result);
          } catch (err) { /* Darstellung darf den Check nicht stoppen */ }
        }
        return worker();
      });
    }

    var workers = [];
    var count = Math.min(concurrency, queue.length);
    for (var i = 0; i < count; i++) workers.push(worker());

    return Promise.all(workers).then(function () {
      return results;
    });
  }

  function clearCache() {
    cache.clear();
    control = { at: 0, ok: null };
  }

  window.UrlChecker = {
    check: check,
    checkMany: checkMany,
    clearCache: clearCache,
    normalize: normalize,
    STATUS: STATUS
  };
})();
