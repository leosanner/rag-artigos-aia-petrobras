import type { HealthCheck } from "../check-health";

export const appCheck: HealthCheck = {
  name: "app",
  run: async () => {},
};
