# Ponytail for Hermes installed

Enable it if you did not install with `--enable`:

```bash
hermes plugins enable ponytail
```

Restart Hermes or the gateway after enabling.

In shared gateways, restrict `/ponytail` to trusted users with Hermes slash-command access controls; runtime mode is process-local.

Commands:

- `/ponytail [lite|full|ultra|off]`
- `/ponytail-review [target]`
- `/ponytail-audit [target]`
- `/ponytail-debt`
- `/ponytail-gain`
- `/ponytail-help`

Bundled skills are available as `ponytail:ponytail`, `ponytail:ponytail-review`, `ponytail:ponytail-audit`, `ponytail:ponytail-debt`, `ponytail:ponytail-gain`, and `ponytail:ponytail-help`.
