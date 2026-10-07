// Batch API settings (ADR 033). Writes from the apps are domain change sets sent as one
// POST /api/batch: PocketBase runs it in one transaction, so it commits or rolls back whole.
// 500 requests fit the largest change set (a project's whole subtree with its allocations).
// `timeout` is in seconds. Ids are widened per collection, in the migration that creates it.
migrate(
  (app) => {
    const settings = app.settings();
    settings.batch.enabled = true;
    settings.batch.maxRequests = 500;
    settings.batch.timeout = 10;
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.batch.enabled = false;
    app.save(settings);
  },
);
