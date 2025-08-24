import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function testDatabaseConnection() {
  try {
    // Test the connection by running a simple query
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful!');
    return { success: true, message: 'Database connected successfully' };
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return { 
      success: false, 
      message: 'Database connection failed', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function checkTables() {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('📋 Available tables:', tables);
    return { success: true, tables };
  } catch (error) {
    console.error('❌ Failed to check tables:', error);
    return { 
      success: false, 
      message: 'Failed to check tables', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  } finally {
    await prisma.$disconnect();
  }
}
