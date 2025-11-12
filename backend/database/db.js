import postgres from 'postgres'
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = postgres(connectionString, {
  onnotice: () => {}, // Suppress notices
})

// Test the connection
async function testConnection() {
  try {
    await sql`SELECT 1`;
    console.log('✅ Database connected successfully!');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

await testConnection();

export default sql