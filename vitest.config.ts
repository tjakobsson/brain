import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    // `.claude/**` holds agent worktrees, which are complete checkouts with
    // their own test files.
    exclude: [...configDefaults.exclude, ".generated/**", ".claude/**"],
  },
});
