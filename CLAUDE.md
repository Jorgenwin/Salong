# CLAUDE.md

Følg alltid `AGENTS.md` først. Den er felles instruks for Claude, Codex og andre kodeagenter i Salong-repoet.

## Claude-spesifikt

Salong startet som en Claude Artifact, men GitHub-repoet er nå kildekilden. Ikke behandle Artifact-versjonen som mer autoritativ enn `main`.

Når du arbeider med Artifact-kompatibilitet:

- Bevar `dist/salong.html` som build-output; ikke håndrediger den.
- Gjør kildeendringer i `src/` og bygg med `npm run build`.
- Skill tydelig mellom Claude-connectorer som fungerer inne i Artifact-miljøet og funksjonalitet som faktisk fungerer i en selvstendig webapp.
- Ikke presenter connector-tilgang som en backend.
- Ikke introduser nye `rep()`-patcher i `src/build.py` hvis samme endring kan gjøres ryddig i kildefilene.

Før du foreslår merge, kjør testene og oppgi resultatet eksplisitt.
