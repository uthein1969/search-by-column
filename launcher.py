import os
import sys
import threading
import time
import webbrowser
from flask import Flask, send_from_directory

def get_dist_dir():
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
    
    dist_path = os.path.join(base_path, 'dist')
    return dist_path if os.path.exists(dist_path) else base_path

dist_folder = get_dist_dir()
app = Flask(__name__, static_folder=dist_folder)

# Root URL သို့ သွားပါက index.html ကို ပြပေးခြင်း
@app.route('/')
def index():
    return send_from_directory(dist_folder, 'index.html')

# JS, CSS, ပုံ စသည့် assets များအားလုံးကို တိုက်ရိုက် serve လုပ်ပေးခြင်း
@app.route('/<path:path>')
def serve_file(path):
    target_file = os.path.join(dist_folder, path)
    if os.path.exists(target_file):
        return send_from_directory(dist_folder, path)
    return send_from_directory(dist_folder, 'index.html')

def open_browser():
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5173')

if __name__ == '__main__':
    threading.Thread(target=open_browser, daemon=True).start()
    app.run(host='127.0.0.1', port=5173, debug=False)