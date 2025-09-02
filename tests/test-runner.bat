@echo off
echo.
echo ======================================
echo   Metaverse Backend Test Suite
echo ======================================
echo.

:: Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

:: Check if pnpm is available
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ pnpm is not installed
    echo Installing pnpm...
    npm install -g pnpm
    if errorlevel 1 (
        echo ❌ Failed to install pnpm
        exit /b 1
    )
)

:: Install dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing test dependencies...
    pnpm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        exit /b 1
    )
)

:: Set environment variables for Windows
set NODE_ENV=test
set HTTP_SERVICE_PORT=3101
set WS_SERVICE_PORT=3102
set CHAT_SERVICE_PORT=3103

echo 🧪 Starting backend services and running tests...
echo.

:: Parse command line arguments
set START_SERVICES=0
set STOP_AFTER=0
set VERBOSE=0
set SKIP_E2E=0
set ONLY_SUITE=
set TEST_TIMEOUT=30000

:parse_args
if "%~1"=="--start-services" set START_SERVICES=1
if "%~1"=="--stop-after" set STOP_AFTER=1
if "%~1"=="--verbose" set VERBOSE=1
if "%~1"=="--skip-e2e" set SKIP_E2E=1
if "%~1"=="--only" (
    shift
    set ONLY_SUITE=%~1
)
if "%~1"=="--timeout" (
    shift
    set TEST_TIMEOUT=%~1
)
if "%~1"=="--help" goto show_help
if "%~1"=="-h" goto show_help

shift
if not "%~1"=="" goto parse_args

:: Build command arguments
set ARGS=
if %START_SERVICES%==1 set ARGS=%ARGS% --start-services
if %STOP_AFTER%==1 set ARGS=%ARGS% --stop-after
if %VERBOSE%==1 set ARGS=%ARGS% --verbose
if %SKIP_E2E%==1 set ARGS=%ARGS% --skip-e2e
if not "%ONLY_SUITE%"=="" set ARGS=%ARGS% --only "%ONLY_SUITE%"
if not "%TEST_TIMEOUT%"=="30000" set ARGS=%ARGS% --timeout %TEST_TIMEOUT%

:: Run the test runner
node run-tests.js %ARGS%
set TEST_EXIT_CODE=%errorlevel%

echo.
if %TEST_EXIT_CODE%==0 (
    echo ✅ All tests completed successfully!
) else (
    echo ❌ Tests failed with exit code %TEST_EXIT_CODE%
)

exit /b %TEST_EXIT_CODE%

:show_help
echo.
echo Metaverse Backend Test Runner (Windows)
echo.
echo Usage: test-runner.bat [options]
echo.
echo Options:
echo   --start-services    Start backend services before running tests
echo   --stop-after        Stop services after tests complete  
echo   --verbose           Enable verbose output
echo   --skip-e2e          Skip end-to-end tests
echo   --only ^<suite^>      Run only tests matching suite name
echo   --timeout ^<ms^>     Set test timeout (default: 30000ms)
echo   --help, -h          Show this help message
echo.
echo Examples:
echo   test-runner.bat --start-services --stop-after
echo   test-runner.bat --only unit --verbose
echo   test-runner.bat --skip-e2e --timeout 60000
echo.
exit /b 0
