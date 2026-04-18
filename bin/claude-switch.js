#!/usr/bin/env node
'use strict';

const { runCli } = require('../src/router');

(async () => {
  const exitCode = await runCli(process.argv.slice(2), {
    currentScriptPath: __filename,
  });

  process.exit(exitCode);
})().catch((err) => {
  console.error(`[claude-switch] ERROR: ${err && err.message ? err.message : String(err)}`);
  process.exit(1);
});
