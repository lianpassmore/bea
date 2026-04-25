#!/bin/bash
# Test the Alexa handler locally without an Alexa developer account.
# Run: bash alexa-skill/test-requests.sh
# Make sure the dev server is running: npm run dev

BASE="http://localhost:3000/api/alexa/handler"

echo "=== 1. LaunchRequest (opens skill, plants reminders, generates Bea prompt) ==="
curl -s -X POST "$BASE" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "session": { "sessionId": "test-session-001", "attributes": {} },
    "request": { "type": "LaunchRequest" },
    "context": {
      "System": {
        "apiAccessToken": "mock-token",
        "apiEndpoint": "https://api.amazonalexa.com"
      }
    }
  }' | python3 -m json.tool

echo ""
echo "=== 2. CaptureIntent (something is said — Bea responds, transcript accumulates) ==="
curl -s -X POST "$BASE" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "session": {
      "sessionId": "test-session-001",
      "attributes": {
        "transcript": [],
        "startedAt": '"$(date +%s)"'000
      }
    },
    "request": {
      "type": "IntentRequest",
      "intent": {
        "name": "CaptureIntent",
        "slots": {
          "message": { "value": "Mum seemed really tired after the hospital appointment today" }
        }
      }
    },
    "context": {
      "System": {
        "apiAccessToken": "mock-token",
        "apiEndpoint": "https://api.amazonalexa.com"
      }
    }
  }' | python3 -m json.tool

echo ""
echo "=== 3. StopIntent (saves transcript to Supabase, fires guardian pipeline) ==="
curl -s -X POST "$BASE" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "session": {
      "sessionId": "test-session-001",
      "attributes": {
        "transcript": [
          { "role": "user", "message": "Mum seemed really tired after the hospital appointment today", "time_in_call_secs": 3 },
          { "role": "agent", "message": "That sounds heavy to carry. Is there more on your mind?", "time_in_call_secs": 6 }
        ],
        "startedAt": '"$(date +%s)"'000
      }
    },
    "request": {
      "type": "IntentRequest",
      "intent": { "name": "AMAZON.StopIntent" }
    },
    "context": {
      "System": {
        "apiAccessToken": "mock-token",
        "apiEndpoint": "https://api.amazonalexa.com"
      }
    }
  }' | python3 -m json.tool

echo ""
echo "Done. Check your Supabase check_ins table — the StopIntent should have saved a row with member_name=Household."
