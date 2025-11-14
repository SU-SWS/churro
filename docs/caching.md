# Caching Implementation Documentation

This document describes the hybrid caching system implemented for the Acquia Analytics Dashboard.

## Overview

The caching system uses two different approaches based on the environment:

- **Local Development**: File-based caching using JSON files
- **Vercel Production**: Next.js `unstable_cache` with application-layer timestamp validation

The system provides:
- **5-minute cache duration** for expensive API calls
- **Automatic cache invalidation** on application deployment
- **Manual cache clearing** via API endpoint
- **Browser cache prevention** to ensure server-side cache control

## Cache Architecture

### Server-Side Caching Strategy

The implementation uses a **three-layer cache invalidation** approach:

1. **Deployment-based versioning**: Cache keys include deployment ID, automatically invalidating cache on new deployments
2. **Application-layer timestamp validation**: Cached data includes timestamps that are validated on every request
3. **Manual cache-busting**: User-triggered cache invalidation updates cache keys immediately

### Browser Cache Prevention

**Critical**: The system completely disables browser caching to ensure all cache control happens server-side:

- API responses include: `Cache-Control: no-store, no-cache, must-revalidate`
- Client requests include unique timestamp parameter (`t=Date.now()`) on every request
- Fetch options use `cache: 'reload'` to force network requests
- Server ignores timestamp parameter for cache key generation

**Result**: Browser always makes network request (unique URL), but server-side cache still works efficiently.

## Implementation Files

### 1. `lib/cache-hybrid.ts`

Main caching interface with environment detection and timestamp validation.

**Key Functions:**
- `getCachedApiData<T>(apiCall, cacheKey, tags)` - Main caching wrapper with timestamp validation
- `generateApiCacheKey(endpoint, params)` - Consistent cache key generation
- `invalidateCache(tags?)` - Manual cache clearing
- `getCacheVersion()` - Returns deployment ID for cache versioning
- `isCacheDataValid()` - Validates cached data age

### 2. `lib/cache.ts`

File-based caching for local development (unchanged).

### 3. API Routes

All Acquia API routes include browser cache prevention headers:

```typescript
response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
response.headers.set('Pragma', 'no-cache');
response.headers.set('Expires', '0');
```

## Cache Behavior by Environment

### Local Development

- **Storage**: JSON files in `.cache/` directory (gitignored)
- **Duration**: 5 minutes
- **Invalidation**: File deletion or manual clear
- **Key advantage**: Persists across server restarts

### Vercel Production

- **Storage**: Next.js `unstable_cache` with deployment versioning
- **Duration**: 5 minutes (application-layer validation)
- **Cache keys**: Include deployment ID (`VERCEL_DEPLOYMENT_ID`)
- **Invalidation**: Automatic on deploy + timestamp validation + manual busting
- **Note**: `revalidate` parameter removed as it's unreliable on Vercel

## Cache Duration

All cached data has a **5-minute lifespan**:

