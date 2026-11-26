import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  functions: {
    api: {
      name: "Riuso API",
      source: "./api/index.ts",
    },
  },
  buckets: {
    // Le foto degli annunci sono pubbliche in lettura: l'URL è stabile e
    // mettibile in cache. Le scritture passano da URL presigned firmati.
    "item-photos": { access: "public_read" },
  },
  branch: (branch) => {
    if (branch.isDefault) {
      return {};
    }
    if (!branch.exists) {
      return { ttl: "7d" };
    }
    return {};
  },
});
