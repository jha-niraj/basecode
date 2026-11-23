import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// Incremental cache in R2 (binding NEXT_INC_CACHE_R2_BUCKET). Without one, `unstable_cache` and cached `fetch`
// silently recompute on every request on Workers. Kept MINIMAL on purpose: no enableCacheInterception, no regional
// cache, no DO tag cache - those caused intermittent production 500s in an earlier project.
export default defineCloudflareConfig({
    incrementalCache: r2IncrementalCache,
});
