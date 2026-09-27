import { test } from "node:test";
import assert from "node:assert/strict";
import { startWatchdogScheduler } from "../src/services/watchdogScheduler.js";

for (const setting of ["", "true", "false", " FALSE "]) {
  test(`automatic watchdog with setting ${JSON.stringify(setting)}`, (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    const calls: string[] = [];
    const stop = startWatchdogScheduler(async (context) => { calls.push(context); }, setting);
    const enabled = setting.trim().toLowerCase() !== "false";
    t.mock.timers.tick(29_999);
    assert.deepEqual(calls, []);
    t.mock.timers.tick(1);
    assert.deepEqual(calls, enabled ? ["Startup"] : []);
    t.mock.timers.tick(570_000);
    assert.deepEqual(calls, enabled ? ["Startup", "Background"] : []);
    stop();
    t.mock.timers.tick(600_000);
    assert.equal(calls.length, enabled ? 2 : 0);
  });
}

test("missing variable preserves staging startup; shutdown cancels pending runs", (t) => {
  const previous = process.env.MEDIA_WATCHDOG_ENABLED;
  delete process.env.MEDIA_WATCHDOG_ENABLED;
  t.after(() => {
    if (previous === undefined) delete process.env.MEDIA_WATCHDOG_ENABLED;
    else process.env.MEDIA_WATCHDOG_ENABLED = previous;
  });
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const calls: string[] = [];
  const run = async (context: string) => { calls.push(context); };
  const stop = startWatchdogScheduler(run);
  t.mock.timers.tick(30_000);
  assert.deepEqual(calls, ["Startup"]);
  stop();
  const stopBeforeStartup = startWatchdogScheduler(run);
  stopBeforeStartup();
  t.mock.timers.tick(600_000);
  assert.deepEqual(calls, ["Startup"]);
});
