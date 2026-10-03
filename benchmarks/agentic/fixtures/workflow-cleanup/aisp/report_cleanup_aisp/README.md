# Report Cleanup Fixture

Generated projection of `aisp.aisop.json`: the `report_script` resource is
`report.py`, invoked by the reachable `run_report` node. The prepared environment
uses this package directory as the working directory and supplies Python 3.

CLI contract for `report.py`:

| Input | Exit | stdout | stderr |
| --- | --- | --- | --- |
| Base-10 integers | 0 | One JSON object with exactly integer `count` and `total` fields | Empty |
| No arguments | 0 | `{"count": 0, "total": 0}` | Empty |
| Any invalid integer | 2 | Empty | Nonempty diagnostic |

For `2 5 7`, stdout represents `{"count": 3, "total": 14}`. JSON spacing and
key order are immaterial. `legacy_report.py` is retired; it has no consumer.
