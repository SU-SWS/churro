import { NextRequest, NextResponse } from 'next/server';
import { clearAllCache } from '@/lib/cache';

export async function DELETE(request: NextRequest) {
  try {
    await clearAllCache();
    return NextResponse.json({
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Cache management API',
    endpoints: {
      'DELETE /api/cache': 'Clear all cached data'
    }
  });
}