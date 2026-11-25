/* ============================================================
   Hauptlogik
   Tabs, JSON-Rendering, Suche, Widgets, Favoriten, Settings, Panic-Key
   ============================================================ */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Konstanten                                                          */
  /* ------------------------------------------------------------------ */

  var DATA_SOURCES = {
    'games-online': { file: 'data/games-online.json', title: 'Games Online' },
    'rss-games':    { file: 'data/games-rss.json',    title: 'RSS Games'    },
    'games-local':  { file: 'data/games-local.json',  title: 'Games Local'  },
    'apps':         { file: 'data/apps.json',         title: 'Apps'           },
    'sites':        { file: 'data/sites.json',        title: 'Sites'          },
    'email':        { file: 'data/email.json',        title: 'E-Mail'         },
    'proxy':        { file: 'data/proxy.json',        title: 'Proxy'          }
  };

  /* Lokale Spiele: jeder Ordner in local-games/ wird automatisch erkannt.
     Name = Ordnername, Icon = Bilddatei im Ordner, Startseite = index.html.
     Quelle ist die GitHub-Inhaltsliste des Repos (kein Backend, kein Build). */
  var LOCAL_GAMES = {
    repo: 'User384720/chickenwinner',
    branch: 'main',
    folder: 'local-games',
    entry: 'index.html',
    cacheKey: 'fbtarchive.local-games.v1',
    icons: ['icon.svg', 'icon.png', 'icon.webp', 'icon.jpg', 'icon.jpeg', 'favicon.ico', 'favicon.png']
  };

  var ROUTES = ['home', 'games-online', 'rss-games', 'games-local', 'apps', 'sites', 'email', 'proxy', 'cloak'];

  var ENGINES = [
    { id: 'duckduckgo', name: 'DuckDuckGo',   url: 'https://duckduckgo.com/?q=%s' },
    { id: 'google',     name: 'Google',       url: 'https://www.google.com/search?q=%s' },
    { id: 'brave',      name: 'Brave Search', url: 'https://search.brave.com/search?q=%s' },
    { id: 'startpage',  name: 'Startpage',    url: 'https://www.startpage.com/sp/search?query=%s' },
    { id: 'wikipedia',  name: 'Wikipedia',    url: 'https://de.wikipedia.org/w/index.php?search=%s' }
  ];

  var STORE = {
    settings: 'fbtarchive.settings.v1',
    favorites: 'fbtarchive.favorites.v1',
    status: 'fbtarchive.status.v1'
  };

  var LEGACY_STORE = {
    settings: 'nexus.settings.v1',
    favorites: 'nexus.favorites.v1'
  };

  var DEFAULT_SETTINGS = {
    theme: 'dark',
    engine: 'duckduckgo',
    cloak: false,
    city: 'Berlin',
    checkUrls: true,
    panicKey: '`',
    panicUrl: 'https://classroom.google.com',
    pageTitle: '',
    pageIcon: '',
    pagePath: ''
  };

  var WMO = {
    0: ['☀️', 'Klar'], 1: ['🌤️', 'Überwiegend klar'], 2: ['⛅', 'Teilweise bewölkt'],
    3: ['☁️', 'Bewölkt'], 45: ['🌫️', 'Nebel'], 48: ['🌫️', 'Reifnebel'],
    51: ['🌦️', 'Leichter Niesel'], 53: ['🌦️', 'Niesel'], 55: ['🌧️', 'Starker Niesel'],
    61: ['🌧️', 'Leichter Regen'], 63: ['🌧️', 'Regen'], 65: ['🌧️', 'Starker Regen'],
    66: ['🌧️', 'Gefrierender Regen'], 67: ['🌧️', 'Gefrierender Regen'],
    71: ['🌨️', 'Leichter Schneefall'], 73: ['🌨️', 'Schneefall'], 75: ['❄️', 'Starker Schneefall'],
    77: ['❄️', 'Schneegriesel'], 80: ['🌦️', 'Regenschauer'], 81: ['🌧️', 'Schauer'],
    82: ['⛈️', 'Heftige Schauer'], 85: ['🌨️', 'Schneeschauer'], 86: ['❄️', 'Starke Schneeschauer'],
    95: ['⛈️', 'Gewitter'], 96: ['⛈️', 'Gewitter mit Hagel'], 99: ['⛈️', 'Schweres Gewitter']
  };

  var FALLBACK_FACTS = [
    'Ein Tag auf der Venus dauert länger als ein Venusjahr.',
    'Honig verdirbt praktisch nie – in ägyptischen Gräbern wurde noch essbarer Honig gefunden.',
    'Kraken haben drei Herzen und blaues Blut.',
    'Bananen sind botanisch Beeren, Erdbeeren dagegen nicht.',
    'Der Eiffelturm kann sich im Sommer um bis zu 15 Zentimeter ausdehnen.',
    'Auf dem Mond würden Federn und Hammer gleich schnell fallen – dort gibt es keine Luft.',
    'Ein Blitz ist etwa fünfmal heißer als die Oberfläche der Sonne.',
    'Der größte Teil der DNA im menschlichen Körper stammt nicht von uns, sondern von Mikroben.'
  ];

  var STAR_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z"/></svg>';

  var PLAY_ICON = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6L19 12z"/></svg>';

  /* ------------------------------------------------------------------ */
  /* Helfer                                                              */
  /* ------------------------------------------------------------------ */

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function readStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) { /* Speicher voll oder gesperrt – App läuft weiter */ }
  }

  function fetchJSON(url, timeout) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeout || 8000);
    return fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      clearTimeout(timer);
      return data;
    }).catch(function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function normalizeManual(value) {
    var v = String(value == null ? '' : value).trim().toLowerCase();
    if (v === 'online' || v === 'ok' || v === 'works' || v === 'funktioniert') return 'online';
    if (v === 'blocked' || v === 'offline' || v === 'broken' || v === 'blockiert') return 'blocked';
    return '';
  }

  function normalizeManualMap(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(function (url) {
      var value = normalizeManual(raw[url]);
      if (value) out[url] = value;
    });
    return out;
  }

  function hostOf(url) {
    try {
      return new URL(url, window.location.href).hostname.replace(/^www\./, '');
    } catch (err) {
      return String(url || '');
    }
  }

  function initialOf(name) {
    return String(name || '?').trim().charAt(0).toUpperCase() || '?';
  }

  function primaryUrl(item) {
    return Array.isArray(item.urls) && item.urls[0] && item.urls[0].url ? item.urls[0].url : '';
  }

  function toast(message, type) {
    var box = $('#toasts');
    if (!box) return;
    while (box.children.length > 3) box.removeChild(box.firstElementChild);
    var node = document.createElement('div');
    node.className = 'toast toast-' + (type || 'info');
    node.textContent = message;
    box.appendChild(node);
    setTimeout(function () {
      node.classList.add('leaving');
      setTimeout(function () { node.remove(); }, 320);
    }, 3400);
  }

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  /* Alte Nexus-Schlüssel einmalig übernehmen, damit Einstellungen und
     Favoriten beim Umbenennen nicht verloren gehen. */
  function migrateKey(nextKey, oldKey) {
    try {
      var legacy = localStorage.getItem(oldKey);
      if (legacy == null) return;
      if (localStorage.getItem(nextKey) == null) localStorage.setItem(nextKey, legacy);
      localStorage.removeItem(oldKey);
    } catch (err) { /* Speicher gesperrt – App läuft ohne Migration weiter */ }
  }

  migrateKey(STORE.settings, LEGACY_STORE.settings);
  migrateKey(STORE.favorites, LEGACY_STORE.favorites);

  var storedSettings = readStore(STORE.settings, {});
  var storedFavorites = readStore(STORE.favorites, []);
  var storedStatus = readStore(STORE.status, {});

  var state = {
    route: 'home',
    settings: Object.assign({}, DEFAULT_SETTINGS, storedSettings && typeof storedSettings === 'object' ? storedSettings : {}),
    favorites: Array.isArray(storedFavorites) ? storedFavorites.filter(function (f) { return f && f.url; }) : [],
    manual: normalizeManualMap(storedStatus),
    data: {},
    filters: {
      'games-online': { q: '', group: '' },
      'rss-games': { q: '', group: '' },
      'games-local': { q: '', group: '' },
      'apps': { q: '', group: '' },
      'sites': { q: '', group: '' },
      'email': { q: '', group: '' },
      'proxy': { q: '', group: '' }
    },
    weather: { coords: null },
    rss: { nextPage: 0, loading: false },
    player: { url: '', type: '', open: false, timer: null }
  };

  /* ------------------------------------------------------------------ */
  /* Theme                                                               */
  /* ------------------------------------------------------------------ */

  var mediaQuery = window.matchMedia('(prefers-color-scheme: light)');

  function resolvedTheme(pref) {
    if (pref === 'system') return mediaQuery.matches ? 'light' : 'dark';
    return pref === 'light' ? 'light' : 'dark';
  }

  function applyTheme() {
    var theme = resolvedTheme(state.settings.theme);
    document.documentElement.dataset.theme = theme;
    var meta = $('#theme-color');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#eef1fa' : '#06070d');
    syncSettingsUI();
  }

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', function () {
      if (state.settings.theme === 'system') applyTheme();
    });
  }

  function saveSettings(patch) {
    Object.assign(state.settings, patch);
    writeStore(STORE.settings, state.settings);
    syncSettingsUI();
  }

  /* ------------------------------------------------------------------ */
  /* Routing                                                             */
  /* ------------------------------------------------------------------ */

  function parseHash() {
    var raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
    return ROUTES.indexOf(raw) !== -1 ? raw : 'home';
  }

  function renderRoute(route) {
    state.route = route;
    $$('.view').forEach(function (view) {
      view.hidden = view.dataset.view !== route;
    });
    $$('.tab').forEach(function (tab) {
      var active = tab.dataset.route === route;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });

    if (route === 'home') {
      refreshFavoritesView();
      ensureCatalog();
      renderFinder();
    } else if (route === 'cloak') {
      syncCloakUI();
    } else {
      loadData(route);
      var ready = state.data[route];
      if (ready && ready.status === 'ready') {
        var readyGrid = $('[data-grid="' + route + '"]');
        if (readyGrid) runChecker(readyGrid);
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function bindRouter() {
    $$('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = '#/' + tab.dataset.route;
        if (window.location.hash === target) renderRoute(tab.dataset.route);
        else window.location.hash = target;
      });
    });
    window.addEventListener('hashchange', function () {
      renderRoute(parseHash());
    });
  }

  /* ------------------------------------------------------------------ */
  /* Daten laden & rendern                                               */
  /* ------------------------------------------------------------------ */

  function fetchCatalogFile(file) {
    return fetch(file, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  /* Liegt die Seite auf GitHub Pages, wird das Repo aus der Adresse gelesen. */
  function localGamesRepo() {
    var host = window.location.hostname || '';
    var parts = (window.location.pathname || '/').split('/').filter(Boolean);
    if (/\.github\.io$/i.test(host) && parts.length) {
      return host.replace(/\.github\.io$/i, '') + '/' + parts[0];
    }
    return LOCAL_GAMES.repo;
  }

  function localGameName(folder) {
    var words = String(folder).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return words.replace(/(^|\s)(\S)/g, function (match, space, letter) {
      return space + letter.toUpperCase();
    }) || folder;
  }

  function probeLocalFile(url) {
    return fetch(url, { method: 'HEAD', cache: 'no-cache' }).then(function (res) {
      return res.ok ? url : '';
    }).catch(function () { return ''; });
  }

  /* Erstes vorhandenes Icon im Spielordner gewinnt. */
  function probeLocalIcon(base) {
    var chain = Promise.resolve('');
    LOCAL_GAMES.icons.forEach(function (file) {
      chain = chain.then(function (found) { return found || probeLocalFile(base + file); });
    });
    return chain;
  }

  function buildLocalGame(folder) {
    var base = LOCAL_GAMES.folder + '/' + encodeURIComponent(folder) + '/';
    return probeLocalIcon(base).then(function (icon) {
      return {
        name: localGameName(folder),
        folder: folder,
        icon: icon,
        urls: [{ label: 'lokal spielen', url: base + LOCAL_GAMES.entry }]
      };
    });
  }

  function rememberLocalGames(catalog) {
    try { window.localStorage.setItem(LOCAL_GAMES.cacheKey, JSON.stringify(catalog)); } catch (err) { /* Speicher voll o. ä. */ }
  }

  function cachedLocalGames() {
    try {
      var raw = window.localStorage.getItem(LOCAL_GAMES.cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function discoverLocalGames() {
    var url = 'https://api.github.com/repos/' + localGamesRepo() + '/contents/' +
      LOCAL_GAMES.folder + '?ref=' + LOCAL_GAMES.branch;

    return fetch(url, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (list) {
        if (!Array.isArray(list)) throw new Error('unerwartete Antwort');
        var folders = list.filter(function (item) {
          return item && item.type === 'dir' && item.name && item.name.charAt(0) !== '.';
        }).map(function (item) { return item.name; }).sort(function (a, b) {
          return a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' });
        });
        if (!folders.length) throw new Error('keine Ordner gefunden');
        return Promise.all(folders.map(buildLocalGame));
      })
      .then(function (items) {
        var catalog = {
          groups: [{ id: 'lokal', name: 'Lokale Spiele', icon: '📁', items: items }]
        };
        rememberLocalGames(catalog);
        return catalog;
      });
  }

  /* Ohne Netz/API: letzte bekannte Liste, sonst die statische JSON. */
  function loadLocalGamesCatalog() {
    return discoverLocalGames().catch(function () {
      return cachedLocalGames() || fetchCatalogFile(DATA_SOURCES['games-local'].file);
    });
  }

  /* ------------------------------------------------------------------ */
  /* RSS Games (GamePix-JSON-Feed)                                       */
  /* ------------------------------------------------------------------ */

  /* Der Feed liefert 12 Spiele pro Seite, nach Qualität sortiert.
     Ohne Backend holt die Seite die ersten Seiten live und merkt sie sich im
     Browser; die JSON-Datei dient als Rückfall, wenn der Feed nicht antwortet. */
  var RSS_GAMES = {
    feed: 'https://feeds.gamepix.com/v2/json/?order=quality&pagination=12&sid=E05E6&page=',
    pagesPerLoad: 5,
    cacheKey: 'fbtarchive.rss-games.v2'
  };

  /* Der Feed hat dutzende Kleinst-Kategorien – hier zu wenigen Themen gebündelt. */
  var RSS_CLUSTERS = [
    { id: 'puzzle', name: 'Puzzle & Denken', icon: '🧩', match: ['puzzle', 'memory', 'math', 'trivia', '2048', 'word', 'board', 'card', 'quiz', 'mahjong'] },
    { id: 'action', name: 'Action & Shooter', icon: '🎯', match: ['action', 'shoot', 'war', 'tank', 'fight', 'zombie', 'battle', 'stickman', 'survival'] },
    { id: 'racing', name: 'Rennen & Fahren', icon: '🏎️', match: ['rac', 'driv', 'car', 'airplane', 'bike', 'truck', 'parking', 'moto'] },
    { id: 'sports', name: 'Sport & Ball', icon: '⚽', match: ['sport', 'soccer', 'football', 'basket', 'golf', 'tennis', 'ball', 'pool', 'billiard'] },
    { id: 'arcade', name: 'Arcade & Skill', icon: '🕹️', match: ['arcade', 'hyper', 'skill', 'clicker', 'jump', 'runner', 'endless', 'reaction'] },
    { id: 'build', name: 'Strategie & Aufbau', icon: '🏗️', match: ['strateg', 'simulat', 'build', 'farm', 'tower', 'idle', 'defen', 'management', 'city'] },
    { id: 'adventure', name: 'Abenteuer & Story', icon: '🌍', match: ['adventur', 'hidden object', 'drawing', 'education', 'escape', 'point and click', 'quest'] },
    { id: 'dressup', name: 'Dress-up & Kreativ', icon: '👗', match: ['dress', 'girl', 'makeup', 'fashion', 'cook', 'decor', 'design', 'music', 'art'] },
    { id: 'casual', name: 'Casual & Sonstiges', icon: '🎮', match: [] }
  ];

  function rssCluster(category) {
    var key = String(category || '').toLowerCase();
    for (var i = 0; i < RSS_CLUSTERS.length; i++) {
      var cluster = RSS_CLUSTERS[i];
      var hit = cluster.match.some(function (term) { return key.indexOf(term) !== -1; });
      if (hit) return { cluster: cluster, order: i };
    }
    return { cluster: RSS_CLUSTERS[RSS_CLUSTERS.length - 1], order: RSS_CLUSTERS.length - 1 };
  }

  function rssEntry(item) {
    return {
      name: String(item.title || item.namespace || 'Spiel'),
      icon: item.image || item.banner_image || '',
      urls: [{ label: 'Spielen', url: item.url }]
    };
  }

  /* Feed-Spiele in die Themen-Gruppen einsortieren, Reihenfolge bleibt fest. */
  function rssGroups(items) {
    var buckets = {};

    items.forEach(function (item) {
      if (!item || !item.url) return;
      var hit = rssCluster(item.category);
      var id = hit.cluster.id;
      if (!buckets[id]) {
        buckets[id] = {
          id: id,
          name: hit.cluster.name,
          icon: hit.cluster.icon,
          order: hit.order,
          items: []
        };
      }
      buckets[id].items.push(rssEntry(item));
    });

    return Object.keys(buckets).map(function (id) { return buckets[id]; }).sort(function (a, b) {
      return a.order - b.order;
    });
  }

  function fetchRssPage(page) {
    return fetchJSON(RSS_GAMES.feed + page, 9000).then(function (data) {
      return data && Array.isArray(data.items) ? data.items : [];
    });
  }

  function fetchRssPages(from, amount) {
    var jobs = [];
    for (var i = 0; i < amount; i++) {
      jobs.push(fetchRssPage(from + i).catch(function () { return []; }));
    }
    return Promise.all(jobs).then(function (lists) {
      var items = [];
      lists.forEach(function (list) {
        list.forEach(function (item) { items.push(item); });
      });
      return items;
    });
  }

  function rememberRss(groups, nextPage) {
    try {
      window.localStorage.setItem(RSS_GAMES.cacheKey, JSON.stringify({ groups: groups, nextPage: nextPage }));
    } catch (err) { /* Speicher voll – Seite funktioniert weiter */ }
  }

  function cachedRss() {
    try {
      var raw = window.localStorage.getItem(RSS_GAMES.cacheKey);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && Array.isArray(parsed.groups) && parsed.groups.length ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function loadRssGames() {
    return fetchRssPages(1, RSS_GAMES.pagesPerLoad).then(function (items) {
      if (!items.length) throw new Error('Feed leer');
      var groups = rssGroups(items);
      state.rss.nextPage = 1 + RSS_GAMES.pagesPerLoad;
      rememberRss(groups, state.rss.nextPage);
      return { groups: groups };
    }).catch(function () {
      var cached = cachedRss();
      if (cached) {
        state.rss.nextPage = cached.nextPage || 0;
        return { groups: cached.groups };
      }
      state.rss.nextPage = 0;
      return fetchCatalogFile(DATA_SOURCES['rss-games'].file);
    });
  }

  function loadMoreRss() {
    var entry = state.data['rss-games'];
    var button = $('#rss-more');
    if (!entry || entry.status !== 'ready' || state.rss.loading) return;

    var from = state.rss.nextPage || 0;
    if (!from) {
      toast('Der Feed ist gerade nicht erreichbar – Nachladen geht nicht.', 'error');
      return;
    }

    state.rss.loading = true;
    if (button) { button.disabled = true; button.textContent = 'Wird geladen …'; }

    fetchRssPages(from, RSS_GAMES.pagesPerLoad).then(function (items) {
      if (!items.length) {
        toast('Der Feed hat keine weiteren Spiele.', 'info');
        return;
      }

      var added = 0;
      rssGroups(items).forEach(function (group) {
        var target = entry.groups.find(function (g) { return g.id === group.id; });
        if (!target) {
          entry.groups.push(group);
          added += group.items.length;
          return;
        }
        group.items.forEach(function (item) {
          var url = item.urls[0].url;
          var exists = target.items.some(function (known) { return known.urls[0].url === url; });
          if (exists) return;
          target.items.push(item);
          added++;
        });
      });

      entry.items = entry.groups.reduce(function (acc, group) { return acc.concat(group.items); }, []);
      state.rss.nextPage = from + RSS_GAMES.pagesPerLoad;
      rememberRss(entry.groups, state.rss.nextPage);
      renderGrid('rss-games');
      updateGamesCounter();
      toast(added + ' weitere Spiele geladen', 'success');
    }).catch(function () {
      toast('Weitere Spiele konnten nicht geladen werden.', 'error');
    }).then(function () {
      state.rss.loading = false;
      if (button) { button.disabled = false; button.textContent = 'Weitere Spiele laden'; }
    });
  }

  function loadData(key) {
    var entry = state.data[key];
    if (entry && (entry.status === 'loading' || entry.status === 'ready')) return;

    var grid = $('[data-grid="' + key + '"]');
    state.data[key] = { status: 'loading', items: [] };
    if (grid) grid.innerHTML = skeletonMarkup(6);

    var count = $('[data-count="' + key + '"]');
    if (count) count.textContent = 'wird geladen …';

    var request = key === 'games-local'
      ? loadLocalGamesCatalog()
      : (key === 'rss-games' ? loadRssGames() : fetchCatalogFile(DATA_SOURCES[key].file));

    request
      .then(function (raw) {
        var groups = normalizeCatalog(raw);
        var flat = [];
        groups.forEach(function (group) {
          group.items.forEach(function (item) { flat.push(item); });
        });
        state.data[key] = { status: 'ready', groups: groups, items: flat };
        renderGrid(key);
        updateGamesCounter();
        if (state.route === 'home') renderFinder();
      })
      .catch(function (err) {
        state.data[key] = { status: 'error', items: [], error: err.message };
        updateGamesCounter();
        var gridNow = $('[data-grid="' + key + '"]');
        if (gridNow) gridNow.innerHTML = errorMarkup(key, err.message);
        var countNow = $('[data-count="' + key + '"]');
        if (countNow) countNow.textContent = 'nicht geladen';
        if (state.route === 'home') renderFinder();
      });
  }

  function slugify(value, fallback) {
    var slug = String(value || '').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || fallback;
  }

  /* Kategorien-JSON:
     { "groups": [ { "id": "shooter", "name": "Shooter", "icon": "🎯", "items": [ … ] } ] }
     Neue Unterkategorie = ein weiteres Objekt in "groups". Ein flaches Array bleibt gültig. */
  function normalizeCatalog(raw) {
    var groups = [];

    function pushGroup(group, index) {
      var candidates = Array.isArray(group) ? group : (group && group.items);
      var items = (Array.isArray(candidates) ? candidates : []).filter(function (item) {
        return item && typeof item.name === 'string' && item.name.trim();
      });
      if (!items.length) return;
      var name = String((group && group.name) || 'Allgemein').trim() || 'Allgemein';
      groups.push({
        id: String((group && group.id) || '') || slugify(name, 'gruppe-' + (index + 1)),
        name: name,
        icon: String((group && group.icon) || ''),
        items: items
      });
    }

    if (Array.isArray(raw)) {
      pushGroup({ id: 'allgemein', name: 'Alle Einträge', items: raw }, 0);
    } else if (raw && Array.isArray(raw.groups)) {
      raw.groups.forEach(pushGroup);
      if (Array.isArray(raw.items)) groups.length && pushGroup({ id: 'weitere', name: 'Weitere', items: raw.items }, groups.length);
    }

    if (!groups.length) throw new Error('JSON enthält keine Einträge');
    return groups;
  }

  function groupHasQuery(group, item, query) {
    if (!query) return true;
    if (matchItem(item, query)) return true;
    return String(group.name || '').toLowerCase().indexOf(query) !== -1;
  }

  function matchItem(item, query) {
    if (String(item.name).toLowerCase().indexOf(query) !== -1) return true;
    return (item.urls || []).some(function (u) {
      return (String(u && u.label || '') + ' ' + String(u && u.url || '')).toLowerCase().indexOf(query) !== -1;
    });
  }

  function iconMarkup(item) {
    var initial = esc(initialOf(item.name));
    if (!item.icon) {
      return '<div class="icon-fallback" aria-hidden="true">' + initial + '</div>';
    }
    return '<img src="' + esc(item.icon) + '" alt="" loading="lazy" decoding="async" data-initial="' + initial + '">' +
      '<div class="icon-fallback" hidden aria-hidden="true">' + initial + '</div>';
  }

  /* Farbe aus der JSON: Hex, Farbname oder rgb()/hsl(). Alles andere wird ignoriert. */
  function safeColor(value) {
    if (typeof value !== 'string') return '';
    var v = value.trim();
    if (!v) return '';
    if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
    if (/^[a-z]{3,20}$/i.test(v)) return v;
    if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s/+-]+\)$/i.test(v)) return v;
    return '';
  }

  function cardMarkup(item, type, index, group) {
    var urls = (Array.isArray(item.urls) ? item.urls : []).filter(function (u) {
      return u && u.url;
    });
    var primary = primaryUrl(item);
    var isFav = primary ? isFavorite(primary) : false;
    var host = type === 'games-local' ? 'lokal' : (primary ? hostOf(primary) : '');
    if (type === 'rss-games') host = ''; /* Feed-Karten zeigen keine Adressen */
    var groupTag = group && group.name
      ? '<div class="card-tags"><span class="card-tag">' +
          (group.icon ? '<span aria-hidden="true">' + esc(group.icon) + '</span>' : '') +
          esc(group.name) +
        '</span></div>'
      : '';

    var visibleLinks = 3;
    var links = urls.map(function (u, i) {
      var label = u.label || hostOf(u.url);
      var dot = statusDotMarkup(u.url, item, u);
      var color = safeColor(u.color) || safeColor(item.color);
      return '<button class="badge badge-play' + (color ? ' has-color' : '') + (i >= visibleLinks ? ' is-extra' : '') + '" type="button" ' +
        'data-play-url="' + esc(u.url) + '" data-play-name="' + esc(item.name) + '" data-play-icon="' + esc(item.icon || '') + '" ' +
        'data-play-type="' + esc(type) + '" ' +
        (color ? 'style="--badge-color:' + esc(color) + '" ' : '') +
        'title="Im Player öffnen: ' + esc(u.url) + '">' +
        dot + PLAY_ICON + esc(label) +
      '</button>';
    }).join('');

    if (urls.length > visibleLinks) {
      links += '<button class="badge badge-more" type="button" data-more-links aria-expanded="false">' +
        '+ ' + (urls.length - visibleLinks) + ' weitere</button>';
    }

    return '<article class="card" style="--i:' + index + '">' +
      '<div class="card-head">' +
        '<div class="card-icon">' + iconMarkup(item) + '</div>' +
        '<div class="card-title">' +
          '<h3 title="' + esc(item.name) + '">' + esc(item.name) + '</h3>' +
          '<div class="card-sub">' +
            (host ? '<span>' + esc(host) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<button class="card-fav' + (isFav ? ' is-fav' : '') + '" type="button" ' +
          'data-fav-url="' + esc(primary) + '" data-fav-name="' + esc(item.name) + '" ' +
          'data-fav-icon="' + esc(item.icon || '') + '" data-fav-type="' + esc(type) + '" ' +
          'aria-pressed="' + (isFav ? 'true' : 'false') + '" ' +
          'title="' + (isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen') + '" ' +
          'aria-label="' + (isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen') + '">' +
          STAR_SVG +
        '</button>' +
      '</div>' +
      groupTag +
      '<div class="badges">' + (links || '<span class="muted small">Keine Links hinterlegt</span>') + '</div>' +
    '</article>';
  }

  /* Unterkategorien als Chips: "Alle" + jede Gruppe mit Trefferzahl. */
  function renderChips(key) {
    var box = $('[data-chips="' + key + '"]');
    if (!box) return;

    var entry = state.data[key];
    var filter = state.filters[key] || (state.filters[key] = { q: '', group: '' });

    if (!entry || entry.status !== 'ready') {
      box.innerHTML = '';
      box.hidden = true;
      return;
    }

    var query = String(filter.q || '').trim().toLowerCase();
    var active = filter.group || '';
    if (active && !entry.groups.some(function (group) { return group.id === active; })) {
      active = '';
      filter.group = '';
    }

    var counts = {};
    var total = 0;
    entry.groups.forEach(function (group) {
      var count = 0;
      group.items.forEach(function (item) {
        if (groupHasQuery(group, item, query)) count++;
      });
      counts[group.id] = count;
      total += count;
    });

    var chips = entry.groups.map(function (group) {
      var isActive = active === group.id;
      return '<button class="chip' + (isActive ? ' is-active' : '') + '" type="button" ' +
        'data-chip-group="' + esc(group.id) + '" aria-pressed="' + (isActive ? 'true' : 'false') + '">' +
        (group.icon ? '<span class="chip-icon" aria-hidden="true">' + esc(group.icon) + '</span>' : '') +
        '<span class="chip-name">' + esc(group.name) + '</span>' +
        '<span class="chip-count">' + (counts[group.id] || 0) + '</span>' +
      '</button>';
    }).join('');

    box.hidden = false;
    box.innerHTML = '<button class="chip chip-all' + (active ? '' : ' is-active') + '" type="button" ' +
      'data-chip-group="" aria-pressed="' + (active ? 'false' : 'true') + '">' +
      '<span class="chip-name">Alle</span><span class="chip-count">' + total + '</span></button>' + chips;
  }

  function renderGrid(key) {
    var grid = $('[data-grid="' + key + '"]');
    if (!grid) return;
    var entry = state.data[key];
    if (!entry || entry.status === 'loading') return;

    if (entry.status === 'error') {
      grid.innerHTML = errorMarkup(key, entry.error);
      renderChips(key);
      return;
    }

    var filter = state.filters[key] || (state.filters[key] = { q: '', group: '' });
    var query = String(filter.q || '').trim().toLowerCase();
    var activeGroup = filter.group || '';
    var rows = [];

    entry.groups.forEach(function (group) {
      if (activeGroup && group.id !== activeGroup) return;
      group.items.forEach(function (item) {
        if (!groupHasQuery(group, item, query)) return;
        rows.push({ item: item, group: group });
      });
    });

    renderChips(key);
    updateCount(key, rows.length, entry.items.length);

    if (key === 'rss-games') {
      var rssNote = $('#rss-more-note');
      if (rssNote) rssNote.textContent = entry.items.length + ' Spiele aus dem Feed geladen';
    }

    if (!rows.length) {
      grid.innerHTML = emptyMarkup(query);
      return;
    }

    grid.innerHTML = rows.map(function (row, index) {
      return cardMarkup(row.item, key, index, row.group);
    }).join('');

    hydrateIcons(grid);
    runChecker(grid);
  }

  function updateCount(key, shown, total) {
    var node = $('[data-count="' + key + '"]');
    if (!node) return;
    node.textContent = total ? shown + ' von ' + total + ' Einträgen' : 'keine Einträge';
  }

  /* Zähler auf Home: Games Online + RSS-Feed + lokale Spiele. */
  function updateGamesCounter() {
    var sources = {
      'games-online': 'games-count-online',
      'rss-games': 'games-count-rss',
      'games-local': 'games-count-local'
    };
    var total = 0;

    Object.keys(sources).forEach(function (key) {
      var entry = state.data[key];
      var count = entry && entry.status === 'ready' ? entry.items.length : 0;
      total += count;
      var node = $('#' + sources[key]);
      if (node) node.textContent = count.toLocaleString('de-DE');
    });

    var totalNode = $('#games-count-total');
    if (totalNode) totalNode.textContent = total ? total.toLocaleString('de-DE') : '–';
  }

  function hydrateIcons(root) {
    $$('img[data-initial]', root).forEach(function (img) {
      function fail() {
        var fallback = img.parentElement.querySelector('.icon-fallback');
        img.remove();
        if (fallback) fallback.hidden = false;
      }
      img.addEventListener('error', fail);
      if (img.complete && img.naturalWidth === 0) fail();
    });
  }

  function skeletonMarkup(amount) {
    var out = '';
    for (var i = 0; i < amount; i++) {
      out += '<div class="card skeleton-card" aria-hidden="true">' +
        '<div class="card-head"><div class="sk-icon"></div><div class="card-title">' +
        '<div class="sk-line"></div><div class="sk-line short" style="margin-top:8px"></div></div></div>' +
        '<div class="sk-badges"><span></span><span></span></div></div>';
    }
    return out;
  }

  function errorMarkup(key, message) {
    return '<div class="state">' +
      '<div class="state-icon">⚠️</div>' +
      '<h3>Daten konnten nicht geladen werden</h3>' +
      '<p><code>' + esc(DATA_SOURCES[key].file) + '</code> · ' + esc(message || 'Unbekannter Fehler') + '</p>' +
      '<p class="muted">Öffne die Seite am besten über einen Server (z. B. <code>python3 -m http.server</code>) statt per Doppelklick über <code>file://</code>.</p>' +
      '<button class="btn btn-primary" type="button" data-retry="' + esc(key) + '">Erneut versuchen</button>' +
    '</div>';
  }

  function emptyMarkup(query) {
    return '<div class="state">' +
      '<div class="state-icon">🔍</div>' +
      '<h3>Keine Treffer</h3>' +
      '<p>' + (query ? 'Nichts gefunden für „' + esc(query) + '“.' : 'Diese Datei enthält noch keine Einträge.') + '</p>' +
    '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* Seiten-Suche (Home): durchsucht alle Kategorien                     */
  /* ------------------------------------------------------------------ */

  var CATALOG_KEYS = ['games-online', 'rss-games', 'games-local', 'apps', 'sites', 'email', 'proxy'];

  function ensureCatalog() {
    CATALOG_KEYS.forEach(function (key) {
      if (!state.data[key]) loadData(key);
    });
  }

  function catalogEntries() {
    var out = [];
    CATALOG_KEYS.forEach(function (key) {
      var entry = state.data[key];
      if (!entry || entry.status !== 'ready') return;
      entry.groups.forEach(function (group) {
        group.items.forEach(function (item) {
          out.push({ key: key, item: item, group: group });
        });
      });
    });
    return out;
  }

  function catalogLoading() {
    return CATALOG_KEYS.some(function (key) {
      var entry = state.data[key];
      return !entry || entry.status === 'loading';
    });
  }

  function finderMatches(query) {
    return catalogEntries().filter(function (row) {
      var haystack = [row.item.name, DATA_SOURCES[row.key].title, row.key, row.group && row.group.name];
      (row.item.urls || []).forEach(function (u) {
        haystack.push(u && u.label, u && u.url);
      });
      return haystack.join(' ').toLowerCase().indexOf(query) !== -1;
    });
  }

  function finderItemMarkup(row, index) {
    var item = row.item;
    var primary = primaryUrl(item);
    var host = primary ? hostOf(primary) : 'lokal';
    var tag = DATA_SOURCES[row.key].title + (row.group && row.group.name ? ' · ' + row.group.name : '');
    var action = '';

    if (primary) {
      var isGame = row.key === 'games-online' || row.key === 'games-local';
      action = '<button class="btn btn-primary finder-btn" type="button" ' +
        'data-play-url="' + esc(primary) + '" data-play-name="' + esc(item.name) + '" data-play-icon="' + esc(item.icon || '') + '" ' +
        'data-play-type="' + esc(row.key) + '">' +
        PLAY_ICON + (isGame ? 'Spielen' : 'Öffnen') + '</button>';
    }

    return '<div class="finder-item" style="animation-delay:' + (index * 24) + 'ms">' +
      '<span class="finder-icon">' + iconMarkup(item) + '</span>' +
      '<span class="finder-text">' +
        '<strong title="' + esc(item.name) + '">' + esc(item.name) + '</strong>' +
        '<small><span class="finder-tag">' + esc(tag) + '</span>' + esc(host) + '</small>' +
      '</span>' + action +
    '</div>';
  }

  function renderFinder() {
    var input = $('#finder-input');
    var box = $('#finder-results');
    var meta = $('#finder-meta');
    if (!input || !box || !meta) return;

    var query = input.value.trim().toLowerCase();
    if (!query) {
      box.hidden = true;
      box.innerHTML = '';
      meta.textContent = 'Spiele & Apps durchsuchen';
      return;
    }

    var rows = finderMatches(query);
    var loading = catalogLoading();
    box.hidden = false;
    meta.textContent = rows.length + ' Treffer' + (loading ? ' · lädt …' : '');

    if (!rows.length) {
      box.innerHTML = '<p class="finder-empty">' +
        (loading ? 'Einträge werden geladen …' : 'Nichts gefunden für „' + esc(query) + '“.') +
      '</p>';
      return;
    }

    box.innerHTML = rows.slice(0, 18).map(finderItemMarkup).join('');
    hydrateIcons(box);
  }

  function bindFinder() {
    var input = $('#finder-input');
    if (!input) return;
    input.addEventListener('input', renderFinder);
    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      input.value = '';
      renderFinder();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Link-Checker                                                        */
  /* ------------------------------------------------------------------ */

  var MANUAL_LABEL = { online: 'funktioniert', blocked: 'blockiert' };

  function manualFor(url, item, link) {
    if (url && state.manual[url]) return state.manual[url];
    return normalizeManual(link && link.status) || normalizeManual(item && item.status);
  }

  /* Ein Punkt pro Link: manuell gesetzt (JSON oder Klick) oder automatisch geprüft. */
  function statusDotMarkup(url, item, link) {
    if (!url) return '';
    var manual = manualFor(url, item, link);
    if (manual) {
      return '<span class="status-dot ' + manual + ' is-manual" data-url="' + esc(url) + '" data-manual="1" ' +
        'title="Manuell: ' + MANUAL_LABEL[manual] + ' – klicken zum Ändern" aria-hidden="true"></span>';
    }
    if (!state.settings.checkUrls || !window.UrlChecker) {
      return '<span class="status-dot unknown" data-url="' + esc(url) + '" ' +
        'title="Prüfung ist aus – klicken zum manuellen Setzen" aria-hidden="true"></span>';
    }
    return '<span class="status-dot checking" data-url="' + esc(url) + '" ' +
      'title="Wird geprüft – klicken zum manuellen Setzen" aria-hidden="true"></span>';
  }

  function cycleManualStatus(url) {
    if (!url) return;
    var current = state.manual[url] || '';
    var next = current === '' ? 'online' : (current === 'online' ? 'blocked' : '');
    if (next) state.manual[url] = next;
    else delete state.manual[url];
    writeStore(STORE.status, state.manual);
    updateDotsFor(url);
    if (next) toast('Status manuell auf „' + MANUAL_LABEL[next] + '" gesetzt', 'success');
    else toast('Status wieder automatisch', 'info');
  }

  function updateDotsFor(url) {
    if (!url) return;
    var nodes = $$('.status-dot[data-url]').filter(function (node) { return node.dataset.url === url; });
    var manual = state.manual[url] || '';

    nodes.forEach(function (node) {
      node.classList.remove('checking', 'online', 'blocked', 'network', 'unknown', 'is-manual');
      if (manual) {
        node.classList.add(manual, 'is-manual');
        node.dataset.manual = '1';
        node.title = 'Manuell: ' + MANUAL_LABEL[manual] + ' – klicken zum Ändern';
      } else {
        delete node.dataset.manual;
        node.classList.add('checking');
        node.title = 'Wird geprüft – klicken zum manuellen Setzen';
      }
    });

    if (manual || !nodes.length) return;

    if (!state.settings.checkUrls || !window.UrlChecker) {
      nodes.forEach(function (node) {
        node.classList.remove('checking');
        node.classList.add('unknown');
        node.title = 'Prüfung ist aus – klicken zum manuellen Setzen';
      });
      return;
    }

    window.UrlChecker.check(url, { force: true }).then(function (result) {
      nodes.forEach(function (node) {
        if (node.dataset.manual) return;
        node.classList.remove('checking');
        applyDot(node, result);
      });
    });
  }

  function applyDot(node, result) {
    node.classList.remove('checking', 'online', 'blocked', 'network', 'unknown');
    node.classList.add(result.status);
    if (result.status === 'online') {
      node.title = 'Funktioniert – Server antwortet';
    } else if (result.status === 'blocked') {
      node.title = result.reason === 'timeout'
        ? 'Zeitüberschreitung – lädt nicht'
        : 'Blockiert oder nicht erreichbar';
    } else if (result.status === 'network') {
      node.title = 'Netzwerk blockiert – auch die Kontroll-Anfrage scheitert';
    } else {
      node.title = 'Status unbekannt';
    }
  }

  function runChecker(root) {
    if (!state.settings.checkUrls || !window.UrlChecker) return;
    var view = root.closest ? root.closest('.view') : null;
    if (view && view.hidden) return; /* sichtbare Karten erst prüfen, wenn der Tab offen ist */
    var nodes = $$('.status-dot[data-url]', root).filter(function (node) {
      return !node.dataset.manual; /* manueller Status gewinnt */
    });
    if (!nodes.length) return;

    var urls = nodes.map(function (node) { return node.dataset.url; }).filter(Boolean);
    if (!urls.length) return;

    window.UrlChecker.checkMany(urls, {
      concurrency: 4,
      onResult: function (url, result) {
        nodes.forEach(function (node) {
          if (node.dataset.url === url) applyDot(node, result);
        });
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Favoriten                                                           */
  /* ------------------------------------------------------------------ */

  function isFavorite(url) {
    return state.favorites.some(function (fav) { return fav.url === url; });
  }

  function persistFavorites() {
    writeStore(STORE.favorites, state.favorites);
  }

  function toggleFavorite(data) {
    if (!data.url) return false;
    var index = state.favorites.findIndex(function (fav) { return fav.url === data.url; });
    if (index >= 0) {
      state.favorites.splice(index, 1);
      persistFavorites();
      return false;
    }
    state.favorites.unshift({
      name: data.name,
      url: data.url,
      icon: data.icon || '',
      type: data.type || '',
      added: Date.now()
    });
    state.favorites = state.favorites.slice(0, 24);
    persistFavorites();
    return true;
  }

  function refreshFavoritesView() {
    var list = $('#fav-list');
    if (!list) return;
    var count = $('#fav-count');
    if (count) count.textContent = state.favorites.length + ' gespeichert';

    if (!state.favorites.length) {
      list.innerHTML = '<li class="fav-empty">Noch keine Favoriten. Klicke auf einer Karte auf den Stern, um Spiele und Apps hier zu parken.</li>';
      return;
    }

    list.innerHTML = state.favorites.slice(0, 10).map(function (fav) {
      var icon = fav.icon
        ? '<img src="' + esc(fav.icon) + '" alt="" loading="lazy" data-initial="' + esc(initialOf(fav.name)) + '">'
        : esc(initialOf(fav.name));
      var inner =
        '<span class="fav-icon">' + icon + '</span>' +
        '<span class="fav-name">' + esc(fav.name) + '</span>';
      var link = '<button class="fav-link" type="button" data-play-url="' + esc(fav.url) + '" data-play-name="' + esc(fav.name) + '" ' +
        'data-play-icon="' + esc(fav.icon || '') + '" data-play-type="' + esc(fav.type || 'home') + '">' + inner + '</button>';
      return '<li class="fav-item">' + link +
        '<button class="fav-remove" type="button" data-remove-url="' + esc(fav.url) + '" title="Aus Favoriten entfernen" aria-label="' + esc(fav.name) + ' aus Favoriten entfernen">×</button>' +
      '</li>';
    }).join('');

    $$('.fav-icon img', list).forEach(function (img) {
      img.addEventListener('error', function () {
        var holder = img.parentElement;
        if (holder) holder.textContent = img.dataset.initial || '?';
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Suche                                                               */
  /* ------------------------------------------------------------------ */

  function buildEngineOptions() {
    var options = ENGINES.map(function (engine) {
      return '<option value="' + engine.id + '">' + esc(engine.name) + '</option>';
    }).join('');

    var select = $('#engine-select');
    if (select) {
      select.innerHTML = options;
      select.value = state.settings.engine;
    }
    var modalSelect = $('#set-engine');
    if (modalSelect) {
      modalSelect.innerHTML = options;
      modalSelect.value = state.settings.engine;
    }
  }

  function isUrlLike(value) {
    if (/^(https?:\/\/|about:)/i.test(value)) return true;
    return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value) && value.indexOf(' ') === -1;
  }

  function openTarget(url) {
    if (state.settings.cloak) {
      var win = window.open('about:blank', '_blank');
      if (win) {
        win.document.write(
          '<!doctype html><html><head><title>Dokument</title>' +
          '<style>html,body{margin:0;height:100%;overflow:hidden;background:#0b0d17}iframe{border:0;width:100%;height:100%;display:block}</style>' +
          '</head><body><iframe src="' + esc(url) + '" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" ' +
          'allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write; encrypted-media; picture-in-picture; screen-wake-lock; storage-access"></iframe></body></html>'
        );
        win.document.close();
        toast('Cloak-Tab geöffnet. Manche Seiten verbieten das Einbetten.', 'info');
        return;
      }
      toast('Popup blockiert – öffne die Suche ohne Cloak.', 'error');
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function bindSearch() {
    var form = $('#search-form');
    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = $('#search-input');
      var raw = input ? input.value.trim() : '';
      if (!raw) {
        if (input) input.focus();
        return;
      }
      var target;
      if (isUrlLike(raw)) {
        target = /^about:/i.test(raw) ? raw : (raw.indexOf('://') === -1 ? 'https://' + raw : raw);
      } else {
        var engine = ENGINES.find(function (item) { return item.id === state.settings.engine; }) || ENGINES[0];
        target = engine.url.replace('%s', encodeURIComponent(raw));
      }
      openTarget(target);
    });

    var engineSelect = $('#engine-select');
    if (engineSelect) {
      engineSelect.addEventListener('change', function () {
        saveSettings({ engine: engineSelect.value });
      });
    }

    var cloakToggle = $('#cloak-toggle');
    if (cloakToggle) {
      cloakToggle.addEventListener('click', function () {
        saveSettings({ cloak: !state.settings.cloak });
        toast(state.settings.cloak ? 'Cloak-Modus aktiv' : 'Cloak-Modus aus', 'info');
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Uhr                                                                 */
  /* ------------------------------------------------------------------ */

  function tickClock() {
    var now = new Date();
    var time = $('#clock-time');
    var sec = $('#clock-sec');
    var date = $('#clock-date');
    var tz = $('#clock-tz');

    var hhmm = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(now);
    if (time) time.textContent = hhmm;
    if (sec) sec.textContent = String(now.getSeconds()).padStart(2, '0');
    if (date) {
      date.textContent = new Intl.DateTimeFormat('de-DE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).format(now);
    }
    if (tz) {
      var zone = '';
      try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (err) { zone = ''; }
      tz.textContent = zone ? 'lokal · ' + zone : 'lokale Zeit';
    }
  }

  /* ------------------------------------------------------------------ */
  /* Wetter                                                              */
  /* ------------------------------------------------------------------ */

  function setWeatherError(message) {
    var emoji = $('#weather-emoji');
    var temp = $('#weather-temp');
    var city = $('#weather-city');
    var meta = $('#weather-meta');
    if (emoji) emoji.textContent = '🛰️';
    if (temp) temp.textContent = '—';
    if (city) city.textContent = 'Wetter nicht verfügbar';
    if (meta) meta.textContent = message;
  }

  function loadWeather(useGeo) {
    var city = $('#weather-city');
    var temp = $('#weather-temp');
    if (city) city.textContent = 'Wird geladen …';
    if (temp) temp.textContent = '--°';

    var location;
    if (useGeo) {
      location = new Promise(function (resolve, reject) {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation wird nicht unterstützt'));
          return;
        }
        navigator.geolocation.getCurrentPosition(function (position) {
          state.weather.coords = { lat: position.coords.latitude, lon: position.coords.longitude };
          resolve({ lat: position.coords.latitude, lon: position.coords.longitude, label: 'Mein Standort' });
        }, function () {
          reject(new Error('Standort nicht freigegeben'));
        }, { timeout: 9000, maximumAge: 600000 });
      });
    } else if (state.weather.coords) {
      location = Promise.resolve({
        lat: state.weather.coords.lat,
        lon: state.weather.coords.lon,
        label: 'Mein Standort'
      });
    } else {
      var fallbackCity = (state.settings.city || 'Berlin').trim() || 'Berlin';
      location = fetchJSON('https://geocoding-api.open-meteo.com/v1/search?name=' +
        encodeURIComponent(fallbackCity) + '&count=1&language=de&format=json')
        .then(function (data) {
          var hit = data && data.results && data.results[0];
          if (!hit) throw new Error('Stadt nicht gefunden');
          return {
            lat: hit.latitude,
            lon: hit.longitude,
            label: hit.name + (hit.country_code ? ', ' + hit.country_code : '')
          };
        });
    }

    location.then(function (place) {
      return fetchJSON('https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(place.lat) +
        '&longitude=' + encodeURIComponent(place.lon) +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto')
        .then(function (data) {
          var current = data && data.current;
          if (!current) throw new Error('Keine Wetterdaten');
          var info = WMO[current.weather_code] || ['🌡️', 'Unbekannt'];
          $('#weather-emoji').textContent = info[0];
          $('#weather-temp').textContent = Math.round(current.temperature_2m) + '°';
          $('#weather-city').textContent = place.label;
          $('#weather-meta').innerHTML =
            '<span>' + esc(info[1]) + '</span>' +
            '<span>Gefühlt ' + Math.round(current.apparent_temperature) + '°</span>' +
            '<span>Wind ' + Math.round(current.wind_speed_10m) + ' km/h</span>' +
            '<span>' + Math.round(current.relative_humidity_2m) + ' %</span>';
        });
    }).catch(function (err) {
      setWeatherError(err && err.name === 'AbortError' ? 'Zeitüberschreitung' : (err.message || 'API nicht erreichbar'));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Fakt / Zitat des Tages                                              */
  /* ------------------------------------------------------------------ */

  function loadFact() {
    var text = $('#fact-text');
    var source = $('#fact-source');
    var label = $('#fact-label');
    if (text) text.textContent = 'Wird geladen …';
    if (source) source.textContent = '';
    if (label) label.textContent = 'Fakt des Tages';

    var providers = [
      function () {
        return fetchJSON('https://uselessfacts.jsph.pl/api/v2/facts/random?language=de', 7000).then(function (data) {
          if (!data || !data.text) throw new Error('leer');
          return { text: data.text, source: 'uselessfacts.jsph.pl', label: 'Fakt des Tages' };
        });
      },
      function () {
        return fetchJSON('https://dummyjson.com/quotes/random', 7000).then(function (data) {
          if (!data || !data.quote) throw new Error('leer');
          return {
            text: '„' + data.quote + '“ — ' + (data.author || 'Unbekannt'),
            source: 'dummyjson.com',
            label: 'Zitat des Tages'
          };
        });
      },
      function () {
        return Promise.resolve({
          text: FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)],
          source: 'Offline-Fallback',
          label: 'Fakt des Tages'
        });
      }
    ];

    function next(index) {
      if (index >= providers.length) {
        if (text) text.textContent = 'Gerade keine Daten verfügbar.';
        return;
      }
      providers[index]().then(function (result) {
        if (text) text.textContent = result.text;
        if (source) source.textContent = 'Quelle: ' + result.source;
        if (label) label.textContent = result.label;
      }).catch(function () {
        next(index + 1);
      });
    }

    next(0);
  }

  /* ------------------------------------------------------------------ */
  /* Einstellungen                                                       */
  /* ------------------------------------------------------------------ */

  function syncSettingsUI() {
    $$('[data-theme-choice]').forEach(function (button) {
      var active = button.dataset.themeChoice === state.settings.theme;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    var pairs = [
      ['#engine-select', state.settings.engine],
      ['#set-engine', state.settings.engine],
      ['#set-city', state.settings.city],
      ['#set-panic-key', state.settings.panicKey],
      ['#set-panic-url', state.settings.panicUrl]
    ];
    pairs.forEach(function (pair) {
      var el = $(pair[0]);
      if (el && el.value !== pair[1]) el.value = pair[1];
    });

    var cloak = $('#set-cloak');
    if (cloak) cloak.checked = !!state.settings.cloak;

    var check = $('#set-check');
    if (check) check.checked = !!state.settings.checkUrls;

    var cloakToggle = $('#cloak-toggle');
    if (cloakToggle) {
      cloakToggle.classList.toggle('is-active', !!state.settings.cloak);
      cloakToggle.setAttribute('aria-pressed', String(!!state.settings.cloak));
    }

    var cloakState = $('#cloak-state');
    if (cloakState) cloakState.textContent = 'Cloak: ' + (state.settings.cloak ? 'an' : 'aus');
  }

  function openSettings() {
    var modal = $('#settings-modal');
    if (!modal) return;
    syncSettingsUI();
    modal.hidden = false;
    document.body.classList.add('modal-open');
    var close = $('#close-settings');
    if (close) close.focus();
  }

  function closeSettings() {
    var modal = $('#settings-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    var opener = $('#open-settings');
    if (opener) opener.focus();
  }

  function bindSettings() {
    var opener = $('#open-settings');
    if (opener) opener.addEventListener('click', openSettings);

    ['#close-settings', '#done-settings'].forEach(function (selector) {
      var button = $(selector);
      if (button) button.addEventListener('click', closeSettings);
    });

    var modal = $('#settings-modal');
    if (modal) {
      modal.addEventListener('click', function (event) {
        if (event.target === modal) closeSettings();
      });
      modal.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeSettings();
      });
    }

    $$('[data-theme-choice]').forEach(function (button) {
      button.addEventListener('click', function () {
        saveSettings({ theme: button.dataset.themeChoice });
        applyTheme();
      });
    });

    var setEngine = $('#set-engine');
    if (setEngine) {
      setEngine.addEventListener('change', function () {
        saveSettings({ engine: setEngine.value });
      });
    }

    var setCloak = $('#set-cloak');
    if (setCloak) {
      setCloak.addEventListener('change', function () {
        saveSettings({ cloak: setCloak.checked });
      });
    }

    var setCheck = $('#set-check');
    if (setCheck) {
      setCheck.addEventListener('change', function () {
        saveSettings({ checkUrls: setCheck.checked });
        if (setCheck.checked && DATA_SOURCES[state.route]) {
          var grid = $('[data-grid="' + state.route + '"]');
          if (grid) runChecker(grid);
        } else if (state.data[state.route] && state.data[state.route].status === 'ready') {
          renderGrid(state.route);
        }
      });
    }

    var setCity = $('#set-city');
    if (setCity) {
      setCity.addEventListener('change', function () {
        var value = setCity.value.trim() || DEFAULT_SETTINGS.city;
        saveSettings({ city: value });
        setCity.value = value;
        loadWeather(false);
        toast('Fallback-Stadt gespeichert', 'success');
      });
    }

    var panicInput = $('#set-panic-key');
    if (panicInput) {
      panicInput.addEventListener('focus', function () { panicInput.select(); });
      panicInput.addEventListener('keydown', function (event) {
        if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) return;
        event.preventDefault();
        event.stopPropagation();
        var combo = comboFromEvent(event);
        if (!combo) return;
        panicInput.value = combo;
        saveSettings({ panicKey: combo });
        panicInput.blur();
        toast('Panic-Key gespeichert: ' + combo, 'success');
      });
    }

    var panicUrl = $('#set-panic-url');
    if (panicUrl) {
      panicUrl.addEventListener('change', function () {
        var value = panicUrl.value.trim() || DEFAULT_SETTINGS.panicUrl;
        saveSettings({ panicUrl: value });
        panicUrl.value = value;
        toast('Panic-Ziel gespeichert', 'success');
      });
    }

    var clearFavs = $('#clear-favs');
    if (clearFavs) {
      clearFavs.addEventListener('click', function () {
        if (!state.favorites.length) {
          toast('Es gibt keine Favoriten zum Löschen.', 'info');
          return;
        }
        if (!window.confirm('Alle Favoriten entfernen?')) return;
        state.favorites = [];
        persistFavorites();
        refreshFavoritesView();
        if (DATA_SOURCES[state.route] && state.data[state.route]) renderGrid(state.route);
        toast('Favoriten gelöscht', 'success');
      });
    }

    var resetAll = $('#reset-all');
    if (resetAll) {
      resetAll.addEventListener('click', function () {
        if (!window.confirm('Alle Einstellungen und Favoriten zurücksetzen?')) return;
        try {
          localStorage.removeItem(STORE.settings);
          localStorage.removeItem(STORE.favorites);
          localStorage.removeItem(STORE.status);
        } catch (err) { /* ignore */ }
        window.location.reload();
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Panic-Key                                                           */
  /* ------------------------------------------------------------------ */

  function comboFromEvent(event) {
    var key = event.key;
    if (!key || ['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock'].indexOf(key) !== -1) return '';
    if (key === 'Dead') return '';
    var parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    var name = key;
    if (name === ' ') name = 'Space';
    if (name.length === 1) name = name.toUpperCase();
    parts.push(name);
    return parts.join('+');
  }

  function triggerPanic() {
    var target = String(state.settings.panicUrl || DEFAULT_SETTINGS.panicUrl).trim();
    try {
      if (/^about:blank$/i.test(target)) {
        try { window.open('about:blank', '_blank'); } catch (err) { /* ignore */ }
        window.location.replace('about:blank');
        return;
      }
      window.location.replace(target);
    } catch (err) {
      window.location.href = 'https://classroom.google.com';
    }
  }

  function bindPanic() {
    document.addEventListener('keydown', function (event) {
      if (event.repeat) return;
      var combo = comboFromEvent(event);
      if (!combo || combo !== state.settings.panicKey) return;

      var el = event.target;
      var typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' || el.isContentEditable);
      var hasModifier = event.ctrlKey || event.altKey || event.metaKey;

      if (typing && !hasModifier) return;

      event.preventDefault();
      triggerPanic();
    }, true);
  }

  /* ------------------------------------------------------------------ */
  /* Globale Shortcuts                                                   */
  /* ------------------------------------------------------------------ */

  function bindShortcuts() {
    document.addEventListener('keydown', function (event) {
      var tag = document.activeElement && document.activeElement.tagName;
      var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
        (document.activeElement && document.activeElement.isContentEditable);

      var wantsSearch = (event.key === '/' && !typing) ||
        ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k');

      if (!wantsSearch) return;
      event.preventDefault();

      var target = state.route === 'home'
        ? $('#search-input')
        : $('[data-filter="' + state.route + '"]');
      if (target) {
        target.focus();
        if (typeof target.select === 'function') target.select();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Event-Delegation für Karten & Favoriten                             */
  /* ------------------------------------------------------------------ */

  function bindCardEvents() {
    var main = $('#main');
    if (!main) return;

    main.addEventListener('click', function (event) {
      var more = event.target.closest('[data-more-links]');
      if (more) {
        var badgesBox = more.parentElement;
        var open = badgesBox.classList.toggle('is-open');
        more.setAttribute('aria-expanded', String(open));
        more.textContent = open
          ? 'Weniger anzeigen'
          : '+ ' + badgesBox.querySelectorAll('.badge.is-extra').length + ' weitere';
        return;
      }

      var dot = event.target.closest('.status-dot[data-url]');
      if (dot) {
        event.preventDefault();
        event.stopPropagation();
        cycleManualStatus(dot.dataset.url);
        return;
      }

      var playButton = event.target.closest('[data-play-url]');
      if (playButton) {
        event.preventDefault();
        openPlayer({
          url: playButton.dataset.playUrl,
          name: playButton.dataset.playName,
          icon: playButton.dataset.playIcon || '',
          type: playButton.dataset.playType || state.route
        });
        return;
      }

      var favoriteButton = event.target.closest('.card-fav');
      if (favoriteButton) {
        var added = toggleFavorite({
          url: favoriteButton.dataset.favUrl,
          name: favoriteButton.dataset.favName,
          icon: favoriteButton.dataset.favIcon,
          type: favoriteButton.dataset.favType
        });
        favoriteButton.classList.toggle('is-fav', added);
        favoriteButton.setAttribute('aria-pressed', String(added));
        favoriteButton.title = added ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen';
        favoriteButton.setAttribute('aria-label', favoriteButton.title);
        refreshFavoritesView();
        toast(added ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt', added ? 'success' : 'info');
        return;
      }

      var removeButton = event.target.closest('[data-remove-url]');
      if (removeButton) {
        var url = removeButton.dataset.removeUrl;
        state.favorites = state.favorites.filter(function (fav) { return fav.url !== url; });
        persistFavorites();
        refreshFavoritesView();
        if (DATA_SOURCES[state.route] && state.data[state.route]) renderGrid(state.route);
        toast('Favorit entfernt', 'info');
        return;
      }

      var rssMore = event.target.closest('#rss-more');
      if (rssMore) {
        loadMoreRss();
        return;
      }

      var retry = event.target.closest('[data-retry]');
      if (retry) {
        var key = retry.dataset.retry;
        delete state.data[key];
        loadData(key);
      }
    });

    var favList = $('#fav-list');
    if (favList) {
      favList.addEventListener('error', function (event) {
        var img = event.target;
        if (!img || img.tagName !== 'IMG') return;
        var holder = img.parentElement;
        if (holder) holder.textContent = img.dataset.initial || '?';
      }, true);
    }
  }

  function bindFilters() {
    $$('[data-filter]').forEach(function (input) {
      input.addEventListener('input', function () {
        var key = input.dataset.filter;
        var filter = state.filters[key] || (state.filters[key] = { q: '', group: '' });
        filter.q = input.value;
        renderGrid(key);
      });
    });

    $$('[data-chips]').forEach(function (box) {
      box.addEventListener('click', function (event) {
        var chip = event.target.closest('[data-chip-group]');
        if (!chip) return;
        var key = box.dataset.chips;
        var filter = state.filters[key] || (state.filters[key] = { q: '', group: '' });
        var next = chip.dataset.chipGroup || '';
        filter.group = filter.group === next ? '' : next;
        renderGrid(key);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Player (iframe für Games · Online)                                  */
  /* ------------------------------------------------------------------ */

  function playerNote(html) {
    var note = $('#player-note');
    if (!note) return;
    note.innerHTML = '<p>' + html + '</p>';
    note.classList.remove('is-hidden');
  }

  /* Eintrag zu einer URL finden – für die Domain-Knöpfe im Player. */
  function findItemByUrl(url) {
    if (!url) return null;
    var found = null;
    Object.keys(state.data).some(function (key) {
      var entry = state.data[key];
      if (!entry || !entry.groups) return false;
      entry.groups.some(function (group) {
        return group.items.some(function (item) {
          var match = (Array.isArray(item.urls) ? item.urls : []).some(function (u) {
            return u && u.url === url;
          });
          if (match) found = item;
          return match;
        });
      });
      return !!found;
    });
    return found;
  }

  /* Domain-Knöpfe im Player: erst die wichtigsten, Rest auf Klick. */
  function renderPlayerDomains(urls, currentUrl) {
    var box = $('#player-domains');
    if (!box) return;

    var list = (urls || []).filter(function (u) { return u && u.url; });
    if (list.length < 2) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }

    var limit = 8;
    box.hidden = false;
    box.classList.remove('is-open');
    box.innerHTML = '<span class="player-domains-label">Domain</span>' +
      list.map(function (u, i) {
        var label = u.label || hostOf(u.url);
        return '<button class="domain-chip' + (i >= limit ? ' is-extra' : '') +
          (u.url === currentUrl ? ' is-active' : '') + '" type="button" ' +
          'data-domain-url="' + esc(u.url) + '" title="' + esc(u.url) + '">' + esc(label) + '</button>';
      }).join('') +
      (list.length > limit
        ? '<button class="domain-chip domain-more" type="button" data-domain-more aria-expanded="false">+ ' +
            (list.length - limit) + ' weitere</button>'
        : '');
  }

  function switchPlayerDomain(url) {
    var frame = $('#player-frame');
    if (!frame || !url) return;

    state.player.url = url;
    var host = $('#player-host');
    if (host) host.textContent = hostOf(url);
    var external = $('#player-external');
    if (external) external.href = url;

    $$('#player-domains [data-domain-url]').forEach(function (chip) {
      chip.classList.toggle('is-active', chip.dataset.domainUrl === url);
    });

    playerNote('<strong>Domain wird geladen …</strong><br />Falls nichts passiert, hilft <em>Neuer Tab</em> oben rechts.');
    frame.src = url;

    window.clearTimeout(state.player.timer);
    state.player.timer = window.setTimeout(function () {
      if (!state.player.open) return;
      playerNote('<strong>Diese Domain lässt sich nicht einbetten.</strong><br />Nimm eine andere Domain oder <em>Neuer Tab</em>.');
    }, 12000);
  }

  function openPlayer(opts) {
    var root = $('#player');
    var frame = $('#player-frame');
    if (!root || !frame || !opts || !opts.url) {
      if (opts && opts.url) window.open(opts.url, '_blank', 'noopener,noreferrer');
      return;
    }

    state.player.url = opts.url;
    state.player.type = opts.type || state.route;
    state.player.open = true;

    var name = opts.name || 'Spiel';
    var title = $('#player-title');
    var host = $('#player-host');
    var icon = $('#player-icon');
    var external = $('#player-external');
    var close = $('#player-close');

    if (title) title.textContent = name;
    if (host) host.textContent = hostOf(opts.url);
    if (external) external.href = opts.url;

    if (icon) {
      icon.innerHTML = (opts.icon ? '<img src="' + esc(opts.icon) + '" alt="" data-initial="' + esc(initialOf(name)) + '">' : '') +
        '<span class="icon-fallback"' + (opts.icon ? ' hidden' : '') + ' aria-hidden="true">' + esc(initialOf(name)) + '</span>';
      if (opts.icon) hydrateIcons(icon);
    }

    playerNote('<strong>Spiel wird geladen …</strong><br />Manche Portale verbieten das Einbetten — dann hilft <em>Neuer Tab</em> oben rechts.');

    root.hidden = false;
    document.body.classList.add('player-open');
    frame.src = opts.url;

    var item = findItemByUrl(opts.url);
    state.player.urls = item && Array.isArray(item.urls) ? item.urls : [];
    renderPlayerDomains(state.player.urls, opts.url);

    window.clearTimeout(state.player.timer);
    state.player.timer = window.setTimeout(function () {
      if (!state.player.open) return;
      playerNote('<strong>Das Einbetten scheint blockiert zu sein.</strong><br />Öffne das Spiel über <em>Neuer Tab</em> oben rechts.');
    }, 12000);

    if (close) close.focus();
  }

  function closePlayer() {
    var root = $('#player');
    var frame = $('#player-frame');
    window.clearTimeout(state.player.timer);
    state.player.open = false;
    state.player.url = '';

    if (document.fullscreenElement && document.exitFullscreen) {
      try { document.exitFullscreen(); } catch (err) { /* ignore */ }
    }
    if (frame) frame.src = 'about:blank';
    if (root) root.hidden = true;
    document.body.classList.remove('player-open');
  }

  function updateFullscreenButton() {
    var button = $('#player-fullscreen');
    if (!button) return;
    var active = !!document.fullscreenElement;
    button.setAttribute('aria-pressed', String(active));
    button.title = active ? 'Vollbild verlassen' : 'Vollbild';
    var label = button.querySelector('.player-btn-label');
    if (label) label.textContent = active ? 'Vollbild aus' : 'Vollbild';
  }

  function togglePlayerFullscreen() {
    var shell = $('#player-shell');
    if (!shell) return;

    if (document.fullscreenElement) {
      try { document.exitFullscreen(); } catch (err) { /* ignore */ }
      return;
    }

    var request = shell.requestFullscreen || shell.webkitRequestFullscreen;
    if (!request) {
      toast('Vollbild wird von diesem Browser nicht unterstützt.', 'error');
      return;
    }

    try {
      var result = request.call(shell);
      if (result && typeof result.catch === 'function') {
        result.catch(function () { toast('Vollbild wurde blockiert.', 'error'); });
      }
    } catch (err) {
      toast('Vollbild wurde blockiert.', 'error');
    }
  }

  function bindPlayer() {
    var domains = $('#player-domains');
    if (domains) {
      domains.addEventListener('click', function (event) {
        var more = event.target.closest('[data-domain-more]');
        if (more) {
          var open = domains.classList.toggle('is-open');
          more.setAttribute('aria-expanded', String(open));
          more.textContent = open
            ? 'Weniger anzeigen'
            : '+ ' + domains.querySelectorAll('.domain-chip.is-extra').length + ' weitere';
          return;
        }
        var chip = event.target.closest('[data-domain-url]');
        if (chip) switchPlayerDomain(chip.dataset.domainUrl);
      });
    }

    var home = $('#player-home');
    if (home) {
      home.addEventListener('click', function () {
        var target = ROUTES.indexOf(state.player.type) !== -1 ? state.player.type : 'home';
        closePlayer();
        if (window.location.hash === '#/' + target) renderRoute(target);
        else window.location.hash = '#/' + target;
      });
    }

    var reload = $('#player-reload');
    if (reload) {
      reload.addEventListener('click', function () {
        var frame = $('#player-frame');
        if (!frame || !state.player.url) return;
        var url = state.player.url;
        frame.src = 'about:blank';
        window.clearTimeout(state.player.timer);
        window.setTimeout(function () {
          if (!state.player.open) return;
          playerNote('<strong>Spiel wird neu geladen …</strong>');
          frame.src = url;
        }, 40);
      });
    }

    var fullscreen = $('#player-fullscreen');
    if (fullscreen) fullscreen.addEventListener('click', togglePlayerFullscreen);

    var close = $('#player-close');
    if (close) close.addEventListener('click', closePlayer);

    var frame = $('#player-frame');
    if (frame) {
      frame.addEventListener('load', function () {
        if (!state.player.open) return;
        if (frame.getAttribute('src') === 'about:blank') return;
        var note = $('#player-note');
        if (note) note.classList.add('is-hidden');
        window.clearTimeout(state.player.timer);
      });
    }

    document.addEventListener('fullscreenchange', updateFullscreenButton);

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !state.player.open) return;
      if (document.fullscreenElement) return;
      closePlayer();
    });
  }

  function bindWidgets() {
    var weatherRefresh = $('#weather-refresh');
    if (weatherRefresh) {
      weatherRefresh.addEventListener('click', function () {
        state.weather.coords = null;
        loadWeather(false);
      });
    }

    var weatherGeo = $('#weather-geo');
    if (weatherGeo) {
      weatherGeo.addEventListener('click', function () {
        loadWeather(true);
      });
    }

    var factRefresh = $('#fact-refresh');
    if (factRefresh) factRefresh.addEventListener('click', loadFact);
  }

  /* ------------------------------------------------------------------ */
  /* Intro / Lockscreen                                                  */
  /* ------------------------------------------------------------------ */

  var introState = { unlocked: false, drag: null, selected: null, frame: 0 };

  function introReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function binHit(clientX, clientY) {
    var bin = $('#intro-bin');
    if (!bin) return false;
    var rect = bin.getBoundingClientRect();
    var pad = 34;
    return clientX >= rect.left - pad && clientX <= rect.right + pad &&
      clientY >= rect.top - pad && clientY <= rect.bottom + pad;
  }



  var appBooted = false;

  /* Die Hauptseite lädt erst nach dem Entsperren – hält den Intro flüssig. */
  function bootMain() {
    if (appBooted) return;
    appBooted = true;
    renderRoute(parseHash());
    loadWeather(false);
    loadFact();
  }

  function resetIntroDrag() {
    var drag = introState.drag;
    if (!drag) return;
    var tile = drag.tile;
    tile.classList.remove('is-dragging');
    ['left', 'top', 'width', 'height', 'transform', 'transition', 'opacity', 'will-change'].forEach(function (prop) {
      tile.style.removeProperty(prop);
    });
    document.documentElement.classList.remove('intro-dragging');
    var bin = $('#intro-bin');
    if (bin) bin.classList.remove('is-hover');
    introState.drag = null;
  }

  function setBinReady() {
    var bin = $('#intro-bin');
    if (bin) bin.classList.toggle('is-ready', !!introState.selected);
  }

  function selectTile(tile) {
    if (!tile) return;
    if (introState.selected === tile) {
      tile.classList.remove('is-selected');
      introState.selected = null;
    } else {
      if (introState.selected) introState.selected.classList.remove('is-selected');
      introState.selected = tile;
      tile.classList.add('is-selected');
    }
    setBinReady();
  }

  /* Ein rAF pro Frame; bewegt wird per transform statt left/top. */
  function scheduleDragFrame() {
    if (introState.frame) return;
    introState.frame = window.requestAnimationFrame(function () {
      introState.frame = 0;
      var drag = introState.drag;
      if (!drag) return;
      drag.tile.style.transform = 'translate3d(' + drag.dx + 'px,' + drag.dy + 'px,0) scale(1.06) rotate(-2deg)';
      var bin = $('#intro-bin');
      if (bin) bin.classList.toggle('is-hover', binHit(drag.x, drag.y));
    });
  }

  /* Schickt eine Kachel in den Papierkorb – gezogen oder nur angeklickt. */
  function sendTileToBin(tile, bin) {
    var rect = tile.getBoundingClientRect();
    if (!tile.classList.contains('is-dragging')) {
      tile.style.width = rect.width + 'px';
      tile.style.height = rect.height + 'px';
      tile.style.left = rect.left + 'px';
      tile.style.top = rect.top + 'px';
      tile.classList.add('is-dragging');
      void tile.offsetWidth;
      rect = tile.getBoundingClientRect();
    }
    if (!bin) return;
    var binRect = bin.getBoundingClientRect();
    tile.style.transition = 'left .4s cubic-bezier(.4,0,.6,1), top .4s cubic-bezier(.4,0,.6,1), transform .4s ease, opacity .3s ease .1s';
    tile.style.left = (binRect.left + binRect.width / 2 - rect.width / 2) + 'px';
    tile.style.top = (binRect.top + binRect.height * 0.42 - rect.height / 2) + 'px';
    tile.style.transform = 'scale(.14) rotate(-16deg)';
    tile.style.opacity = '0';
  }

  function buildShards() {
    var holder = $('#shatter-shards');
    var lock = $('#lock-shape');
    if (!holder || !lock || holder.childElementCount) return;
    var pieces = [
      { poly: 'polygon(0% 0%, 55% 0%, 48% 38%, 0% 44%)', dx: '-120px', dy: '-110px', rot: '-38deg' },
      { poly: 'polygon(55% 0%, 100% 0%, 100% 40%, 60% 34%)', dx: '120px', dy: '-120px', rot: '34deg' },
      { poly: 'polygon(0% 44%, 48% 38%, 58% 58%, 36% 100%, 0% 100%)', dx: '-130px', dy: '40px', rot: '-24deg' },
      { poly: 'polygon(60% 34%, 100% 40%, 100% 100%, 72% 100%, 58% 58%)', dx: '130px', dy: '90px', rot: '28deg' },
      { poly: 'polygon(36% 100%, 58% 58%, 66% 62%, 72% 100%)', dx: '-30px', dy: '140px', rot: '16deg' },
      { poly: 'polygon(48% 38%, 60% 34%, 58% 58%)', dx: '30px', dy: '-40px', rot: '-12deg' }
    ];
    var markup = lock.outerHTML.replace(' id="lock-shape"', '');

    pieces.forEach(function (piece, index) {
      var shard = document.createElement('span');
      shard.className = 'shatter-shard';
      shard.style.clipPath = piece.poly;
      shard.style.setProperty('--dx', piece.dx);
      shard.style.setProperty('--dy', piece.dy);
      shard.style.setProperty('--rot', piece.rot);
      shard.style.animationDelay = (index * 24) + 'ms';
      shard.innerHTML = markup;
      holder.appendChild(shard);
    });
  }

  function playShatter() {
    var shatter = $('#intro-shatter');
    var lock = $('#shatter-lock');
    if (!shatter || !lock) return;
    buildShards();
    shatter.hidden = false;
    lock.classList.add('is-cracked');
    window.setTimeout(function () { shatter.classList.add('is-live'); }, 300);
  }

  function finishIntro() {
    var intro = $('#intro');
    if (!intro) return;
    intro.classList.add('is-done');
    document.documentElement.classList.remove('intro-locked');
    window.setTimeout(function () {
      intro.hidden = true;
    }, introReducedMotion() ? 60 : 640);
  }

  /* Ein Symbol verschwindet im Papierkorb, dann zerspringt das Schloss. */
  function unlockIntro(tile) {
    if (introState.unlocked) return;
    introState.unlocked = true;

    introState.drag = null;
    document.documentElement.classList.remove('intro-dragging');

    var bin = $('#intro-bin');
    if (introState.selected) {
      introState.selected.classList.remove('is-selected');
      introState.selected = null;
    }
    setBinReady();

    if (tile) sendTileToBin(tile, bin);
    if (bin) bin.classList.add('is-hit');

    bootMain();

    window.setTimeout(playShatter, introReducedMotion() ? 40 : 430);
    window.setTimeout(finishIntro, introReducedMotion() ? 400 : 2520);
  }

  function bindIntro() {
    var intro = $('#intro');
    if (!intro) {
      document.documentElement.classList.remove('intro-locked');
      return;
    }

    var bin = $('#intro-bin');

    $$('.censor-icon', intro).forEach(function (tile) {
      tile.addEventListener('pointerdown', function (event) {
        if (introState.unlocked || event.button > 0) return;
        event.preventDefault();
        var rect = tile.getBoundingClientRect();
        introState.drag = {
          tile: tile,
          id: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          x: event.clientX,
          y: event.clientY,
          dx: 0,
          dy: 0,
          moved: false
        };
        tile.style.width = rect.width + 'px';
        tile.style.height = rect.height + 'px';
        tile.style.left = rect.left + 'px';
        tile.style.top = rect.top + 'px';
        tile.classList.add('is-dragging');
        document.documentElement.classList.add('intro-dragging');
        try { tile.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
      });

      tile.addEventListener('pointermove', function (event) {
        var drag = introState.drag;
        if (!drag || drag.id !== event.pointerId) return;
        drag.x = event.clientX;
        drag.y = event.clientY;
        drag.dx = event.clientX - drag.startX;
        drag.dy = event.clientY - drag.startY;
        if (!drag.moved && Math.abs(drag.dx) + Math.abs(drag.dy) > 4) drag.moved = true;
        scheduleDragFrame();
      });

      tile.addEventListener('pointerup', function (event) {
        var drag = introState.drag;
        if (!drag || drag.id !== event.pointerId) return;
        if (binHit(event.clientX, event.clientY)) {
          unlockIntro(drag.tile);
          return;
        }
        var tapped = !drag.moved;
        resetIntroDrag();
        if (tapped) selectTile(tile);
      });

      tile.addEventListener('pointercancel', function (event) {
        var drag = introState.drag;
        if (!drag || drag.id !== event.pointerId) return;
        resetIntroDrag();
      });

      tile.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectTile(tile);
      });
    });

    if (bin) {
      bin.addEventListener('click', function () {
        if (introState.unlocked) return;
        if (introState.selected) {
          unlockIntro(introState.selected);
          return;
        }
        bin.classList.add('is-hover');
        window.setTimeout(function () { bin.classList.remove('is-hover'); }, 450);
      });

      bin.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (introState.selected) unlockIntro(introState.selected);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Tab-Cloak: Titel, Favicon und Pfad tarnen                           */
  /* ------------------------------------------------------------------ */

  var CLOAK_PRESETS = [
    { id: 'google', title: 'Google', icon: 'https://www.google.com/favicon.ico', path: 'search?q=wetter' },
    { id: 'newtab', title: 'Neue Tab', icon: '', path: '' },
    { id: 'classroom', title: 'Google Classroom', icon: 'https://ssl.gstatic.com/classroom/favicon.png', path: '' },
    { id: 'gmail', title: 'Gmail', icon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico', path: '' },
    { id: 'docs', title: 'Google Docs', icon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico', path: '' },
    { id: 'wikipedia', title: 'Wikipedia', icon: 'https://de.wikipedia.org/favicon.ico', path: '' }
  ];

  function setPageMeta(title, icon) {
    document.title = title || '';
    var link = $('#favicon');
    if (link) link.setAttribute('href', icon || 'data:,');
  }

  /* Die Domain kann eine Seite nicht ändern – nur den Pfad dahinter. */
  function applyCloakPath(path) {
    if (!window.history || !window.history.replaceState) return;
    try {
      var base = window.location.pathname.replace(/[^/]*$/, '');
      var target = base + String(path || '').replace(/^\/+/, '');
      window.history.replaceState(null, '', target + (window.location.hash || ''));
    } catch (err) { /* ohne History-API bleibt es beim Titel */ }
  }

  function cloakIsActive() {
    return !!(state.settings.pageTitle || state.settings.pageIcon || state.settings.pagePath);
  }

  function applyCloak(patch) {
    saveSettings({
      pageTitle: String(patch.title || ''),
      pageIcon: String(patch.icon || ''),
      pagePath: String(patch.path || '')
    });
    setPageMeta(state.settings.pageTitle, state.settings.pageIcon);
    applyCloakPath(state.settings.pagePath);
    syncCloakUI();
  }

  function renderCloakPresets() {
    var box = $('#cloak-presets');
    if (!box || box.childElementCount) return;
    box.innerHTML = CLOAK_PRESETS.map(function (preset) {
      return '<button class="cloak-card" type="button" data-cloak-id="' + esc(preset.id) + '" aria-pressed="false">' +
        '<span class="cloak-card-icon">' +
          (preset.icon ? '<img src="' + esc(preset.icon) + '" alt="" loading="lazy">' : '📄') +
        '</span>' +
        '<span class="cloak-card-text">' +
          '<span>' + esc(preset.title) + '</span>' +
          '<small>' + esc(preset.path || 'ohne Pfad') + '</small>' +
        '</span>' +
      '</button>';
    }).join('');
  }

  function syncCloakUI() {
    renderCloakPresets();

    var titleInput = $('#cloak-title-input');
    var pathInput = $('#cloak-path-input');
    if (titleInput) titleInput.value = state.settings.pageTitle || '';
    if (pathInput) pathInput.value = state.settings.pagePath || '';

    var label = $('#cloak-state');
    if (label) {
      label.textContent = cloakIsActive()
        ? 'aktiv: ' + (state.settings.pageTitle || 'ohne Titel')
        : 'nichts aktiv';
    }

    $$('#cloak-presets .cloak-card').forEach(function (card) {
      var preset = CLOAK_PRESETS.find(function (p) { return p.id === card.dataset.cloakId; });
      var active = !!preset &&
        preset.title === (state.settings.pageTitle || '') &&
        (preset.path || '') === (state.settings.pagePath || '');
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-pressed', String(active));
    });
  }

  function bindCloak() {
    var presets = $('#cloak-presets');
    if (presets) {
      presets.addEventListener('click', function (event) {
        var card = event.target.closest('[data-cloak-id]');
        if (!card) return;
        var preset = CLOAK_PRESETS.find(function (p) { return p.id === card.dataset.cloakId; });
        if (!preset) return;
        applyCloak(preset);
        toast('Tarnung aktiv: ' + preset.title, 'success');
      });
    }

    var apply = $('#cloak-apply');
    if (apply) {
      apply.addEventListener('click', function () {
        var title = $('#cloak-title-input');
        var path = $('#cloak-path-input');
        var nextTitle = title ? title.value.trim() : '';
        applyCloak({
          title: nextTitle,
          icon: nextTitle && nextTitle === state.settings.pageTitle ? state.settings.pageIcon : '',
          path: path ? path.value.trim() : ''
        });
        toast(nextTitle ? 'Tarnung gespeichert: ' + nextTitle : 'Tarnung aus', 'success');
      });
    }

    var reset = $('#cloak-reset');
    if (reset) {
      reset.addEventListener('click', function () {
        applyCloak({ title: '', icon: '', path: '' });
        toast('Tarnung aus', 'info');
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */

  function init() {
    buildEngineOptions();
    applyTheme();

    /* Tarnung sofort setzen – noch bevor der Rest der Seite aufgebaut ist. */
    setPageMeta(state.settings.pageTitle, state.settings.pageIcon);
    applyCloakPath(state.settings.pagePath);

    bindRouter();
    bindSearch();
    bindSettings();
    bindPanic();
    bindShortcuts();
    bindCardEvents();
    bindFilters();
    bindFinder();
    bindPlayer();
    bindWidgets();
    bindCloak();

    var hasIntro = !!$('#intro');
    bindIntro();

    tickClock();
    setInterval(tickClock, 1000);

    refreshFavoritesView();
    updateGamesCounter();
    if (!hasIntro) bootMain();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
