import time
import socket
import os
import subprocess
import datetime

PORT = 8083
CHECK_INTERVAL = 60 # Seconds
PROJECT_DIR = "/Users/racs/clawd/projects/rich-aroma-os"
LOG_FILE = f"{PROJECT_DIR}/sentinel.log"

def log(message):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = f"[{timestamp}] {message}"
    print(entry)
    with open(LOG_FILE, "a") as f:
        f.write(entry + "\n")

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(2)
        return s.connect_ex(('localhost', port)) == 0

def restart_server():
    log("⚠️ Server DOWN. Restarting...")
    
    # Kill any lingering node process on this port (just in case)
    try:
        subprocess.run(f"lsof -ti :{PORT} | xargs kill -9", shell=True)
    except Exception as e:
        pass
        
    time.sleep(2)
    
    # Start server
    cmd = f"cd {PROJECT_DIR} && nohup node server.js >> server.log 2>&1 &"
    subprocess.run(cmd, shell=True)
    
    # Wait and verify
    time.sleep(5)
    if is_port_open(PORT):
        log("✅ Server RECOVERED and listening.")
    else:
        log("❌ RESTART FAILED. Manual intervention needed.")

def main():
    log("🛡️ Rich Aroma Sentinel STARTED.")
    while True:
        try:
            if not is_port_open(PORT):
                restart_server()
        except Exception as e:
            log(f"❌ Sentinel Error: {e}")
        
        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    main()
