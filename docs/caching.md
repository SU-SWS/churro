# Caching System Documentation

This application implements a hybrid caching system that provides fast data retrieval while maintaining data freshness across different environments.

## Overview

The caching system uses different strategies based on the deployment environment:

- **Local Development**: File-based cache stored in `.cache/` directory with 2-minute TTL
- **Production (Vercel)**: Persistent cache using Next.js `unstable_cache` with:
  - **Application-layer timestamp validation** (2-minute TTL)
  - **Deployment-based cache versioning** (auto-invalidates on new deployments)
  - **Manual cache-busting** (via "Clear Cache" button)

## Architecture

### Core Components

1. **`lib/cache-hybrid.ts`** - Main caching logic with environment detection
2. **`lib/cache.ts`** - File-based cache implementation for local development
3. **`app/api/cache/route.ts`** - Cache management API endpoint
4. **Cache clearing UI** - "Clear Cache" buttons in Dashboard and application detail pages

### Environment Detection

The system automatically detects the environment using:

```typescript
const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV;
const isVercel = !!process.env.VERCEL_ENV;
```

## Local Development Caching

### How It Works
- Uses file-based cache stored in `.cache/` directory
- Cache files are named using MD5 hashes of cache keys
- Data is stored as JSON files with timestamps

### Cache Structure
```
.cache/
├── views_abc123.json
├── visits_def456.json
└── applications_ghi789.json
```

### Cache Clearing
- **Manual**: Click "Clear Cache" button (empties entire `.cache/` directory)
- **Automatic**: Cache files respect TTL and are regenerated as needed

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