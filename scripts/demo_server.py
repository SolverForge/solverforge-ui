#!/usr/bin/env python3

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


class DemoRequestHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path_only = path.split("?", 1)[0].split("#", 1)[0]
        if path_only.startswith("/sf/"):
            path_only = "/static" + path_only
        return str(ROOT / path_only.lstrip("/"))


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8000), DemoRequestHandler)
    print("Serving demos at http://127.0.0.1:8000/demos/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