```typescript
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

This duration was chosen because:
- Balances performance with data freshness expectations
- Reduces load on Acquia API while allowing reasonable update frequency
- Matches user expectations for analytics data refresh

## Cache Validation Process

### Data Storage Format

Cached data is wrapped with metadata:

```typescript
{
  data: actualApiResponse,
  cachedAt: "2025-11-15T10:30:00.000Z", // Timestamp when cached
  cacheKey: "visits_abc123_vdpl_def456_1731668400000" // Versioned cache key
}
```

### Validation on Every Request

```typescript
const age = Date.now() - new Date(cachedResult.cachedAt).getTime();
if (age >= CACHE_TTL_MS) {
  // Cache expired - bust cache and refetch
  await updateCacheBuster();
  return getCachedApiData(apiCall, cacheKey, tags); // Recursive call with new cache key
}
```

**Effect**: Cache reliably expires after 5 minutes regardless of Next.js behavior.

## Cache Key Generation

### Versioned Cache Keys

Cache keys now include deployment version and cache-buster timestamp:

```
Format: {endpoint}_{hash}_v{deploymentId}_{cacheBuster}
Example: visits_a1b2c3d4_vdpl_abc123_1731668400000
```

### Key Components

```typescript
const keyComponents = [
  endpoint,                          // 'visits' or 'views'
  sortedParams.subscriptionUuid,     // Subscription identifier
  sortedParams.from,                 // Date range start
  sortedParams.to,                   // Date range end
  sortedParams.resolution            // Time resolution
  // Note: 't' timestamp parameter is excluded
];
```

**Key characteristics:**
- Deterministic: Same API parameters always generate same base key
- Versioned: Deployment changes automatically invalidate cache
- Cache-buster aware: Manual invalidation changes all keys immediately

## Race Condition Behavior

### Concurrent Requests to Same Data

**Scenario**: Two browsers request the same data simultaneously before either completes.

**Timeline Example**:
```
10:00:00 Browser A: Starts API call for visits (11/1 to 11/10)
10:00:30 Browser B: Starts API call for visits (11/1 to 11/10)
10:00:50 Browser A: Completes, stores result in cache
10:01:20 Browser B: Completes, overwrites cache with its result
```

**Result**: Browser B's data "wins" and is stored in cache (last-write-wins).

**Impact**:
- Both browsers make expensive API calls (no request deduplication)
- Cache contains data from whichever request finished last
- Since underlying data is identical, the "wrong" result doesn't affect users
- For this application's usage patterns, this is acceptable

**Note**: Next.js `unstable_cache` doesn't prevent duplicate concurrent requests to the same cache key.

## Manual Cache Invalidation

### API Endpoint: `DELETE /api/cache`

Clears all cached data immediately by updating the cache-buster timestamp:

```bash
curl -X DELETE https://your-app.vercel.app/api/cache
```

**Response:**
```json
{
  "success": true,
  "environment": "vercel",
  "method": "cache-buster",
  "cacheBusterTimestamp": 1731668500000
}
```

### Cross-Browser Cache Clearing

The "Clear Cache" button works across all browsers because:
- Updates server-side cache-buster timestamp
- All subsequent requests use new cache keys
- No browser-specific state involved

## Console Logging

The caching system provides detailed console logs:

### Cache Hit (Valid):
```
☁️ Using unstable_cache for Vercel: visits_abc123_vdpl_def456_1731668400000
✅ Cache data valid, age: 45s
```

### Cache Miss (Expired):
```
☁️ Using unstable_cache for Vercel: visits_abc123_vdpl_def456_1731668400000
⏰ Cache expired: age=350s, ttl=300s
🔄 Cache buster updated: 1731668500000
☁️ Using unstable_cache for Vercel: visits_abc123_vdpl_def456_1731668500000
🔥 unstable_cache MISS - executing API call
```

### Deployment Invalidation:
```
📦 Cache version (deployment): dpl_new789  // Changed from dpl_old456
🔥 unstable_cache MISS - executing API call  // Automatic cache miss
```

## Browser Cache Prevention Details

### Why Browser Caching Was Problematic

Original issue:
- API routes were sending `Cache-Control: max-age=21600` (6 hours)
- Browsers cached responses and never contacted server
- Server-side cache validation never ran
- Even `no-store` headers didn't reliably prevent caching

### Solution: Unique URLs + Strong Headers

**Client-side** (Dashboard.tsx):
```typescript
const params = new URLSearchParams({
  subscriptionUuid,
  from: dateFrom,
  to: dateTo,
  t: Date.now().toString()  // Unique on every request
});

fetch(`/api/acquia/visits?${params}`, {
  cache: 'reload',  // Force network request
  headers: { 'Cache-Control': 'no-cache' }
});
```

**Server-side** (API routes):
```typescript
// Ignore 't' parameter for cache key
const cacheKey = generateApiCacheKey('visits', {
  subscriptionUuid, from, to, resolution
  // 't' is NOT included
});

