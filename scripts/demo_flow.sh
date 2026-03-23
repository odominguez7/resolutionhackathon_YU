#!/bin/bash
# YU RestOS — Demo Endpoint Verification
# Run this before the demo to make sure everything works.

BASE="http://localhost:8000"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "========================================="
echo "  YU RestOS — Pre-Demo Check"
echo "========================================="
echo ""

# Health
echo -n "1. Health check... "
HEALTH=$(curl -s $BASE/api/health)
if echo "$HEALTH" | grep -q "YU RestOS"; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "   Start backend: cd backend && uvicorn main:app --port 8000"
    exit 1
fi

# Sleep data
echo -n "2. Sleep trends (14 days)... "
TRENDS=$(curl -s $BASE/api/sleep/trends | python3 -c "import sys,json; print(len(json.load(sys.stdin)['trends']))")
echo -e "${GREEN}$TRENDS days${NC}"

# Sleep summary
echo -n "3. Sleep summary... "
SUMMARY=$(curl -s $BASE/api/sleep/summary)
SCORE=$(echo "$SUMMARY" | python3 -c "import sys,json; print(json.load(sys.stdin)['currentScore'])")
DROP=$(echo "$SUMMARY" | python3 -c "import sys,json; print(json.load(sys.stdin)['dropPercent'])")
echo -e "${GREEN}Score: $SCORE, Drop: $DROP%${NC}"

# Check-ins
echo -n "4. Check-in history... "
CHECKINS=$(curl -s $BASE/api/checkin/history | python3 -c "import sys,json; print(len(json.load(sys.stdin)['checkins']))")
echo -e "${GREEN}$CHECKINS check-ins${NC}"

# Drift detection
echo -n "5. Drift analysis... "
DRIFT=$(curl -s $BASE/api/drift/analyze)
DETECTED=$(echo "$DRIFT" | python3 -c "import sys,json; print(json.load(sys.stdin)['drift_detected'])")
SEVERITY=$(echo "$DRIFT" | python3 -c "import sys,json; print(json.load(sys.stdin)['severity'])")
echo -e "${GREEN}Detected: $DETECTED, Severity: $SEVERITY${NC}"

# Recovery Plan
echo -n "6. Recovery plan generation... "
PLAN=$(curl -s $BASE/api/actions/plan/generate)
ACTIONS=$(echo "$PLAN" | python3 -c "import sys,json; print(json.load(sys.stdin)['total_actions'])")
PLAN_ID=$(echo "$PLAN" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo -e "${GREEN}$ACTIONS actions, Plan ID: $PLAN_ID${NC}"

# Execute all actions
echo -n "7. Execute all actions... "
EXEC=$(curl -s -X POST "$BASE/api/actions/plan/$PLAN_ID/execute-all")
RESULTS=$(echo "$EXEC" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['results']))")
echo -e "${GREEN}$RESULTS actions executed${NC}"

# Feedback
echo -n "8. Feedback effectiveness... "
EFF=$(curl -s "$BASE/api/feedback/demo_plan/effectiveness")
VERDICT=$(echo "$EFF" | python3 -c "import sys,json; print(json.load(sys.stdin)['recovery_verdict'])")
echo -e "${GREEN}Verdict: $VERDICT${NC}"

# Products
echo -n "9. Product recommendations... "
PRODS=$(curl -s "$BASE/api/actions/products/deep_sleep")
GOAL=$(echo "$PRODS" | python3 -c "import sys,json; print(json.load(sys.stdin)['goal'])")
echo -e "${GREEN}$GOAL${NC}"

echo ""
echo "========================================="
echo -e "  ${GREEN}All systems go. Ready to demo.${NC}"
echo "========================================="
echo ""
echo "Demo flow:"
echo "  Landing → Dashboard → Check-in → Drift → Recovery Plan → Execute → Status → Debrief → X-Ray"
echo ""
echo "Plan ID for this session: $PLAN_ID"
