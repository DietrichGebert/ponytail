# Crewcut for Hermes installed

Enable it if you did not install with `--enable`:

```bash
hermes plugins enable crewcut
```

Restart Hermes or the gateway after enabling.

In shared gateways, restrict `/crewcut` to trusted users with Hermes slash-command access controls; runtime mode is process-local.

Commands:

- `/crewcut [lite|full|ultra|off]`
- `/crewcut-review [target]`
- `/crewcut-audit [target]`
- `/crewcut-debt`
- `/crewcut-gain`
- `/crewcut-help`

Bundled skills are available as `crewcut:crewcut`, `crewcut:crewcut-review`, `crewcut:crewcut-audit`, `crewcut:crewcut-debt`, `crewcut:crewcut-gain`, and `crewcut:crewcut-help`.