// Prevent browser caching
response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
```

**Result**: Every request has unique URL (browser can't cache), but server cache key is the same (cache still works).

## Performance Characteristics

### Cache Hit Performance
- **Local**: ~1-5ms (file read + timestamp validation)
- **Vercel**: ~1-10ms (in-memory access + timestamp validation)

### Cache Miss Performance
- Same as underlying API call (~60-120 seconds)
- Cache storage is async and non-blocking
- Timestamp validation overhead: < 1ms

## Troubleshooting

### "Cache not expiring after 5 minutes"

1. Check console for timestamp validation logs:
   ```
   ⏰ Cache expired: age=350s, ttl=300s
   🔄 Cache buster updated: [timestamp]
   ```

2. Verify browser is making network requests (check Network tab for unique `t=` parameter)

3. Check deployment ID hasn't changed unexpectedly

### "Stale data after deployment"

1. Verify `VERCEL_DEPLOYMENT_ID` changed:
   ```
   📦 Cache version (deployment): [new-id]
   ```

2. Check console for automatic cache miss on new deployment

### "Cache clearing doesn't work"

1. Verify API response indicates success:
   ```json
   {"success": true, "method": "cache-buster"}
   ```

2. Check subsequent requests use new cache-buster timestamp

3. Ensure browser isn't caching the `/api/cache` response itself

## Configuration

### Adjusting Cache Duration

Edit `CACHE_TTL_MS` in `lib/cache-hybrid.ts`:

```typescript
// Current: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

// For 2 minutes:
const CACHE_TTL_MS = 2 * 60 * 1000;

