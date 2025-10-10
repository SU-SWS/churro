import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    allEnvVars: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      VERCEL_REGION: process.env.VERCEL_REGION,
    },
    detectionResults: {
      isVercel1: process.env.VERCEL === '1',
      isVercelEnv: !!process.env.VERCEL_ENV,
      isVercelUrl: !!process.env.VERCEL_URL,
      nodeEnvDev: process.env.NODE_ENV === 'development',
      nodeEnvProd: process.env.NODE_ENV === 'production',
    },
    recommendedDetection: {
      isVercel: process.env.VERCEL === '1' || !!process.env.VERCEL_ENV,
      isLocal: process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV
    }
  });
}