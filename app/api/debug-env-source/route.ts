import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const projectRoot = process.cwd();
  
  // Check for all possible env files
  const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
  const foundFiles: Record<string, any> = {};
  
  for (const file of envFiles) {
    const filePath = path.join(projectRoot, file);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const acquiaLines = lines.filter(line => 
          line.trim().startsWith('ACQUIA_API_KEY') || 
          line.trim().startsWith('ACQUIA_API_SECRET')
        );
        
        foundFiles[file] = {
          exists: true,
          acquiaLines: acquiaLines,
          fullContent: content.substring(0, 500) + (content.length > 500 ? '...' : '')
        };
      } else {
        foundFiles[file] = { exists: false };
      }
    } catch (error) {
      foundFiles[file] = { 
        exists: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }
  
  return NextResponse.json({
    message: 'Environment Files Debug',
    project_root: projectRoot,
    node_env: process.env.NODE_ENV,
    current_values: {
      ACQUIA_API_KEY: process.env.ACQUIA_API_KEY,
      ACQUIA_API_SECRET: process.env.ACQUIA_API_SECRET ? '[hidden]' : undefined,
      ACQUIA_API_KEY_LENGTH: process.env.ACQUIA_API_KEY?.length,
    },
    env_files_found: foundFiles,
    expected_api_key: 'deed5eaf-98ba-4924-8747-1fb1fbd00bd3',
    values_match: process.env.ACQUIA_API_KEY === 'deed5eaf-98ba-4924-8747-1fb1fbd00bd3'
  });
}