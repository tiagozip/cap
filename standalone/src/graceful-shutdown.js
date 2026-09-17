import { status, t } from "elysia";

export const pluginGracefulShutdown = () => {
  const config = {
    livenessEndpoint: "/livez",
    readinessEndpoint: "/readyz",
    serverIsReady: true,
    stopSignalCounter: 0,
    signals: ["SIGINT", "SIGTERM"],
    gracefulShutdownTimeout: Number(
      process.env.GRACEFUL_SHUTDOWN_TIMEOUT || 30,
    ),
  };

  /**
   * @param {import("elysia").Elysia} app
   */
  return (app) => {
    for (const signal of config.signals) {
      process.on(signal, async () => {
        if (config.stopSignalCounter > 0) {
          console.log(`Received ${signal}. force shutdown now...`);
          process.exit(1);
        }
        config.stopSignalCounter += 1;

        console.log(`Received ${signal}. Initiating graceful shutdown...`);

        try {
          setTimeout(() => {
            console.log("Elysia server stop timeout, force shutdown now...");
            process.exit(1);
          }, config.gracefulShutdownTimeout * 1000);

          config.serverIsReady = false;

          await app.stop();
          console.log("Elysia server stopped.");

          console.log("Shutdown complete. Exiting.");
          process.exit(0);
        } catch (error) {
          console.error("Error during shutdown", error);
          process.exit(1);
        }
      });
    }

    app
      .state("startedSince", Date.now())
      .get(
        config.readinessEndpoint,
        () => {
          if (config.serverIsReady) {
            return {
              status: "ready",
            };
          }

          return status(500);
        },
        {
          detail: {
            tags: ["Health"],
            description: "Readiness check",
          },
          response: {
            500: t.Any(),
            200: t.Object({
              status: t.String(),
            }),
          },
        },
      )
      .get(
        config.livenessEndpoint,
        ({ store: { startedSince } }) => {
          return {
            uptime: Math.round((Date.now() - startedSince) / 1000),
          };
        },
        {
          detail: {
            tags: ["Health"],
            description: "Liveness check",
          },
          response: {
            200: t.Object({
              uptime: t.Number(),
            }),
          },
        },
      );

    return app;
  };
};
