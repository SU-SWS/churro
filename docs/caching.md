# Caching System Documentation

This application implements a hybrid caching system that provides fast data retrieval while maintaining data freshness across different environments.

## Overview

The caching system uses different strategies based on the deployment environment:

- **Local Development**: File-based cache stored in `.cache/` directory
- **Production (Vercel)**: Persistent cache using Next.js `unstable_cache` with cache-busting for invalidation

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
- Cache keys include a cache-buster timestamp for invalidation
- Data persists across deployments and function restarts

### Cache Behavior
- **Cache Generation**: Shared across all Vercel instances
- **Cache Persistence**: Survives deployments and scaling events
- **Cache Invalidation**: Uses cache-busting technique (updates timestamp in cache keys)

### Cache Key Format
```
endpoint_hash_timestamp
// Example: views_a1b2c3d4_1728854400000
```

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
- ✅ **Survives deployments** (cache persists across releases)
- ✅ **Cache invalidation** (cache-busting technique)
- ⚠️ **Instance-specific invalidation** (cache clearing doesn't propagate across all instances immediately)

## Cache Duration

All cached data has a **6-hour TTL (21,600 seconds)**:

```typescript
{
  revalidate: 6 * 60 * 60, // 6 hours
  tags: ['acquia-api', ...tags]
}
```

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
☁️ Using unstable_cache for Vercel: views_abc123_1728854400000
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

### Cache Not Working
1. Check environment detection in console logs
2. Verify cache key generation is consistent
3. Ensure API responses are cacheable (no errors)

### Cache Not Clearing
1. Check console for cache clearing logs
2. Verify environment detection is correct
3. For Vercel: Check if cache-buster timestamp is updating

### Performance Issues
1. Monitor cache hit/miss ratios in console
2. Check if cache keys are too specific (preventing hits)
3. Verify TTL settings are appropriate for your use case

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

1. **6 hours is appropriate** for most Acquia analytics data (data doesn't change frequently)
2. **Consider shorter TTL** for more dynamic data
3. **Manual clearing available** for immediate updates when needed

## Future Improvements

Potential enhancements for the caching system:

1. **Cross-instance invalidation** - Use external storage (Redis, database) for cache-buster timestamps
2. **Selective cache clearing** - Clear specific cache keys instead of all data
3. **Cache warming** - Pre-populate cache for common queries
4. **Cache analytics** - Track hit/miss ratios and performance metrics
5. **Configurable TTL** - Allow different cache durations per endpoint