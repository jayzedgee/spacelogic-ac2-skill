---
name: spacelogic-ac2
description: Drive a Schneider/Clipsal SpaceLogic C-Bus Application Controller (5500AC2, also 5500NAC2/5500SHAC, LogicMachine-based web UI) from a logged-in browser tab - read and set C-Bus objects, edit the tag map, create, upload, enable and test Lua scripts, read logs - safely, with read-back verification. Use when asked to inspect, program or test an AC2/NAC/SHAC controller.
---

# SpaceLogic C-Bus Application Controller (AC2) - operator guide

This guide was worked out by reading the controller's own web UI code (firmware 2.3.0, model string `LSS5500SHAC`) and confirmed against a live installation. It is not official Schneider documentation. Every request below is the same request the web UI sends when you click the matching button.

Files in this skill:
- `reference.md`: every endpoint with request and response shapes.
- `ac2.js`: helper functions to paste into the browser tab.
- `lua-notes.md`: Lua quirks of the controller's scripting.

## How to connect

- Use a browser tab where the user is **already logged in** to `https://<controller-ip>/scada-main`. The certificate is self-signed.
- **Never type or ask for the password.** If you are sent to `/login`, ask the user to log in again. Sessions expire, typically overnight.
- Run requests as JavaScript **in that tab** with `fetch(..., {credentials:'include'})`. Every call is a `POST` with `Content-Type: application/x-www-form-urlencoded` and `X-Requested-With: XMLHttpRequest`.
- **The page's own globals do the address conversion:**
  - `Scada.decodeGroupAddress(id)` turns an object id into `"net/app/group"`;
  - `Cbuslib.encodeObjectAddress("net/app/group")` does the reverse;
  - `Cbuscore.getAppName(id)` gives the application type (`lighting`, `trigger`, ...).
- **Wait for the page to finish loading** before using `$O`, `$S`, `$CM` or `$E`: poll for them. A request made while the page is still loading runs on the wrong page.
- **Local network 0:** in object addresses the controller's own C-Bus network shows as network `0` (in Toolkit it may be 254 or another number).

## Safety rules (always)

1. **Read before write.**
   - Before changing anything, read its current state and check it is what you expect.
   - Before uploading a script, check a SHA-256 of the current source against the last known copy. If it changed, stop and ask.
2. **Verify after write.** Read the object, tag or script back. Compare a SHA-256 of an uploaded script with the local file.
3. **Never delete an existing script; disable it instead.** Delete only temporary scripts you created yourself, and only with the user's OK.
4. **Check the target's name and id** before toggling, saving or deleting a script. Ids are reused and lists shift.
5. **Switch one thing at a time** in a live building, and get the user's approval for each go-live. The controller drives real loads, shutters and doors.
6. **New scripts are created disabled.** Enable them only when the user says so.
7. **Don't hide failures.** Show the failing response or log line.

## Common tasks (details in reference.md)

| Task | How |
|---|---|
| List objects with values | `objects/main` (`start=0&limit=5000`) |
| Send a C-Bus command | `objects/setvalue`; the value shape depends on the application type |
| Read an object's settings and keywords | `objects/form` `data={"id":<id>}` |
| Create an object or change its keywords | the UI's own Objects form (`$O.showForm`, `$O.tagCombos`, `$O.submitForm`). The group must exist in the tag map first |
| Add or rename a tag map entry (group name) | `cbustagmap/save` with `id:"0"` for new, the existing `id` to rename |
| List scripts | `scripting/main` |
| Read script source | `scripting/form` `id=<id>` returns `data.script` |
| Create a script (no source) | `scripting/save` without an id; it is created disabled |
| Upload script source | open `/scada-main/main/editor?id=<id>`, `$CM.setValue(src)`, `$E.changed=true`, `$E.submitForm()` |
| Enable or disable a script | `scripting/status` `data={"id":<id>}`. It **toggles**, so read `active` first |
| Read logs and errors | `logs/main` and `errorlog/main` (newest first) |
| Test Lua without touching live scripts | a temporary **resident** script: enable it, let it run once, disable it, read the log |

## Quirks that cost time if you don't know them

**Tag map**
- **Tag names must be unique.** `cbustagmap/save` returns `{"success":false}` with no reason if the name is already used, even on another group. Rename the old entry first, for example by adding " OLD".
- **A new tag map entry needs `id:"0"`.** Without it the save fails silently.
- **Reload the page after a tag map change.** The Objects form's group list only offers groups that are in the tag map, as loaded when the page opened.

**Objects**
- **Object names don't save from the form.** The name you type when creating an object may not persist. It is cosmetic; scripts use addresses.

**Scripts**
- **`scripting/run` only works for non-event scripts.** For an event script, the editor's Run button writes a value to a tagged object instead.
- **Saving a resident script restarts it.** Check its log afterwards.

**Multi-network behaviour (important)**
- **One telegram updates every network.** When the controller receives a telegram on one network (bridged or local), it updates **every** object with the same application and group number on **all** networks. Event scripts on those other-network objects run.
  - This also applies to the controller's own writes.
  - Before keying a script on a group, check that the number is not used on any other network for the same application.
  - See `reference.md`, "Multi-network installations".

**Clock, logs and sessions**
- **The controller clock may be wrong.** Use the newest object `updatetime` as "controller now" when matching log times.
- **The log keeps only about 230 entries,** so read test evidence within a few hours. A chatty resident script (heartbeats) shortens this.
- **Talking to localhost:** browsers may block `fetch` from the controller page to a local helper on `http://127.0.0.1`. Don't rely on it for exporting files.
- **Tool output filters:** some browser-automation tools hide hex strings that look like tokens. Compare hashes inside the page and return only true or false.
