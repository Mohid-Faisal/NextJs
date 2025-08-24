# Supabase Database Configuration

## Step 1: Get Your Supabase Database URL

1. Go to [supabase.com](https://supabase.com) and sign in
2. Create a new project or select existing one
3. Go to Settings → Database
4. Copy the "Connection string" (URI format)

## Step 2: Create .env file

Create a `.env` file in your project root with:

```bash
# Supabase Database Configuration
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Supabase Configuration (for future use if needed)
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR-ANON-KEY]

# JWT Secret (keep your existing one)
JWT_SECRET=your-jwt-secret-here
```

## Step 3: Replace the placeholders

- `[YOUR-PASSWORD]` - Your Supabase database password
- `[YOUR-PROJECT-REF]` - Your project reference ID from Supabase
- `[YOUR-ANON-KEY]` - Your public anon key from Supabase

## Step 4: Run Prisma Commands

```bash
# Generate Prisma client
npm run postinstall

# Push your schema to Supabase (if you want to create tables)
npx prisma db push

# Or run migrations if you prefer
npx prisma migrate dev
```

## Step 5: Test Connection

Run your build command to test the connection:
```bash
npm run build
```

## Important Notes

- Your existing Prisma schema will work exactly the same
- All your API routes will continue to work unchanged
- You're just changing the database connection, not the ORM
- Supabase provides a managed PostgreSQL database
