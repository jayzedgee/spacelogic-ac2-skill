# AC2 Lua notes

**`grp.getvalue` returns two values.** Always wrap it: `tonumber((grp.getvalue(addr)))`. Without the extra parentheses, `tonumber(a, b)` treats the second value as a base and the script fails with "bad argument #2 to 'tonumber'".

**Event scripts fire on every telegram**, including repeats of the same value and writes made by scripts. Test the value (for example, act only when it is non-zero) and the destination (`event.dst`) yourself.

**Event scripts can also fire for other networks.** In multi-network installations, an event script keyed on a keyword can fire for a same-numbered group on another network (see `reference.md`). Key scripts only on groups whose numbers are unique.

**Pulsing a relay.** To pulse a relay group: write 255, `os.sleep(n)`, write 0. For more than a few seconds, use a resident script or queue so event scripts don't block.

**`log("text")` and `storage`.**
- `log("text")` appears in the Logs tab as `* string: text`.
- Use `storage.get(key, default)` / `storage.set(key, value)` for state that must survive between runs.

**Libraries.** User libraries load with `require('user.<name>')`.

**Address strings.**
- Use `"net/app/group"`, with the local network as `0`.
- `SetCBusLevel(netName, appName, groupName, level, ramp)` uses **tag map names**, so renaming a tag breaks such calls. Prefer address strings with `grp.write`.

**Serial ports.** `require('serial')`, then `serial.open('/dev/RS232', {baudrate=..., databits=..., parity=..., stopbits=..., duplex='full'})`.
- `port:read(n, timeout)` returns whatever arrived.
- Don't assume each read is one complete line.
- Don't reopen the port inside a busy loop. A close/sleep/open cycle was seen to hang a resident script.

**Testing script logic safely.** Create a temporary resident script, disabled, with the test code and `log()` output. Enable it, wait a few seconds, disable it, and read the log. Delete it afterwards (with the user's OK).
