#!/bin/bash
# LEAH Control Script
# Usage: ./leah.sh {dev|build|start|stop|restart|status|logs}

ACTION=${1:-help}
BACKEND_DIR="/var/www/leah.lan/backend"
FRONTEND_DIR="/var/www/leah.lan/frontend"

case "$ACTION" in
    dev)
        echo "🚀 Starting LEAH in development mode..."
        echo "   Backend:  http://localhost:8080"
        echo "   Frontend: http://localhost:5173"
        echo ""
        echo "   Open TWO terminals:"
        echo "   Terminal 1: cd $BACKEND_DIR && go run ./cmd/api"
        echo "   Terminal 2: cd $FRONTEND_DIR && npm run dev"
        ;;
    build)
        echo "🔨 Building LEAH..."
        echo "--- Backend ---"
        cd "$BACKEND_DIR" && go build -o leah ./cmd/api
        echo "--- Frontend ---"
        cd "$FRONTEND_DIR" && npm install && npm run build
        echo "✅ Build selesai."
        ;;
    start)
        echo "▶️  Starting LEAH service..."
        sudo systemctl start leah
        sudo systemctl enable leah 2>/dev/null
        echo "✅ LEAH running at http://leah.lan"
        ;;
    stop)
        echo "⏹  Stopping LEAH service..."
        sudo systemctl stop leah
        echo "✅ LEAH stopped."
        ;;
    restart)
        echo "🔄 Restarting LEAH..."
        sudo systemctl restart leah
        echo "✅ LEAH restarted."
        ;;
    status)
        echo "📊 LEAH Status:"
        sudo systemctl status leah --no-pager 2>&1
        ;;
    logs)
        sudo journalctl -u leah -f
        ;;
    *)
        echo "🐱 LEAH — List Everything Assets & Helpdesk"
        echo ""
        echo "Usage:"
        echo "  ./leah.sh dev       Development mode (2 terminals)"
        echo "  ./leah.sh build     Build backend + frontend"
        echo "  ./leah.sh start     Start production service"
        echo "  ./leah.sh stop      Stop production service"
        echo "  ./leah.sh restart   Restart production service"
        echo "  ./leah.sh status    Check service status"
        echo "  ./leah.sh logs      Follow service logs"
        ;;
esac
