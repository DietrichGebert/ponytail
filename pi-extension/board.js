// A second entry: pi's loader transforms the band's TypeScript only for an entry that imports it statically.
import { boardHtml, parseCsv, tasksFrom } from "../hooks/band/board.ts";
import { isTestCommand, stamp, taskKey, testCounts, testsLabel, upsertCsv } from "../hooks/band/metrics.ts";
import { registerBoard } from "./ledger.js";

export default (pi) => registerBoard(pi, { boardHtml, parseCsv, tasksFrom, isTestCommand, stamp, taskKey, testCounts, testsLabel, upsertCsv });
