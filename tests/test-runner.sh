#!/bin/bash

echo ""
echo "======================================"
echo "   Metaverse Backend Test Suite"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_status $RED "❌ Node.js is not installed or not in PATH"
    print_status $YELLOW "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    print_status $RED "❌ pnpm is not installed"
    print_status $BLUE "Installing pnpm..."
    npm install -g pnpm
    if [ $? -ne 0 ]; then
        print_status $RED "❌ Failed to install pnpm"
        exit 1
    fi
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status $BLUE "📦 Installing test dependencies..."
    pnpm install
    if [ $? -ne 0 ]; then
        print_status $RED "❌ Failed to install dependencies"
        exit 1
    fi
fi

# Set environment variables
export NODE_ENV=test
export HTTP_SERVICE_PORT=3101
export WS_SERVICE_PORT=3102
export CHAT_SERVICE_PORT=3103

print_status $BLUE "🧪 Starting backend services and running tests..."
echo ""

# Parse command line arguments
START_SERVICES=false
STOP_AFTER=false
VERBOSE=false
SKIP_E2E=false
ONLY_SUITE=""
TEST_TIMEOUT="30000"
ARGS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --start-services)
            START_SERVICES=true
            ARGS="$ARGS --start-services"
            shift
            ;;
        --stop-after)
            STOP_AFTER=true
            ARGS="$ARGS --stop-after"
            shift
            ;;
        --verbose)
            VERBOSE=true
            ARGS="$ARGS --verbose"
            shift
            ;;
        --skip-e2e)
            SKIP_E2E=true
            ARGS="$ARGS --skip-e2e"
            shift
            ;;
        --only)
            ONLY_SUITE="$2"
            ARGS="$ARGS --only $2"
            shift 2
            ;;
        --timeout)
            TEST_TIMEOUT="$2"
            ARGS="$ARGS --timeout $2"
            shift 2
            ;;
        --help|-h)
            echo ""
            echo "Metaverse Backend Test Runner (Unix/Linux/macOS)"
            echo ""
            echo "Usage: ./test-runner.sh [options]"
            echo ""
            echo "Options:"
            echo "  --start-services    Start backend services before running tests"
            echo "  --stop-after        Stop services after tests complete"
            echo "  --verbose           Enable verbose output"
            echo "  --skip-e2e          Skip end-to-end tests"
            echo "  --only <suite>      Run only tests matching suite name"
            echo "  --timeout <ms>      Set test timeout (default: 30000ms)"
            echo "  --help, -h          Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./test-runner.sh --start-services --stop-after"
            echo "  ./test-runner.sh --only unit --verbose"
            echo "  ./test-runner.sh --skip-e2e --timeout 60000"
            echo ""
            exit 0
            ;;
        *)
            print_status $RED "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run the test runner
node run-tests.js $ARGS
TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_status $GREEN "✅ All tests completed successfully!"
else
    print_status $RED "❌ Tests failed with exit code $TEST_EXIT_CODE"
fi

exit $TEST_EXIT_CODE
