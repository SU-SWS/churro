import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const { tags } = await request.json();

    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: 'tags must be an array' }, { status: 400 });
    }

    // Revalidate specified cache tags
    for (const tag of tags) {
      revalidateTag(tag);
    }

    return NextResponse.json({
      message: `Revalidated tags: ${tags.join(', ')}`,
      revalidated: true,
      now: Date.now()
    });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json({ error: 'Failed to revalidate' }, { status: 500 });
  }
}