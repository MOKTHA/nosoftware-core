#!/bin/bash
# Delete all stopped Vercel sandboxes to free up snapshot storage
# Usage: ./scripts/cleanup-sandboxes.sh

set -e

# Load env vars
if [ -f "apps/web/.env.local" ]; then
  source apps/web/.env.local
elif [ -f ".env.local" ]; then
  source .env.local
fi

if [ -z "$VERCEL_TOKEN" ] || [ -z "$VERCEL_TEAM_ID" ] || [ -z "$VERCEL_PROJECT_ID" ]; then
  echo "Error: VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID must be set"
  exit 1
fi

echo "Fetching sandboxes..."
SANDBOX_IDS=$(curl -s "https://api.vercel.com/v1/sandboxes?teamId=$VERCEL_TEAM_ID&project=$VERCEL_PROJECT_ID" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
sandboxes = data.get('sandboxes', data.get('data', []))
for s in sandboxes:
    print(s['id'])
")

COUNT=0
for SBX_ID in $SANDBOX_IDS; do
  echo -n "Deleting $SBX_ID... "
  RESULT=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    "https://api.vercel.com/v1/sandboxes/$SBX_ID?teamId=$VERCEL_TEAM_ID" \
    -H "Authorization: Bearer $VERCEL_TOKEN")
  echo "HTTP $RESULT"
  COUNT=$((COUNT + 1))
done

echo ""
echo "Done — deleted $COUNT sandboxes. Snapshot storage should be freed."
echo "You can now retry the build."
