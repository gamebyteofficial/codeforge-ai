#!/bin/bash
# Switch Prisma schema between SQLite (local) and PostgreSQL (cloud)
# Usage: ./switch-db.sh postgresql  OR  ./switch-db.sh sqlite

TARGET=${1:-"sqlite"}
SCHEMA_DIR="prisma"

if [ "$TARGET" = "postgresql" ] || [ "$TARGET" = "postgres" ]; then
  echo "🔄 Switching to PostgreSQL (for cloud deployment)..."
  cp "$SCHEMA_DIR/schema.postgresql.prisma" "$SCHEMA_DIR/schema.prisma"
  echo "✅ Done! Schema now uses PostgreSQL."
  echo "⚠️  Make sure DATABASE_URL is set to your PostgreSQL connection string."
  echo "   Example: DATABASE_URL=postgresql://user:pass@host:5432/dbname"
elif [ "$TARGET" = "sqlite" ]; then
  echo "🔄 Switching to SQLite (for local development)..."
  # Restore from git if available, otherwise from the backup
  if git rev-parse --git-dir > /dev/null 2>&1; then
    git checkout -- "$SCHEMA_DIR/schema.prisma"
    echo "✅ Done! Schema restored from git (SQLite)."
  else
    echo "⚠️  Cannot restore from git. Manually change provider to \"sqlite\" in schema.prisma"
  fi
else
  echo "Usage: ./switch-db.sh [postgresql|sqlite]"
  echo "  postgresql  — Switch to PostgreSQL for cloud"
  echo "  sqlite      — Switch back to SQLite for local dev"
  exit 1
fi

echo ""
echo "Run these commands next:"
echo "  npx prisma generate"
echo "  npx prisma db push"
