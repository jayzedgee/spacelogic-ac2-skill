# spacelogic-ac2: an agent skill for the C-Bus Application Controller

A Claude Code / Agent Skills package for operating a Schneider Electric / Clipsal **SpaceLogic C-Bus Application Controller** (5500AC2; probably also 5500NAC2 and 5500SHAC) through its web interface, from a browser tab the user is already logged in to.

- `SKILL.md`: when and how to use it, safety rules, and quirks.
- `reference.md`: the web UI's endpoints with request and response shapes, and multi-network behaviour.
- `lua-notes.md`: controller Lua pitfalls.
- `ac2.js`: helper functions to evaluate in the controller tab (`window.AC2`).

**Status:**
- Worked out by reading the controller's own web UI code on firmware 2.3.0, and used on a live installation.
- **Unofficial.** It is not affiliated with or endorsed by Schneider Electric.
- Endpoints may change between firmware versions; verify on yours.
- It writes to a live building-control system, so follow the safety rules in `SKILL.md`.

**Install** (Claude Code): clone into your project's or your user skills folder, for example

```
git clone https://github.com/jayzedgee/spacelogic-ac2-skill .claude/skills/spacelogic-ac2
```

Licence: MIT (see `LICENSE`).

Contributions welcome, especially confirmations for other firmware versions and controller models.