// For 10 minutes:
const CACHE_TTL_MS = 10 * 60 * 1000;
```

## Environment Variables

- `VERCEL_DEPLOYMENT_ID` (automatic) - Primary deployment identifier
- `VERCEL_GIT_COMMIT_SHA` (automatic) - Fallback deployment identifier
- `NODE_ENV` - Environment detection
- `VERCEL_ENV` - Vercel environment detection

No additional configuration required.

## Security Considerations

1. **Cache directory**: `.cache/` is gitignored
2. **Cache keys**: MD5 hashing prevents directory traversal
3. **Browser cache prevention**: Eliminates client-side cache security concerns
4. **Manual clearing**: No authentication required (internal use)
5. **Deployment versioning**: Automatic cache invalidation on code changes

## Production (Vercel) Caching

### How It Works
- Uses Next.js `unstable_cache` for persistence across serverless function instances
- **Three-layer cache invalidation strategy**:
  1. **Deployment versioning**: Cache keys include `VERCEL_DEPLOYMENT_ID` - automatically invalidates on deploy
  2. **Application-layer TTL**: Validates cached data timestamp (2 minutes) regardless of Next.js cache
  3. **Manual cache-busting**: Updates timestamp in cache keys when user clicks "Clear Cache"
- Cached data includes timestamp for application-layer validation
- **Removes `revalidate` parameter** - Next.js `revalidate` doesn't work reliably on Vercel

### Cache Behavior
- **Cache Generation**: Shared across all Vercel instances
- **Cache Persistence**: Data may persist in Next.js cache, but application validates age
- **Cache Invalidation**:
  - Automatic: New deployments use different cache keys (`VERCEL_DEPLOYMENT_ID` changes)
  - Time-based: Application checks `cachedAt` timestamp and refetches if > 2 minutes old
  - Manual: "Clear Cache" button updates cache-buster timestamp

### Cache Key Format
```
endpoint_hash_vDEPLOYMENT_ID_timestamp
// Example: views_a1b2c3d4_vdpl_abc123_1728854400000
```

**Key Components**:
- `endpoint_hash`: Base cache key from request parameters
- `vDEPLOYMENT_ID`: Vercel deployment ID (changes with each deploy)
- `timestamp`: Cache-buster timestamp (updated on manual invalidation)

## API Routes with Caching

All Acquia API routes use the hybrid caching system:

- **`/api/acquia/views`** - Views data with 6-hour cache
- **`/api/acquia/visits`** - Visits data with 6-hour cache
- **`/api/acquia/applications`** - Application data with 6-hour cache

### Cache Key Generation

Cache keys are generated from all request parameters:

```typescript
const cacheKey = generateApiCacheKey('views', {
  subscriptionUuid: 'abc-123',
  from: '2025-01-01',
  to: '2025-01-31',
  resolution: 'day'
});
// Result: views_a1b2c3d4
```

## Manual Cache Management

### Cache Clearing UI

Both the Dashboard and application detail pages include "Clear Cache" buttons that:

1. Clear browser caches using the Cache API
2. Call `/api/cache` DELETE endpoint to clear server cache
3. Display success/failure feedback with environment information

### Cache Management API

**`GET /api/cache`** - Get cache system information
```json
{
  "message": "Cache management API",
  "environment": "Local (file cache)" | "Vercel (cache-buster)",
  "endpoints": {
    "DELETE /api/cache": "Clear/invalidate all cached data"
  }
}
```

**`DELETE /api/cache`** - Clear all cached data
```json
{
  "message": "Cache cleared successfully",
  "environment": "local" | "vercel",
  "method": "file-clear" | "cache-buster",
  "timestamp": "2025-10-10T21:52:35.743Z"
}
```

## Cache Behavior Characteristics

### Local Development
- ✅ **Fast subsequent requests** (file system cache)
- ✅ **Complete cache clearing** (removes all files)
- ✅ **Immediate invalidation** (files deleted instantly)
- ⚠️ **Single instance only** (not shared across processes)

### Production (Vercel)
- ✅ **Fast subsequent requests** (persistent cache layer)
- ✅ **Cross-instance persistence** (shared across all serverless functions)
- ✅ **Automatic deployment invalidation** (new `VERCEL_DEPLOYMENT_ID` = new cache keys)
- ✅ **Consistent TTL behavior** (application validates timestamps)
- ✅ **Manual cache clearing** (cache-busting updates timestamp)
- ⚠️ **Old cache may persist in Next.js layer** (but app won't use it if expired)

## Cache Duration

All cached data has a **2-minute TTL**:

```typescript
// Validated at application layer, not relying on Next.js revalidate
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes in milliseconds

// Cached data includes timestamp
{
  data: result,
  cachedAt: new Date().toISOString(),
  cacheKey: versionedCacheKey
}

