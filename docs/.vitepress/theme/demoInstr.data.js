import { generateInstrumentation } from "../../../core/src/instrumentation.js";

const build = async (opts) => {
  const { instrumentation, ...meta } = await generateInstrumentation({
    blockAutomatedBrowsers: true,
    blockAutomatedInteractions: true,
    ttlMs: 3650 * 86_400_000,
    ...opts,
  });
  return { instrumentation, meta };
};

export default {
  async load() {
    return {
      demo: await build({ behavior: true, behaviorEnforced: true }),
      check: await build({}),
    };
  },
};
