#!/usr/bin/env python3
from __future__ import annotations
import argparse
import http.server
import mimetypes
import os
import socketserver
import ssl
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"
mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("text/javascript", ".mjs")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "display-capture=(self), microphone=(self), speaker-selection=(self)")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("[OpenCall] " + fmt % args)

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> int:
    parser = argparse.ArgumentParser(description="OpenCall Local WebRTC static server")
    parser.add_argument("--host", default=os.environ.get("OPENCALL_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("OPENCALL_PORT", "3000")))
    parser.add_argument("--certfile", default=os.environ.get("OPENCALL_CERT", ""))
    parser.add_argument("--keyfile", default=os.environ.get("OPENCALL_KEY", ""))
    args = parser.parse_args()
    with Server((args.host, args.port), Handler) as httpd:
        scheme = "http"
        if args.certfile or args.keyfile:
            if not (args.certfile and args.keyfile):
                raise SystemExit("OPENCALL_CERT e OPENCALL_KEY devem ser usados juntos")
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(args.certfile, args.keyfile)
            httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
            scheme = "https"
        print(f"OpenCall Local WebRTC: {scheme}://{args.host}:{args.port}")
        if args.host not in ("127.0.0.1", "localhost", "::1"):
            print("AVISO: getDisplayMedia exige contexto seguro fora de localhost. Para acesso remoto, use HTTPS/Caddy.")
        print("Ctrl+C para encerrar.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nEncerrando OpenCall...")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
