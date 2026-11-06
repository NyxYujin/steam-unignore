/* ============================================================================
   steam-unignore — clear your Steam "Not interested" (ignored games) list
   MIT licensed
   ----------------------------------------------------------------------------
   WHERE TO RUN: any page on https://store.steampowered.com
                 e.g. https://store.steampowered.com/account/notinterested/

   HOW: open DevTools (F12) -> Console -> paste all of this -> Enter.

   The script backs up the appid list to the console, asks for confirmation,
   then removes each entry one at a time, and re-reads the list afterwards to
   verify that it is actually empty.
   ============================================================================ */
(async () => {
  // ------------------------------ options ---------------------------------
  const DELAY_MS = 350;    // pause between removals, in ms. Raise it if you see errors.
  const MAX_PASSES = 3;    // how many verify/retry rounds before giving up
  const DRY_RUN = false;   // true = just list what would be removed, change nothing
  // ------------------------------------------------------------------------

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => console.log('%c[steam]', 'color:#66c0f4;font-weight:700', ...a);
  const warn = (...a) => console.warn('%c[steam]', 'color:#e5a00d;font-weight:700', ...a);

  // --- 1. must be on the store domain (same-origin cookies + CSRF token) ---
  if (!/(^|\.)steampowered\.com$/i.test(location.hostname)) {
    warn(`Run this on store.steampowered.com — you are on "${location.hostname}".`);
    return log('Open https://store.steampowered.com/account/notinterested/ and paste it there.');
  }

  // --- 2. session id (CSRF token) -----------------------------------------
  const sessionId =
    (typeof g_sessionID === 'string' && g_sessionID) ||
    (document.cookie.match(/(?:^|;\s*)sessionid=([^;]+)/) || [])[1];

  if (!sessionId) {
    warn('No "sessionid" cookie found — you are probably not signed in.');
    return log('Sign in at https://store.steampowered.com/account/notinterested/ then paste again.');
  }

  // --- 3. read the current ignore list ------------------------------------
  async function getIgnored() {
    const res = await fetch('/dynamicstore/userdata/?t=' + Date.now(), {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('GET /dynamicstore/userdata/ -> HTTP ' + res.status);
    const data = await res.json();

    // rgIgnoredApps is normally {"<appid>": <something>}; tolerate an array too.
    const raw = data.rgIgnoredApps;
    let ids;
    if (Array.isArray(raw)) ids = raw.map(Number);
    else if (raw && typeof raw === 'object') ids = Object.keys(raw).map(Number);
    else ids = [];

    ids = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);

    const pkgs = data.rgIgnoredPackages;
    const packages = (Array.isArray(pkgs) ? pkgs : Object.keys(pkgs || {})).filter(Boolean);

    return { ids, packages };
  }

  // --- 4. remove a single appid -------------------------------------------
  async function removeOne(appid) {
    const res = await fetch('/recommended/ignorerecommendation/', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: new URLSearchParams({
        sessionid: sessionId,
        appid: String(appid),
        remove: '1',
      }),
    });
    if (res.status === 429 || res.status >= 500) {
      throw Object.assign(new Error('HTTP ' + res.status + ' (rate limited / server error)'), {
        retryable: true,
      });
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
  }

  let { ids, packages } = await getIgnored();

  log(`Session OK. You currently ignore ${ids.length} game(s).`);
  if (packages.length) {
    warn(
      `${packages.length} ignored package id(s) also exist. Those are a separate category ` +
        'and are NOT touched by this script.'
    );
  }
  if (!ids.length) return log('Your "Not interested" list is already empty. Nothing to do.');

  // --- 5. backup, always (even in dry run) --------------------------------
  log('BACKUP of the list being cleared (save this if you ever want to restore):');
  console.log(ids.join(','));
  try {
    if (typeof copy === 'function') {
      copy(ids.join(','));
      log('(also copied to your clipboard)');
    }
  } catch (_) {}

  if (DRY_RUN) return log(`DRY_RUN is on — would remove ${ids.length} entries, changed nothing.`);

  const ok = confirm(
    `Permanently remove all ${ids.length} games from your Steam "Not interested" list?\n\n` +
      `Estimated time: ~${Math.ceil((ids.length * DELAY_MS) / 1000)}s.\n` +
      'This cannot be undone (a backup of the appids is in the console).'
  );
  if (!ok) return log('Cancelled — nothing was changed.');

  // --- 6. remove everything, in passes ------------------------------------
  let toDo = ids.slice();
  let removed = 0;
  let sent = 0;

  for (let pass = 1; pass <= MAX_PASSES && toDo.length; pass++) {
    if (pass > 1) {
      log(`Pass ${pass}: ${toDo.length} still ignored, retrying…`);
      await sleep(1500);
    }
    const failed = [];
    for (const appid of toDo) {
      try {
        await removeOne(appid);
        removed++;
      } catch (err) {
        if (err.retryable) await sleep(2000 * pass);
        failed.push(appid);
        warn(`appid ${appid}: ${err.message}`);
      }
      sent++;
      if (sent % 25 === 0) log(`… ${sent} requests sent, ${removed} removed`);
      await sleep(DELAY_MS);
    }
    toDo = failed;
  }

  // --- 7. verify against the real list ------------------------------------
  let left;
  try {
    left = (await getIgnored()).ids;
  } catch (err) {
    warn('Could not re-read the list to verify:', err.message);
    left = toDo;
  }

  if (!left.length) {
    log(`Done — your "Not interested" list is empty (removed ${removed} entries).`);
    log('Reload the store page to see it gone (hard reload: Ctrl+Shift+R).');
  } else {
    warn(`${left.length} entries are still ignored after ${MAX_PASSES} passes.`);
    console.log(left.join(','));
    log('Try again later with a higher DELAY_MS (e.g. 1000) — Steam may be rate limiting.');
  }
})();
