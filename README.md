# steam-unignore

> Clears your entire Steam "Not interested" (ignored games) list in one paste — no extension, no userscript manager, no dependencies, no account sharing.

*Also known as: the Steam "Not interested" list cleaner, or "steam clear ignored games".*

![license](https://img.shields.io/badge/license-MIT-blue)
![language](https://img.shields.io/badge/language-JavaScript-yellow)
![dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)

Steam lets you hide games from your recommendations with **Not interested** (internally "Ignore"), but it never gives you a *clear all* button — and the list is only visible as a plain page buried in your account settings. Over time it quietly grows into hundreds of entries that shape what the store shows you.

This is a single JavaScript file you paste into the browser console. It removes every entry from your own session, one request at a time, and verifies the result.

## What it does

- Reads your ignore list from Steam's own store API (`rgIgnoredApps`)
- **Backs up** every app ID to the console *and* your clipboard before changing anything
- Asks for confirmation — nothing happens until you click OK
- Removes each entry, with automatic backoff and retries if Steam rate-limits you
- Re-reads the list afterwards to verify it really is empty
- Supports a dry run so you can see the damage before committing

## Requirements

A browser signed in to Steam. That's it — no extension, no build step, no Node, no dependencies.

## Usage

1. Sign in and open <https://store.steampowered.com/account/notinterested/>
2. Open DevTools — `F12`, or `Ctrl+Shift+I` / `Cmd+Opt+I`
3. Switch to the **Console** tab
4. Paste the entire contents of [`steam-unignore.js`](steam-unignore.js) and press Enter
5. Confirm the dialog

> **Chrome / Edge:** the first paste is blocked by the "Don't paste code you don't understand" warning. Type `allow pasting`, press Enter, then paste again.
>
> **Wrong tab:** it must be a `store.steampowered.com` page. It reads your `sessionid` cookie, which only exists on that origin — `steamcommunity.com` won't work, and the script will tell you so.

## Options

Edit the constants at the top of the script.

| Option | Default | Meaning |
| --- | --- | --- |
| `DELAY_MS` | `350` | Pause between removals, in milliseconds. Raise it if you see errors. |
| `MAX_PASSES` | `3` | How many remove → verify → retry rounds to attempt. |
| `DRY_RUN` | `false` | `true` = only report what would be removed. Changes nothing. |

A list of 500 games takes roughly three minutes at the default delay.

## What gets cleared — and what doesn't

| Data | Touched? |
| --- | --- |
| Ignored games (`rgIgnoredApps`) | ✅ removed |
| Ignored packages (`rgIgnoredPackages`) | ❌ reported, but left alone |
| Excluded tags / content descriptors | ❌ never touched |
| Games hidden in your Steam *library* | ❌ a different feature, stored elsewhere |
| Ignored users on Steam Community | ❌ a different feature entirely |

If ignored packages exist, the script mentions how many, so the end result is not a surprise.

## How it works

Two undocumented-but-long-standing Steam store endpoints — the same ones the store calls when you click **Not interested**:

```text
GET  /dynamicstore/userdata/             -> { rgIgnoredApps: { "<appid>": ... }, ... }
POST /recommended/ignorerecommendation/  -> sessionid, appid, remove=1
```

The `~350 ms` pacing matches what other community ignore-list tools use. Success is never trusted from the POST response — the script re-reads `rgIgnoredApps` afterwards and reports what is *actually* left.

## Is this safe?

Reasonable things to check before running a stranger's console snippet:

- **No third-party requests.** The only network calls are the two `store.steampowered.com` URLs above. Nothing is sent elsewhere, and no data is collected.
- **Runs in your session only.** It uses the cookies your browser already has — no login form, no token exfiltration, no OAuth.
- **It's ~160 lines.** Short enough to audit in a couple of minutes.
- **It's the same request the UI makes** — just repeated, paced, and verified. Steam rate-limits it like any other store action.

It is, however, **destructive and there is no undo.** Steam has no "restore previous list" feature, which is exactly why the script dumps the app IDs first. Save that line.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Nothing happens | You're not on `store.steampowered.com`, or the paste was blocked — type `allow pasting` first. |
| `No "sessionid" cookie found` | You're signed out. Log in, reload the list page, paste again. |
| Some entries remain | Steam throttled you. Wait a few minutes, set `DELAY_MS` to `1000`, run it again — it picks up only what's left. |
| List page still shows games after it finishes | Cached page. Hard reload with `Ctrl+Shift+R` / `Cmd+Shift+R`. |
| `confirm()` doesn't appear | Dialogs may be suppressed by the browser. Set `DRY_RUN = true` to inspect first. |

## FAQ

**Does clearing the list change my recommendations?**
Yes, eventually — ignored games become eligible for recommendations again, and previously suppressed titles may reappear. That's usually the point.

**Can I restore the list later?**
Not from Steam. The app IDs printed at the start are your backup; the [Import/Export Steam Ignore List](https://greasyfork.org/en/scripts/504215-import-export-steam-ignore-list-v2/code) userscript can add them back.

**Will this get my account flagged?**
The script performs the same request the store's own UI performs, just repeatedly and paced. Keep the delay sensible and don't hammer it. Still: use at your own risk.

**Why not a userscript or browser extension?**
No install step, no permissions prompt, nothing left running in the background. Paste once, done.

## Disclaimer

Not affiliated with Valve Corporation. Uses an undocumented Steam endpoint that could change or disappear at any time — if it breaks, open an issue. Tested against the live store as of November 2026; the endpoint layout has been stable for years.

## License

[MIT](LICENSE)
