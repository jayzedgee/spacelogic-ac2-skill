# AC2 web UI endpoints - reference

All are `POST https://<ip>/scada-main/<module>/<action>` and use the logged-in session cookie, sent with:

```
Content-Type: application/x-www-form-urlencoded
X-Requested-With: XMLHttpRequest
```

Most write calls take one form field, `data=<URL-encoded JSON>`. The page helper `Scada.encodeData(obj)` gives `{data: JSON.stringify(obj)}`.

Responses are JSON. Any `.../main` list is either an array or `{data:[...]}`, so handle both. A response of 404 or 401 HTML means one of two things:
- the request was a GET (use POST);
- the session ended, and the page is on `/login`.

## Objects

| Action | Body | Returns |
|---|---|---|
| `objects/main` | `start=0&limit=5000` | `[{address, id, name, datadec, datahex, datatype, updatetime (unix s), tagcache (comma-separated keywords), units, comment, disablelog, highpriolog}]`. `address` = `id` = encoded group address. |
| `objects/form` | `data={"id":<id>}` | `{data:{..., tags:{value:[{tag}], tags:[all keywords]}}}` |
| `objects/setvalue` | `data={value, type, datatype, address}` | `{"success":true}` |
| `objects/save` | sent by the Objects form, `mode:"json"`; easiest through the UI, see below | |

### `objects/setvalue` value shapes

| Type (`Cbuscore.getAppName(id)`) | `value` | `datatype` |
|---|---|---|
| `lighting` (also Blinds 54 and other Lighting-type apps) | JSON **string** `{"target":0-255,"ramprate":0}` | 0 |
| `trigger` (Trigger Control, 202) | number 0-255 | 0 |
| `enable` | number | 0 |
| others | see the `$O` set-value form code (`Scada.setValueForm`) | |

`address` is the `"net/app/group"` string (local network = `0`).

### Creating an object or changing its keywords (through the UI form)

```js
$O.showForm(existingId)   // edit; or $O.showForm() for new
const tc = $O.tagCombos;  // net / app / grp combos, valueField: net=tagid, app=id, grp=id
// select: c.setValue(v); c.fireEvent('select', c, record, index)
$O.form.findField('tags').setValue('KEYWORD1, KEYWORD2');
$O.submitForm();
```

- A new object's group appears in `tc.grp` only if it is in the tag map.
- Wait about 0.6 s after each select, because the next combo's list reloads.

## Tag map (C-Bus names)

| Action | Body | Notes |
|---|---|---|
| `cbustagmap/main` | empty | `[{id, seq, tag, tagid, tagtype:'N'/'A'/'G'/'S'/'L', net, app, grp}]`. For a group: `tagtype:'G'`, `net`, `app`, `tagid` = group number |
| `cbustagmap/save` | `data={"tagtype":"G","net":"253","app":"56","objectType":"","tagid":"152","tag":"NAME","id":"0"}` | `id:"0"` creates a new entry; the existing `id` renames it. **The name must be unique**, otherwise `success:false` |
| `cbustagmap/delete` | (not used here) | |

## Scripting

| Action | Body | Notes |
|---|---|---|
| `scripting/main` | `start=0&limit=300` | `[{id, name, type:'event'/'resident'/'scheduled'/'user', active:0/1, params, category, description}]`. `params` holds the event keyword, the resident sleep (s), or the scheduled cron |
| `scripting/form` | `id=<id>` | `{data:{script, active, name, params, subparams, category, description, type, ...}}` |
| `scripting/save` | `data={name, params, active:0, subparams:0, category, type, description}` | **No id** creates a new script with an empty source. Don't use it to change source; use the editor |
| `scripting/status` | `data={"id":<id>}` | **Toggles** `active` |
| `scripting/delete` | `data={"id":<id>}` | Permanent. Only for scripts you created as temporary |
| `scripting/run` | `data={"id":<id>}` | Non-event scripts only; returns `success:false` for event scripts |

### Uploading script source (editor page)

```js
// open https://<ip>/scada-main/main/editor?id=<id> in the tab, then:
for (let i=0;i<30 && !(window.$S&&window.$CM&&window.$E&&$S.data);i++) await new Promise(r=>setTimeout(r,300));
if ($S.data.id != ID || $S.data.name != NAME) throw 'wrong script';
// optional: check sha256($CM.getValue()) equals the expected old source
$CM.setValue(SRC); $E.changed = true; $E.submitForm();
// then read back with scripting/form and compare sha256 with the local file
```

## Logs

| Action | Body | Returns |
|---|---|---|
| `logs/main` | `start=0&limit=N` | `{data:[{id, log, logtime, scriptname}]}`, newest first. Lua `log("x")` appears as `* string: x` |
| `errorlog/main` | `start=0&limit=N` | `{data:[{id, errortext, errortime, scriptname}]}` |

## Multi-network installations

C-Bus networks joined by 5500NB bridges with "Application Connect" (all applications) and the controller on a backbone network behave as follows.

**On the bus:**
- A telegram from a branch network reaches the backbone in one hop.
- A telegram from the backbone reaches every branch.

**In the controller:** one received telegram updates **every** object with that application and group number on **all** networks, and event scripts on those objects run. A forum moderator reports the same on the 5500NAC. On this firmware it also happens for the controller's own `setvalue` writes.

**Consequences:**
- Give every button or trigger group that a controller script listens on a number that **no other network uses for the same application**.
- Trigger Control (202) numbers are often already unique house-wide. Lighting (56) numbers usually are not.
- To audit: list every network's groups (Toolkit project or the tag map). Then, for each script trigger, look for the same application and group on any other network.
- To test a clash: `setvalue` the other network's group to 255 and check the script's log shows nothing.

Sources: 5500NB instructions; C-Bus Forums threads on bridge message pass-through and on a 5500NAC with multiple bridges.
