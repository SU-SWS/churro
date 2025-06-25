import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Capture the current state
  const currentApiKey = process.env.ACQUIA_API_KEY;
  
  // Check if we can manually set it
  const originalValue = process.env.ACQUIA_API_KEY;
  process.env.ACQUIA_API_KEY = 'deed5eaf-98ba-4924-8747-1fb1fbd00bd3';
  const afterManualSet = process.env.ACQUIA_API_KEY;
  
  // Restore original (for safety)
  process.env.ACQUIA_API_KEY = originalValue;
  
  return NextResponse.json({
    message: 'Runtime Environment Debug',
    original_value: originalValue,
    after_manual_set: afterManualSet,
    manual_set_worked: afterManualSet === 'deed5eaf-98ba-4924-8747-1fb1fbd00bd3',
    
    // Check for any weird process.env behavior
    process_env_keys: Object.keys(process.env).filter(k => k.includes('ACQUIA')),
    
    // Check if there are any descriptor issues
    api_key_descriptor: Object.getOwnPropertyDescriptor(process.env, 'ACQUIA_API_KEY'),
    
    // Check the type
    api_key_type: typeof process.env.ACQUIA_API_KEY,
    api_key_constructor: process.env.ACQUIA_API_KEY?.constructor?.name,
  });
}