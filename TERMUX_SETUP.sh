#!/data/data/com.termux/files/usr/bin/bash
# Run this inside Termux on your Android device
# ─────────────────────────────────────────────
echo "[*] Installing NEXUS agent dependencies..."
pkg update -y
pkg install python websockets -y 2>/dev/null || pip install websockets

echo "[*] Starting NEXUS agent on ws://localhost:8765"
echo "    Keep this running while using the NEXUS app"
echo ""
python nexus_agent.py --host localhost --port 8765
