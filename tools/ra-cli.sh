#!/bin/bash

# Rich Aroma OS - CLI Tool
DIR="/Users/racs/clawd/projects/rich-aroma-os"

case "$1" in
    "status")
        echo "🟢 RICH AROMA OS STATUS"
        pid=$(lsof -t -i :8083)
        if [ -n "$pid" ]; then
            echo "✅ Server is RUNNING (PID: $pid on Port 8083)"
            echo "Recent Logs:"
            tail -n 5 "$DIR/server.log"
        else
            echo "❌ Server is STOPPED (Port 8083 is free)"
        fi
        ;;
    
    "restart")
        echo "🔄 RESTARTING RICH AROMA OS SERVER..."
        pid=$(lsof -t -i :8083)
        if [ -n "$pid" ]; then
            echo "Killing existing process ($pid)..."
            kill -9 $pid
            sleep 1
        fi
        echo "Starting new server process in background..."
        cd "$DIR" && nohup node server.js >> server.log 2>&1 &
        sleep 2
        new_pid=$(lsof -t -i :8083)
        if [ -n "$new_pid" ]; then
            echo "✅ Server successfully restarted! (New PID: $new_pid)"
        else
            echo "⚠️ Server failed to start. Check logs."
            tail -n 10 "$DIR/server.log"
        fi
        ;;

    "stop")
        echo "🛑 STOPPING RICH AROMA OS SERVER..."
        pid=$(lsof -t -i :8083)
        if [ -n "$pid" ]; then
            kill -9 $pid
            echo "✅ Server stopped."
        else
            echo "Server is not running."
        fi
        ;;

    "logs")
        echo "📜 TAILING SERVER LOGS (Press Ctrl+C to stop)..."
        tail -f "$DIR/server.log"
        ;;

    "liability")
        echo "📊 RUNNING RICO CASH LIABILITY REPORT..."
        cd "$DIR" && node tools/rico_liability_report.js
        ;;

    *)
        echo "☕ RICH AROMA OS CLI"
        echo "Usage: ra [command]"
        echo ""
        echo "Commands:"
        echo "  status     - Check if the server is running"
        echo "  restart    - Force kill and restart the server safely"
        echo "  stop       - Stop the server"
        echo "  logs       - Follow the live server logs"
        echo "  liability  - Generate the Rico Cash outstanding liability report"
        echo ""
        ;;
esac
