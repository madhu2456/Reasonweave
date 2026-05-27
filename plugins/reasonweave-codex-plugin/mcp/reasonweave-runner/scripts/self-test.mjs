#!/usr/bin/env node
import { selfTest } from "../lib/tools.mjs";

const result = selfTest();
process.stdout.write(`${JSON.stringify(result.structuredContent, null, 2)}\n`);
process.exit(result.isError ? 1 : 0);
