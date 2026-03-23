#!/usr/bin/env python3

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent.parent


class DemoRequestHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path_only = unquote(urlsplit(path).path)
        if path_only.startswith("/sf/"):
            path_only = "/static" + path_only

        relative_parts = []
        for part in PurePosixPath(path_only).parts:
            if part in ("", "/", "."):
                continue
            if part == "..":
                continue
            relative_parts.append(part)

        candidate = ROOT.joinpath(*relative_parts).resolve()
        try:
            candidate.relative_to(ROOT)
        except ValueError:
            return str(ROOT)
        return str(candidate)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8000), DemoRequestHandler)
    print("Serving demos at http://127.0.0.1:8000/demos/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