// Age validation on every request
if (!isCacheDataValid(cachedResult.cachedAt)) {
  // Refetch if older than 2 minutes
  await updateCacheBuster();
  return getCachedApiData(apiCall, cacheKey, tags);
}
```

**Why application-layer validation?**
- Next.js `revalidate` parameter doesn't work reliably on Vercel
- Testing showed cached data persisting for 2+ hours despite `revalidate: 120`
- Application-layer timestamp checks ensure consistent 2-minute TTL behavior

## Debugging and Monitoring

### Debug Information

In development mode, pages show debug information including:

- Cache key components
- Request parameters
- Cache hit/miss status
- Environment detection results

### Console Logging

The caching system provides detailed console logging:

```
🏠 Using file cache for local development: views_abc123
🔥 File cache MISS - executing API call: views_abc123
☁️ Using unstable_cache for Vercel: views_abc123_vdpl_def456_1728854400000
📦 Cache version (deployment): dpl_def456
🔄 Cache buster: 1728854400000
⏰ Cache expired: age=150s, ttl=120s
✅ Cache data valid, age: 45s
🗑️ Cache buster updated: 1728854500000
```

### Log Prefixes
- 🏠 Local development operations
- ☁️ Vercel/production operations
- 🔥 Cache miss (fresh API call)
- 📦 Cache hit (served from cache)
- 🗑️ Cache clearing operations
- 🔍 Environment detection
- 🗝️ Cache key generation

## Troubleshooting

### Cache Not Expiring After 2 Minutes
1. **Check console logs for timestamp validation**:
   - Look for "⏰ Cache expired" or "✅ Cache data valid, age: Xs"
   - Verify age is being calculated correctly
2. **Verify deployment ID is changing**:
   - Check "📦 Cache version (deployment)" in logs
   - Should be different after each deployment
3. **Check if cache-buster is working**:
   - Look for "🔄 Cache buster" in logs
   - Should update when "Clear Cache" is clicked

### Cache Not Working
1. Check environment detection in console logs
2. Verify cache key generation is consistent
3. Ensure API responses are cacheable (no errors)
4. Check that `cachedAt` timestamp is being added to cached data

### Cache Not Clearing
1. Check console for cache clearing logs ("🗑️ Cache buster updated")
2. Verify environment detection is correct
3. For Vercel: Verify cache-buster timestamp is updating in subsequent requests
4. Check browser console for "Clear Cache" button feedback

### Performance Issues
1. Monitor cache hit/miss ratios in console ("🔥 unstable_cache MISS")
2. Check cache age in logs ("✅ Cache data valid, age: Xs")
3. Verify timestamp validation is working correctly
4. Check if deployment ID is stable (shouldn't change unless deploying)

## Best Practices

### For Developers

1. **Always test locally first** - The file cache makes debugging easier
2. **Monitor console logs** - They provide detailed caching behavior information
3. **Use cache clearing** - When testing data changes or debugging cache issues
4. **Check environment variables** - Ensure proper detection in different environments

### For Cache Key Design

1. **Include all relevant parameters** - Any parameter that affects the result should be in the cache key
2. **Normalize parameters** - Sort and handle null/undefined values consistently
3. **Use readable prefixes** - Makes debugging easier (`views_`, `visits_`, etc.)

### For Cache Duration

1. **2 minutes is appropriate** for most Acquia analytics data while keeping it relatively fresh
2. **Application-layer validation ensures consistent behavior** across all environments
3. **Deployment-based versioning** automatically invalidates stale cache on deploy
4. **Manual clearing always available** for immediate updates when needed
5. **Adjust `CACHE_TTL_MS`** in `lib/cache-hybrid.ts` if different TTL is needed

## Implementation Details

### Why This Approach?

**Problem**: Next.js `unstable_cache` with `revalidate` parameter doesn't work reliably on Vercel:
- Testing showed cached data persisting for 2+ hours despite `revalidate: 120` (2 minutes)
- Cache persisted across deployments and manual invalidation attempts
- `revalidateTag()` and `revalidatePath()` had no effect

**Solution**: Three-layer cache invalidation:

1. **Deployment Versioning** (automatic):
   - Cache keys include `VERCEL_DEPLOYMENT_ID` or `VERCEL_GIT_COMMIT_SHA`
   - Every deployment gets fresh cache keys automatically
   - Zero configuration required

2. **Application-Layer TTL** (automatic):
   ```typescript
   // Check timestamp on every request
   if (!isCacheDataValid(cachedResult.cachedAt)) {
     // Fetch fresh data if > 2 minutes old
     await updateCacheBuster();
     return getCachedApiData(apiCall, cacheKey, tags);
   }
   ```
   - Validates `cachedAt` timestamp in application code
   - Doesn't rely on Next.js cache behavior
   - Consistent 2-minute TTL guaranteed

3. **Manual Cache-Busting** (user-triggered):
   - "Clear Cache" button updates `cacheBusterTimestamp`
   - New requests use new cache keys
   - Immediate invalidation for all subsequent requests

### Advantages

- ✅ **Predictable TTL**: Application controls expiration, not Next.js
- ✅ **Automatic deployment invalidation**: No stale cache after deploys
- ✅ **Manual control**: Users can force refresh when needed
- ✅ **Cross-instance consistency**: All instances respect timestamp validation
- ✅ **Debugging**: Clear console logs show cache version, age, and validation