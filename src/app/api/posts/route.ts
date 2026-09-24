import { NextRequest, NextResponse } from 'next/server';
import { getPosts, updatePostStatus } from '@/lib/supabase';
import type { Post } from '@/types/post';

export const dynamic = 'force-dynamic';

export async function GET() {
  const posts = await getPosts();
  return NextResponse.json(posts);
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json() as { id: string; status: Post['status'] };
  await updatePostStatus(id, status);
  return NextResponse.json({ ok: true });
}
