#!/bin/bash
# Delete deployments older than a specific date

PROJECT="churro"
CUTOFF_DATE="2025-12-01"
CUTOFF_TIMESTAMP=$(date -j -f "%Y-%m-%d" "$CUTOFF_DATE" "+%s")000  # Convert to milliseconds for macOS

# You need a Vercel token - get it from https://vercel.com/account/tokens
VERCEL_TOKEN="${VERCEL_TOKEN:-}"

if [ -z "$VERCEL_TOKEN" ]; then
  echo "Error: VERCEL_TOKEN environment variable not set"
  echo "Get a token from https://vercel.com/account/tokens"
  echo "Then run: export VERCEL_TOKEN='your_token_here'"
  exit 1
fi

# Get team/user ID (you might need to adjust this)
TEAM_ID="${VERCEL_TEAM_ID:-sws-developers}"

echo "Fetching all deployments for project: $PROJECT"
echo "This may take a while..."

# Fetch all deployments using pagination
ALL_DEPLOYMENTS="[]"
UNTIL=""

while true; do
  if [ -z "$UNTIL" ]; then
    URL="https://api.vercel.com/v6/deployments?projectId=${PROJECT}&teamId=${TEAM_ID}&limit=100"
  else
    URL="https://api.vercel.com/v6/deployments?projectId=${PROJECT}&teamId=${TEAM_ID}&limit=100&until=${UNTIL}"
  fi
  
  RESPONSE=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "$URL")
  DEPLOYMENTS=$(echo "$RESPONSE" | jq '.deployments')
  
  if [ "$DEPLOYMENTS" = "null" ] || [ "$DEPLOYMENTS" = "[]" ]; then
    break
  fi
  
  COUNT=$(echo "$DEPLOYMENTS" | jq 'length')
  echo "Fetched $COUNT deployments..."
  
  ALL_DEPLOYMENTS=$(echo "$ALL_DEPLOYMENTS" "$DEPLOYMENTS" | jq -s 'add')
  
  # Get the timestamp of the last deployment for pagination
  UNTIL=$(echo "$DEPLOYMENTS" | jq -r '.[-1].created')
  
  if [ "$UNTIL" = "null" ]; then
    break
  fi
done

echo "Total deployments fetched: $(echo "$ALL_DEPLOYMENTS" | jq 'length')"

# Filter, sort, and save to temp file
echo "$ALL_DEPLOYMENTS" | jq -r ".[] | select(.created < $CUTOFF_TIMESTAMP) | select(.target != \"PRODUCTION\") | @json" | jq -s 'sort_by(.created) | .[]' | jq -c '.' > /tmp/deployments_to_delete.txt

TOTAL_TO_DELETE=$(wc -l < /tmp/deployments_to_delete.txt | tr -d ' ')
echo "Found $TOTAL_TO_DELETE deployments to delete (older than $CUTOFF_DATE)"

if [ "$TOTAL_TO_DELETE" -eq 0 ]; then
  echo "Nothing to delete!"
  rm /tmp/deployments_to_delete.txt
  exit 0
fi

echo ""
echo "Press Enter to start deletions, or Ctrl+C to abort..."
read

while IFS= read -r deployment; do
  DEPLOY_URL=$(echo $deployment | jq -r '.url')
  CREATED=$(echo $deployment | jq -r '.created')
  BRANCH=$(echo $deployment | jq -r '.meta.githubCommitRef // "N/A"')
  STATE=$(echo $deployment | jq -r '.state // .readyState // "UNKNOWN"')
  
  if [ -z "$DEPLOY_URL" ] || [ "$DEPLOY_URL" = "null" ]; then
    echo "Warning: Could not extract deployment URL"
    continue
  fi
  
  # Calculate age in a human-readable format
  NOW=$(date +%s)
  CREATED_SEC=$((CREATED / 1000))
  AGE_SEC=$((NOW - CREATED_SEC))
  AGE_DAYS=$((AGE_SEC / 86400))
  AGE_MONTHS=$((AGE_DAYS / 30))
  REMAINING_DAYS=$((AGE_DAYS % 30))
  
  if [ $AGE_MONTHS -gt 0 ]; then
    AGE="${AGE_MONTHS}mo ${REMAINING_DAYS}d"
  else
    AGE="${AGE_DAYS}d"
  fi
  
  echo "Deleting $DEPLOY_URL (Age: $AGE, Branch: $BRANCH, Status: $STATE)"
  vercel rm $DEPLOY_URL < /dev/tty
done < /tmp/deployments_to_delete.txt

# Clean up temp file
rm /tmp/deployments_to_delete.txt

echo ""
echo "Done!"
