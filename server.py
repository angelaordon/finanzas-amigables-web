#!/usr/bin/env python3
"""Servidor estático simple para Finanzas Amigables (Web).

Uso:
    python3 server.py            # arranca en http://localhost:8000
    python3 server.py 8080       # elige un puerto distinto

También funciona en Google Colab / Jupyter.
"""
import http.server
import socketserver
import sys
import os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"\nFinanzas Amigables servida en:\n  http://localhost:{PORT}\n")
    print("Ctrl+C para detener.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
