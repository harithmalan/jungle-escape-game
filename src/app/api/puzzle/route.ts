import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://marcconrad.com/uob/heart/api.php?out=json', {
      cache: 'no-store',
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch puzzle' }, { status: 500 });
  }
}