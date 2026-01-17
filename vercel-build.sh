#!/bin/bash

echo "🚀 Starting Deployment Script..."

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

# 3. Build Next.js App
echo "🏗️ Building Next.js App..."
export NEXT_build_worker_threads=1
next build
