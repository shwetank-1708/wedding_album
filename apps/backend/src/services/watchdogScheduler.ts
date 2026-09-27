// Only an explicit false disables automatic runs; existing deployments stay enabled.
export function startWatchdogScheduler(
  run: (context: string) => Promise<void>,
  setting = process.env.MEDIA_WATCHDOG_ENABLED,
): () => void {
  if (setting?.trim().toLowerCase() === "false") {
    console.log("[WatchdogRunner] Automatic watchdog disabled (MEDIA_WATCHDOG_ENABLED=false)");
    return () => {};
  }

  console.log("[WatchdogRunner] Automatic watchdog enabled");
  const interval = setInterval(() => {
    run("Background").catch(() => {});
  }, 10 * 60 * 1000);
  const startup = setTimeout(() => {
    run("Startup").catch(() => {});
  }, 30 * 1000);

  return () => {
    clearInterval(interval);
    clearTimeout(startup);
  };
}
