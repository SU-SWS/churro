import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const envLocalPath = path.join(process.cwd(), '.env.local');
    
    if (!fs.existsSync(envLocalPath)) {
      return NextResponse.json({
        error: '.env.local file not found',
        path: envLocalPath
      });
    }
    
    const content = fs.readFileSync(envLocalPath, 'utf8');
    const lines = content.split('\n');
    
    // Find the ACQUIA_API_KEY line
    const apiKeyLine = lines.find(line => line.trim().startsWith('ACQUIA_API_KEY'));
    const apiSecretLine = lines.find(line => line.trim().startsWith('ACQUIA_API_SECRET'));
    
    // Parse the values
    let fileApiKey = '';
    let fileApiSecret = '';
    
    if (apiKeyLine) {
      const match = apiKeyLine.match(/ACQUIA_API_KEY\s*=\s*(.+)/);
      fileApiKey = match ? match[1].trim() : '';
    }
    
    if (apiSecretLine) {
      const match = apiSecretLine.match(/ACQUIA_API_SECRET\s*=\s*(.+)/);
      fileApiSecret = match ? match[1].trim() : '';
    }
    
    return NextResponse.json({
      message: 'Direct .env.local file read',
      file_path: envLocalPath,
      file_exists: true,
      api_key_line: apiKeyLine,
      api_secret_line: apiSecretLine ? apiSecretLine.substring(0, 50) + '...' : undefined,
      parsed_api_key: fileApiKey,
      parsed_api_secret_preview: fileApiSecret ? fileApiSecret.substring(0, 20) + '...' : '',
      process_env_api_key: process.env.ACQUIA_API_KEY,
      values_match: fileApiKey === process.env.ACQUIA_API_KEY,
      file_content_preview: content.substring(0, 300) + (content.length > 300 ? '...' : '')
    });
    
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to read .env.local file',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}