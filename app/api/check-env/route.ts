import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  // Read the .env.local file directly to compare with process.env
  let envFileContents = '';
  let envFilePath = '';
  let envFileError = null;
  let envVarsFromFile: Record<string, string> = {};
  
  try {
    envFilePath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envFilePath)) {
      envFileContents = fs.readFileSync(envFilePath, 'utf8');
      
      // Parse .env.local file
      envVarsFromFile = envFileContents
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .reduce((acc, line) => {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, string>);
    }
  } catch (error) {
    envFileError = error instanceof Error ? error.message : 'Unknown error reading .env.local';
  }
  
  // Check for exact matches and transformations
  const apiKeyMatches = process.env.ACQUIA_API_KEY === envVarsFromFile.ACQUIA_API_KEY;
  const apiSecretMatches = process.env.ACQUIA_API_SECRET === envVarsFromFile.ACQUIA_API_SECRET;
  
  // Check if API key/secret are Base64 encoded versions
  let apiKeyIsBase64OfEnvFile = false;
  let apiSecretIsBase64OfEnvFile = false;
  
  try {
    if (process.env.ACQUIA_API_KEY && envVarsFromFile.ACQUIA_API_KEY) {
      const decodedApiKey = Buffer.from(process.env.ACQUIA_API_KEY, 'base64').toString('utf-8');
      apiKeyIsBase64OfEnvFile = decodedApiKey === envVarsFromFile.ACQUIA_API_KEY;
    }
    
    if (process.env.ACQUIA_API_SECRET && envVarsFromFile.ACQUIA_API_SECRET) {
      const decodedApiSecret = Buffer.from(process.env.ACQUIA_API_SECRET, 'base64').toString('utf-8');
      apiSecretIsBase64OfEnvFile = decodedApiSecret === envVarsFromFile.ACQUIA_API_SECRET;
    }
  } catch (error) {
    // Not base64 encoded
  }
  
  // Check if quoted values are being stripped
  const apiKeyInFileHasQuotes = envVarsFromFile.ACQUIA_API_KEY?.startsWith('"') && 
                               envVarsFromFile.ACQUIA_API_KEY?.endsWith('"');
  
  const apiSecretInFileHasQuotes = envVarsFromFile.ACQUIA_API_SECRET?.startsWith('"') && 
                                  envVarsFromFile.ACQUIA_API_SECRET?.endsWith('"');
  
  const apiKeyMatchesUnquoted = apiKeyInFileHasQuotes && 
                               process.env.ACQUIA_API_KEY === envVarsFromFile.ACQUIA_API_KEY.slice(1, -1);
  
  const apiSecretMatchesUnquoted = apiSecretInFileHasQuotes && 
                                  process.env.ACQUIA_API_SECRET === envVarsFromFile.ACQUIA_API_SECRET.slice(1, -1);
  
  return NextResponse.json({
    env_file: {
      path: envFilePath,
      exists: !!envFileContents,
      error: envFileError,
      parsed_values: {
        ACQUIA_API_KEY: envVarsFromFile.ACQUIA_API_KEY ? 
          `${envVarsFromFile.ACQUIA_API_KEY.substring(0, 8)}...` : 'not found',
        ACQUIA_API_SECRET: envVarsFromFile.ACQUIA_API_SECRET ? 
          `${envVarsFromFile.ACQUIA_API_SECRET.substring(0, 8)}...` : 'not found',
        ACQUIA_API_BASE_URL: envVarsFromFile.ACQUIA_API_BASE_URL,
        ACQUIA_AUTH_BASE_URL: envVarsFromFile.ACQUIA_AUTH_BASE_URL,
        has_quotes: {
          ACQUIA_API_KEY: apiKeyInFileHasQuotes,
          ACQUIA_API_SECRET: apiSecretInFileHasQuotes
        }
      }
    },
    process_env: {
      ACQUIA_API_KEY: process.env.ACQUIA_API_KEY ? 
        `${process.env.ACQUIA_API_KEY.substring(0, 8)}...` : undefined,
      ACQUIA_API_SECRET: process.env.ACQUIA_API_SECRET ? 
        `${process.env.ACQUIA_API_SECRET.substring(0, 8)}...` : undefined,
      ACQUIA_API_BASE_URL: process.env.ACQUIA_API_BASE_URL,
      ACQUIA_AUTH_BASE_URL: process.env.ACQUIA_AUTH_BASE_URL,
      NODE_ENV: process.env.NODE_ENV
    },
    comparison: {
      exact_match: {
        ACQUIA_API_KEY: apiKeyMatches,
        ACQUIA_API_SECRET: apiSecretMatches
      },
      transformations: {
        ACQUIA_API_KEY: {
          is_base64_encoded: apiKeyIsBase64OfEnvFile,
          quotes_removed: apiKeyMatchesUnquoted
        },
        ACQUIA_API_SECRET: {
          is_base64_encoded: apiSecretIsBase64OfEnvFile,
          quotes_removed: apiSecretMatchesUnquoted
        }
      }
    },
    solution: {
      direct_env_usage: `
// Solution 1: Access env variables directly (preferred)
const apiKey = process.env.ACQUIA_API_KEY;
const apiSecret = process.env.ACQUIA_API_SECRET;
      `,
      custom_env_loading: `
// Solution 2: Custom env loading from file
import fs from 'fs';
import path from 'path';

function loadEnvFromFile() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\\n').forEach(line => {
      const parts = line.match(/^([^=]+)=(.*)$/);
      if (parts) {
        const key = parts[1].trim();
        let value = parts[2].trim();
        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        envVars[key] = value;
      }
    });
    
    return envVars;
  } catch (e) {
    console.error('Failed to load .env.local file');
    return {};
  }
}

const envVars = loadEnvFromFile();
const apiKey = envVars.ACQUIA_API_KEY;
const apiSecret = envVars.ACQUIA_API_SECRET;
      `
    }
  });
}