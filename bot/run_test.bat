@echo off
echo Installing bot dependencies...
pip install -r requirements.txt

echo.
echo Starting bot game test (will find available port automatically)...
echo This will run for 5 minutes with 4 bots playing.
echo Press Ctrl+C to stop early.
echo.

python test_bot_game_auto_port.py