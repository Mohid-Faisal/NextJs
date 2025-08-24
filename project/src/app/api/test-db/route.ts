import { NextRequest, NextResponse } from 'next/server';
import { testDatabaseConnection, checkTables } from '@/lib/db-test';

export async function GET(request: NextRequest) {
  try {
    // Test database connection
    const connectionResult = await testDatabaseConnection();
    
    if (!connectionResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Database connection failed',
          error: connectionResult.error 
        }, 
        { status: 500 }
      );
    }

    // Check available tables
    const tablesResult = await checkTables();
    
    return NextResponse.json({
      success: true,
      connection: connectionResult,
      tables: tablesResult,
      message: 'Database connection and table check completed'
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
