#!/bin/bash

echo "🚀 Starting Deployment Script..."
# Triggering fresh rebuild after Vercel transient error

# 1. Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate
if [ $? -ne 0 ]; then
  echo "❌ Error generating prisma client"
  exit 1
fi

# 2. Push Database Schema
echo "🗄️ Pushing DB Schema..."
npx prisma db push --accept-data-loss
if [ $? -ne 0 ]; then
  echo "❌ Error pushing DB schema. Check DATABASE_URL."
  exit 1
fi

# 2.5. Restore candidates original vacancy mapping
echo "🔄 Restoring original vacancy mappings..."
node scripts/restore-candidates.js
if [ $? -ne 0 ]; then
  echo "⚠️ Warning: Candidate restoration script encountered an issue, proceeding anyway..."
fi


# 3. Build Next.js App
echo "🏗️ Building Next.js App..."
next build
