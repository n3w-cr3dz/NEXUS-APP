#!/usr/bin/env python3
"""
NEXUS WebSocket Agent
Run this on Android Termux or Kali VPS.
Receives commands from NEXUS app and streams real output back.

TERMUX SETUP:
  pkg update && pkg install python
  pip install websockets
  python nexus_agent.py

KALI VPS SETUP:
  pip3 install websockets
  python3 nexus_agent.py --host 0.0.0.0 --port 8766

OPTIONAL TLS (recommended for remote):
  python3 nexus_agent.py --host 0.0.0.0 --port 8766 --cert cert.pem --key key.pem
"""

import asyncio
import websockets
import subprocess
import json
import argparse
import sys
import os
import ssl
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(message)s', datefmt='%H:%M:%S')
log = logging.getLogger('nexus-agent')

# Optionally restrict commands (comment out to allow everything)
BLOCKED_CMDS = [
    # Add any commands you never want to allow
    # e.g. "rm -rf /"
]

async def run_command(websocket, cmd_id, command):
    """Execute a shell command and stream output to the WebSocket client."""
    log.info(f"[{cmd_id}] EXEC: {command}")

    # Check blocked commands
    for blocked in BLOCKED_CMDS:
        if blocked in command:
            await websocket.send(json.dumps({
                "id": cmd_id, "type": "stderr",
                "data": f"[NEXUS AGENT] Command blocked: contains '{blocked}'\n"
            }))
            await websocket.send(json.dumps({"id": cmd_id, "type": "done", "exit_code": 1}))
            return

    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            shell=True,
            executable='/bin/bash' if os.path.exists('/bin/bash') else '/bin/sh',
        )

        async def stream_pipe(pipe, msg_type):
            while True:
                chunk = await pipe.read(4096)
                if not chunk:
                    break
                text = chunk.decode('utf-8', errors='replace')
                try:
                    await websocket.send(json.dumps({
                        "id": cmd_id,
                        "type": msg_type,
                        "data": text
                    }))
                except websockets.exceptions.ConnectionClosed:
                    proc.terminate()
                    return

        # Stream stdout and stderr concurrently
        await asyncio.gather(
            stream_pipe(proc.stdout, 'output'),
            stream_pipe(proc.stderr, 'stderr'),
        )

        exit_code = await proc.wait()
        await websocket.send(json.dumps({
            "id": cmd_id, "type": "done", "exit_code": exit_code
        }))
        log.info(f"[{cmd_id}] DONE (exit={exit_code})")

    except asyncio.CancelledError:
        log.info(f"[{cmd_id}] CANCELLED")
    except Exception as e:
        await websocket.send(json.dumps({
            "id": cmd_id, "type": "stderr", "data": f"[AGENT ERROR] {str(e)}\n"
        }))
        await websocket.send(json.dumps({"id": cmd_id, "type": "done", "exit_code": -1}))


async def handler(websocket):
    client_addr = websocket.remote_address
    log.info(f"Client connected: {client_addr}")

    # Track running tasks for this client
    tasks = {}

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                log.warning(f"Invalid JSON from {client_addr}: {message[:100]}")
                continue

            msg_type = data.get('type', 'exec')
            cmd_id = data.get('id', 0)

            if msg_type == 'exec':
                command = data.get('command', '')
                if not command:
                    continue
                # Run in background task so multiple commands can run in parallel
                task = asyncio.create_task(run_command(websocket, cmd_id, command))
                tasks[cmd_id] = task
                # Clean up when done
                task.add_done_callback(lambda t, cid=cmd_id: tasks.pop(cid, None))

            elif msg_type == 'kill':
                # Kill a specific running command
                task = tasks.get(cmd_id)
                if task:
                    task.cancel()
                    await websocket.send(json.dumps({"id": cmd_id, "type": "killed"}))

            elif msg_type == 'ping':
                await websocket.send(json.dumps({"type": "pong", "agent": "nexus-agent/1.0"}))

    except websockets.exceptions.ConnectionClosed:
        log.info(f"Client disconnected: {client_addr}")
    except Exception as e:
        log.error(f"Handler error: {e}")
    finally:
        # Cancel all running tasks for this client
        for task in tasks.values():
            task.cancel()


async def main(host, port, certfile=None, keyfile=None):
    ssl_ctx = None
    if certfile and keyfile:
        ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_ctx.load_cert_chain(certfile, keyfile)
        log.info(f"TLS enabled with {certfile}")

    proto = "wss" if ssl_ctx else "ws"
    log.info(f"NEXUS Agent starting on {proto}://{host}:{port}")
    log.info(f"Shell: {'/bin/bash' if os.path.exists('/bin/bash') else '/bin/sh'}")
    log.info("Waiting for NEXUS app connection...")

    async with websockets.serve(handler, host, port, ssl=ssl_ctx, max_size=None):
        await asyncio.Future()  # run forever


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='NEXUS WebSocket Agent')
    parser.add_argument('--host', default='localhost', help='Bind host (use 0.0.0.0 for remote)')
    parser.add_argument('--port', type=int, default=8765, help='Port (default 8765)')
    parser.add_argument('--cert', help='TLS certificate file (.pem)')
    parser.add_argument('--key', help='TLS private key file (.pem)')
    args = parser.parse_args()

    try:
        asyncio.run(main(args.host, args.port, args.cert, args.key))
    except KeyboardInterrupt:
        log.info("Agent stopped")
