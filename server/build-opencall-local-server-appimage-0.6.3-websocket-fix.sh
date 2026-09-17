#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# OpenCall Local RTC Server - AppImage Builder
# Target: Arch Linux x86_64
#
# Gera um AppImage headless contendo:
#   - Python runtime
#   - FastAPI + Uvicorn + WebSockets
#   - Servidor de signaling + presença + voz/câmera/tela WebRTC
#   - Lista em tempo real de usuários/transmissões
#   - Chat/contas/canais persistentes em SQLite + DMs, cargos e moderação
#   - Um mesmo cliente pode transmitir e assistir simultaneamente
#   - coturn / turnserver
#   - Gerenciador que inicia e encerra tudo junto
#
# O AppImage gerado NÃO precisa rodar como root.
# Configurações persistentes ficam em:
#   ~/.config/private-screen-share-server/
#   ~/.local/share/private-screen-share-server/
# ============================================================

APP_NAME="OpenCallLocal-RTC-Server"
VERSION="0.6.3"
ARCH="x86_64"

# O appimagetool pode falhar ao receber caminhos com caracteres não-ASCII
# (ex.: ~/Vídeos). Portanto o build acontece em /tmp usando somente ASCII,
# e o AppImage pronto é copiado de volta para a pasta onde este script foi rodado.
ORIGINAL_DIR="$(pwd)"
SAFE_BASE="${TMPDIR:-/tmp}/private-screen-share-server-build-${UID}"
BUILD_DIR="${SAFE_BASE}/work"
APPDIR="${BUILD_DIR}/${APP_NAME}.AppDir"
TOOLS_DIR="${BUILD_DIR}/tools"

SAFE_OUTPUT="${SAFE_BASE}/${APP_NAME}-${VERSION}-${ARCH}.AppImage"
OUTPUT="${ORIGINAL_DIR}/${APP_NAME}-${VERSION}-${ARCH}.AppImage"

APPIMAGETOOL="${TOOLS_DIR}/appimagetool-${ARCH}.AppImage"
APPIMAGE_RUNTIME="${TOOLS_DIR}/runtime-${ARCH}"

PYTHON_BIN="$(command -v python3 || true)"
TURN_BIN="$(command -v turnserver || true)"

say() {
    printf '\n\033[1;36m==> %s\033[0m\n' "$*"
}

warn() {
    printf '\033[1;33mAVISO:\033[0m %s\n' "$*" >&2
}

die() {
    printf '\033[1;31mERRO:\033[0m %s\n' "$*" >&2
    exit 1
}

if [[ "${EUID}" -eq 0 ]]; then
    die "Não execute este build como root. Rode como usuário normal."
fi

if [[ "$(uname -m)" != "x86_64" ]]; then
    die "Este script foi preparado para x86_64."
fi

say "Diretório seguro de build: ${SAFE_BASE}"

if [[ ! -f /etc/arch-release ]]; then
    warn "Este build foi projetado e testado conceitualmente para Arch Linux."
fi

install_arch_dependencies() {
    local required_pkgs=(
        python
        python-pip
        coturn
        curl
        pax-utils
        patchelf
        desktop-file-utils
        squashfs-tools
        fuse2
    )

    local missing=()

    if command -v pacman >/dev/null 2>&1; then
        for pkg in "${required_pkgs[@]}"; do
            if ! pacman -Q "$pkg" >/dev/null 2>&1; then
                missing+=("$pkg")
            fi
        done
    fi

    if ((${#missing[@]})); then
        say "Dependências ausentes: ${missing[*]}"
        read -r -p "Instalar com pacman agora? [S/n] " answer
        answer="${answer:-S}"
        if [[ "$answer" =~ ^[SsYy]$ ]]; then
            sudo pacman -S --needed "${missing[@]}"
        else
            die "Instale as dependências e execute novamente."
        fi
    fi
}

install_arch_dependencies

PYTHON_BIN="$(command -v python3)"
TURN_BIN="$(command -v turnserver)"
command -v lddtree >/dev/null 2>&1 || die "lddtree não encontrado (pacote pax-utils)."

say "Limpando build anterior"
rm -rf "${SAFE_BASE}"
mkdir -p "${APPDIR}/usr/bin"
mkdir -p "${APPDIR}/usr/lib"
mkdir -p "${APPDIR}/usr/share/private-screen-share-server"
mkdir -p "${APPDIR}/usr/share/applications"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/scalable/apps"
mkdir -p "${TOOLS_DIR}"

# ------------------------------------------------------------
# Descobrir instalação Python do host
# ------------------------------------------------------------

PY_VER="$("${PYTHON_BIN}" - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)"

PY_STDLIB="$("${PYTHON_BIN}" - <<'PY'
import sysconfig
print(sysconfig.get_path("stdlib"))
PY
)"

PY_REAL="$(readlink -f "${PYTHON_BIN}")"

say "Empacotando Python ${PY_VER}"
cp -L "${PY_REAL}" "${APPDIR}/usr/bin/python3"
chmod +x "${APPDIR}/usr/bin/python3"

mkdir -p "${APPDIR}/usr/lib/python${PY_VER}"

# rsync seria cômodo, mas evitamos depender dele.
cp -a "${PY_STDLIB}/." "${APPDIR}/usr/lib/python${PY_VER}/"

# Não levar pacotes globais do PC para dentro do AppImage.
rm -rf "${APPDIR}/usr/lib/python${PY_VER}/site-packages" \
       "${APPDIR}/usr/lib/python${PY_VER}/dist-packages" 2>/dev/null || true

# Reduz lixo que não é necessário em runtime.
find "${APPDIR}/usr/lib/python${PY_VER}" \
    -type d \( -name '__pycache__' -o -name 'test' -o -name 'tests' \) \
    -prune -exec rm -rf '{}' + 2>/dev/null || true

# ------------------------------------------------------------
# Pacotes Python
# ------------------------------------------------------------

SITE_PACKAGES="${APPDIR}/usr/lib/pss-site-packages"
mkdir -p "${SITE_PACKAGES}"

say "Instalando dependências Python dentro do AppDir"
"${PYTHON_BIN}" -m pip install \
    --disable-pip-version-check \
    --no-cache-dir \
    --upgrade \
    --target "${SITE_PACKAGES}" \
    "fastapi>=0.115,<1" \
    "uvicorn>=0.34,<1" \
    "websockets>=15,<17" \
    "python-multipart>=0.0.20,<1"

# ------------------------------------------------------------
# Servidor de sinalização
# ------------------------------------------------------------

cat > "${APPDIR}/usr/share/private-screen-share-server/server_main.py" <<'PY'
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import mimetypes
import os
import re
import json
import secrets
import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

SERVER_VERSION = "0.6.3"
MAX_MESSAGE_BYTES = 256 * 1024
MAX_CHAT_MESSAGE_CHARS = 4000
CHAT_RATE_WINDOW = 10
CHAT_RATE_MAX = 18
MAX_MEDIA_BYTES = 8 * 1024 * 1024
MAX_FILE_BYTES = 10 * 1024 * 1024 * 1024
UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024
MAX_CHAT_ATTACHMENTS = 4
SESSION_CODE_TTL = 12 * 60 * 60
MAX_JOIN_ATTEMPTS_WINDOW = 60
MAX_JOIN_ATTEMPTS = 30
TOKEN_TTL = 90 * 24 * 60 * 60
MEDIA_ID_RE = re.compile(r"^[A-Za-z0-9_-]{12,100}$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
INVITE_RE = re.compile(r"^[A-Za-z0-9_-]{4,40}$")
ALLOWED_IMAGE_TYPES = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif",
}

_xdg_data = os.environ.get("XDG_DATA_HOME")
DATA_DIR = (Path(_xdg_data).expanduser() if _xdg_data else Path.home() / ".local" / "share") / "private-screen-share-server"
MEDIA_DIR = DATA_DIR / "media"
UPLOAD_DIR = DATA_DIR / "uploads"
DB_FILE = DATA_DIR / "opencall.sqlite3"
_xdg_config=os.environ.get("XDG_CONFIG_HOME")
CONFIG_DIR=(Path(_xdg_config).expanduser() if _xdg_config else Path.home()/".config")/"private-screen-share-server"
CONFIG_FILE=CONFIG_DIR/"server.json"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="OpenCall Local RTC Server", version=SERVER_VERSION)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"])
log = logging.getLogger("opencall.server")

PERM_ALL = [
    "manage_server", "manage_channels", "manage_roles", "manage_users", "manage_messages",
    "kick", "ban", "timeout", "pin", "mention_everyone", "upload_files", "speak", "stream",
    "camera", "create_invite", "view_admin", "delete_others_messages",
]
MEMBER_PERMS = ["upload_files", "speak", "stream", "camera", "create_invite"]
MOD_PERMS = MEMBER_PERMS + ["manage_messages", "kick", "timeout", "pin", "delete_others_messages"]
ADMIN_PERMS = PERM_ALL


def db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_FILE, timeout=30)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    con.execute("PRAGMA journal_mode=WAL")
    return con


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with db() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS users(
          id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL, avatar_media_id TEXT DEFAULT '', avatar_zoom REAL DEFAULT 1.0, avatar_x REAL DEFAULT 0.0, avatar_y REAL DEFAULT 0.0, status TEXT DEFAULT 'online', custom_status TEXT DEFAULT '',
          created_at REAL NOT NULL, last_seen REAL DEFAULT 0, disabled INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS auth_sessions(
          token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at REAL NOT NULL, created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS guilds(
          id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon_media_id TEXT DEFAULT '', owner_user_id INTEGER,
          created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS roles(
          id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
          name TEXT NOT NULL, permissions TEXT NOT NULL, priority INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS guild_members(
          guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role_id INTEGER REFERENCES roles(id), nickname TEXT DEFAULT '', joined_at REAL NOT NULL, timeout_until REAL DEFAULT 0,
          PRIMARY KEY(guild_id,user_id)
        );
        CREATE TABLE IF NOT EXISTS bans(
          guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          reason TEXT DEFAULT '', until_at REAL DEFAULT 0, created_at REAL NOT NULL, PRIMARY KEY(guild_id,user_id)
        );
        CREATE TABLE IF NOT EXISTS categories(
          id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
          name TEXT NOT NULL, position INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS channels(
          id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
          category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, name TEXT NOT NULL, type TEXT NOT NULL,
          topic TEXT DEFAULT '', position INTEGER DEFAULT 0, private INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS channel_access_roles(
          channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
          role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
          PRIMARY KEY(channel_id,role_id)
        );
        CREATE TABLE IF NOT EXISTS messages(
          id TEXT PRIMARY KEY, channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
          sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT DEFAULT '', reply_to TEXT,
          pinned INTEGER DEFAULT 0, edited_at REAL DEFAULT 0, created_at REAL NOT NULL, deleted INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_messages_channel_time ON messages(channel_id, created_at);
        CREATE TABLE IF NOT EXISTS message_attachments(
          message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE, media_id TEXT NOT NULL,
          name TEXT, mime_type TEXT, size INTEGER DEFAULT 0, kind TEXT DEFAULT 'file'
        );
        CREATE TABLE IF NOT EXISTS reactions(
          message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          emoji TEXT NOT NULL, PRIMARY KEY(message_id,user_id,emoji)
        );
        CREATE TABLE IF NOT EXISTS channel_reads(
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
          last_read_at REAL NOT NULL, PRIMARY KEY(user_id,channel_id)
        );
        CREATE TABLE IF NOT EXISTS invites(
          code TEXT PRIMARY KEY, guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE, creator_user_id INTEGER NOT NULL,
          role_id INTEGER, expires_at REAL DEFAULT 0, max_uses INTEGER DEFAULT 0, uses INTEGER DEFAULT 0, created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS dm_threads(
          id TEXT PRIMARY KEY, name TEXT DEFAULT '', created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS dm_members(
          thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          PRIMARY KEY(thread_id,user_id)
        );
        CREATE TABLE IF NOT EXISTS dm_messages(
          id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
          sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT DEFAULT '', reply_to TEXT,
          edited_at REAL DEFAULT 0, created_at REAL NOT NULL, deleted INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS dm_attachments(
          message_id TEXT NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE, media_id TEXT NOT NULL,
          name TEXT, mime_type TEXT, size INTEGER DEFAULT 0, kind TEXT DEFAULT 'file'
        );
        CREATE TABLE IF NOT EXISTS blocks(
          blocker_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, blocked_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          PRIMARY KEY(blocker_user_id,blocked_user_id)
        );
        CREATE TABLE IF NOT EXISTS audit_log(
          id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id INTEGER, actor_user_id INTEGER, action TEXT, target TEXT,
          detail TEXT, created_at REAL NOT NULL
        );
        """)
        user_cols = {r["name"] for r in con.execute("PRAGMA table_info(users)").fetchall()}
        if "avatar_zoom" not in user_cols: con.execute("ALTER TABLE users ADD COLUMN avatar_zoom REAL DEFAULT 1.0")
        if "avatar_x" not in user_cols: con.execute("ALTER TABLE users ADD COLUMN avatar_x REAL DEFAULT 0.0")
        if "avatar_y" not in user_cols: con.execute("ALTER TABLE users ADD COLUMN avatar_y REAL DEFAULT 0.0")
        count = con.execute("SELECT COUNT(*) FROM guilds").fetchone()[0]
        if count == 0:
            cur = con.execute("INSERT INTO guilds(name,created_at) VALUES(?,?)", ("OpenCall", time.time()))
            gid = cur.lastrowid
            roles = [
                (gid, "Dono", json.dumps(ADMIN_PERMS), 100),
                (gid, "Administrador", json.dumps(ADMIN_PERMS), 90),
                (gid, "Moderador", json.dumps(MOD_PERMS), 50),
                (gid, "Membro", json.dumps(MEMBER_PERMS), 10),
                (gid, "Visitante", json.dumps(["speak"]), 1),
            ]
            con.executemany("INSERT INTO roles(guild_id,name,permissions,priority) VALUES(?,?,?,?)", roles)
            cat_general = con.execute("INSERT INTO categories(guild_id,name,position) VALUES(?,?,?)", (gid, "GERAL", 0)).lastrowid
            cat_games = con.execute("INSERT INTO categories(guild_id,name,position) VALUES(?,?,?)", (gid, "JOGOS", 10)).lastrowid
            con.executemany(
                "INSERT INTO channels(guild_id,category_id,name,type,topic,position) VALUES(?,?,?,?,?,?)",
                [
                    (gid, cat_general, "geral", "text", "Conversa geral do servidor", 0),
                    (gid, cat_general, "mídia", "text", "Imagens, arquivos e links", 1),
                    (gid, cat_general, "Geral", "voice", "Canal de voz principal", 2),
                    (gid, cat_games, "jogos", "text", "Jogos e partidas", 0),
                    (gid, cat_games, "Jogos", "voice", "Canal de voz para jogos", 1),
                ],
            )


init_db()


def pbkdf2_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 240_000)
    return f"pbkdf2_sha256$240000${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        alg, rounds, salt_hex, digest_hex = encoded.split("$", 3)
        if alg != "pbkdf2_sha256": return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds)).hex()
        return hmac.compare_digest(actual, digest_hex)
    except Exception:
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_auth_token(user_id: int) -> str:
    token = secrets.token_urlsafe(42)
    with db() as con:
        con.execute("DELETE FROM auth_sessions WHERE expires_at < ?", (time.time(),))
        con.execute("INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)",
                    (token_hash(token), user_id, time.time()+TOKEN_TTL, time.time()))
    return token


def user_for_token(token: str) -> sqlite3.Row | None:
    if not token: return None
    with db() as con:
        return con.execute("""SELECT u.* FROM auth_sessions s JOIN users u ON u.id=s.user_id
                            WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0""", (token_hash(token), time.time())).fetchone()


def safe_name(value: Any, limit: int = 64) -> str:
    text = " ".join(str(value or "").strip().split())
    return text[:limit]


def media_metadata_path(media_id: str) -> Path:
    return MEDIA_DIR / f"{media_id}.json"


def read_media_record(media_id: Any) -> dict[str, Any] | None:
    mid = str(media_id or "").strip()
    if not MEDIA_ID_RE.fullmatch(mid): return None
    meta_path = media_metadata_path(mid)
    if not meta_path.exists(): return None
    try: meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception: return None
    path = MEDIA_DIR / str(meta.get("stored_name") or "")
    if not path.is_file(): return None
    meta["path"] = path
    return meta


def media_signature_matches(mime: str, content: bytes) -> bool:
    if mime == "image/png": return content.startswith(b"\x89PNG\r\n\x1a\n")
    if mime == "image/jpeg": return content.startswith(b"\xff\xd8\xff")
    if mime == "image/gif": return content.startswith((b"GIF87a", b"GIF89a"))
    if mime == "image/webp": return len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    return False


@dataclass
class Client:
    id: str
    websocket: WebSocket
    device_id: str = ""
    device_name: str = "Dispositivo"
    fingerprint: str = ""
    registered: bool = False
    upload_token: str = ""
    user_id: int | None = None
    username: str = ""
    display_name: str = ""
    avatar_media_id: str = ""
    avatar_zoom: float = 1.0
    avatar_x: float = 0.0
    avatar_y: float = 0.0
    status: str = "online"
    custom_status: str = ""
    current_guild_id: int | None = None
    host_session_code: str | None = None
    viewing_session_code: str | None = None
    voice_channel_id: int | None = None
    voice_muted: bool = False
    voice_deafened: bool = False
    voice_camera: bool = False
    voice_speaking: bool = False


@dataclass
class ScreenSession:
    code: str
    host_id: str
    guild_id: int
    channel_id: int | None
    created_at: float
    viewers: set[str] = field(default_factory=set)


clients: dict[str, Client] = {}
sessions: dict[str, ScreenSession] = {}
voice_rooms: dict[int, set[str]] = {}
chat_attempts: dict[str, list[float]] = {}
join_attempts: dict[str, list[float]] = {}
state_lock = asyncio.Lock()


def now() -> float: return time.monotonic()
def wall_time() -> float: return time.time()


def rate_limit(bucket: dict[str, list[float]], key: str, window: int, max_count: int) -> bool:
    t = now(); arr = bucket.setdefault(key, []); arr[:] = [x for x in arr if t-x < window]
    if len(arr) >= max_count: return False
    arr.append(t); return True


def connected_user_clients(user_id: int) -> list[Client]:
    return [c for c in clients.values() if c.registered and c.user_id == user_id]


def client_from_upload_token(token: str) -> Client | None:
    if not token: return None
    for c in clients.values():
        if c.registered and c.user_id and c.upload_token and secrets.compare_digest(c.upload_token, token): return c
    return None


def guild_membership(user_id: int, guild_id: int) -> sqlite3.Row | None:
    with db() as con:
        return con.execute("""SELECT gm.*,r.name role_name,r.permissions,r.priority,g.name guild_name
                              FROM guild_members gm LEFT JOIN roles r ON r.id=gm.role_id JOIN guilds g ON g.id=gm.guild_id
                              WHERE gm.user_id=? AND gm.guild_id=?""", (user_id,guild_id)).fetchone()


def perms_for(user_id: int, guild_id: int) -> set[str]:
    row = guild_membership(user_id, guild_id)
    if not row: return set()
    try: return set(json.loads(row["permissions"] or "[]"))
    except Exception: return set()


def has_perm(client: Client, perm: str, guild_id: int | None = None) -> bool:
    if not client.user_id: return False
    gid = int(guild_id or client.current_guild_id or 0)
    return perm in perms_for(client.user_id, gid)


def is_timed_out(user_id: int, guild_id: int) -> bool:
    row = guild_membership(user_id,guild_id)
    return bool(row and float(row["timeout_until"] or 0) > time.time())


def is_banned(user_id: int, guild_id: int) -> bool:
    with db() as con:
        row = con.execute("SELECT until_at FROM bans WHERE guild_id=? AND user_id=?", (guild_id,user_id)).fetchone()
        if not row: return False
        until = float(row[0] or 0)
        if until and until < time.time():
            con.execute("DELETE FROM bans WHERE guild_id=? AND user_id=?", (guild_id,user_id)); return False
        return True


def public_user_row(row: sqlite3.Row | dict[str,Any]) -> dict[str,Any]:
    return {
        "user_id": int(row["id"]), "username": row["username"], "display_name": row["display_name"],
        "avatar_media_id": row["avatar_media_id"] or "",
        "avatar_zoom": float(row["avatar_zoom"] or 1.0), "avatar_x": float(row["avatar_x"] or 0.0), "avatar_y": float(row["avatar_y"] or 0.0),
        "status": row["status"] or "offline", "custom_status": row["custom_status"] or "",
    }


def client_public_payload(c: Client) -> dict[str,Any]:
    p = {
        "client_id": c.id, "user_id": c.user_id, "username": c.username, "device_name": c.display_name or c.device_name,
        "display_name": c.display_name or c.device_name, "avatar_media_id": c.avatar_media_id,
        "avatar_zoom": c.avatar_zoom, "avatar_x": c.avatar_x, "avatar_y": c.avatar_y, "status": c.status,
        "custom_status": c.custom_status,
    }
    if c.voice_channel_id:
        p["voice"] = {"channel_id": c.voice_channel_id, "muted": c.voice_muted, "deafened": c.voice_deafened,
                      "camera": c.voice_camera, "speaking": c.voice_speaking}
    if c.host_session_code and c.host_session_code in sessions:
        s = sessions[c.host_session_code]
        p["stream"] = {"session_code": s.code, "viewer_count": len(s.viewers), "channel_id": s.channel_id,
                       "started_at": wall_time() - max(0, now()-s.created_at)}
    if c.viewing_session_code and c.viewing_session_code in sessions:
        s = sessions[c.viewing_session_code]
        p["watching"] = {"host_id": s.host_id, "session_code": s.code}
    return p


async def send_json(client_id: str, payload: dict[str,Any]) -> bool:
    c = clients.get(client_id)
    if not c: return False
    try:
        await c.websocket.send_text(json.dumps(payload, separators=(",",":"), ensure_ascii=False)); return True
    except Exception: return False


async def send_to_user(user_id: int, payload: dict[str,Any]) -> None:
    for c in connected_user_clients(user_id): await send_json(c.id,payload)


def users_in_guild(guild_id: int) -> set[int]:
    with db() as con:
        return {int(r[0]) for r in con.execute("SELECT user_id FROM guild_members WHERE guild_id=?", (guild_id,)).fetchall()}


async def broadcast_guild(guild_id: int, payload: dict[str,Any], exclude_client: str | None = None) -> None:
    members = users_in_guild(guild_id)
    for c in list(clients.values()):
        if c.registered and c.user_id in members and c.id != exclude_client: await send_json(c.id,payload)


async def broadcast_presence(guild_id: int) -> None:
    members = users_in_guild(guild_id)
    by_user: dict[int,dict[str,Any]] = {}
    for c in clients.values():
        if not c.registered or c.user_id not in members: continue
        payload = client_public_payload(c)
        uid = int(c.user_id)
        if uid not in by_user: by_user[uid] = payload
        else:
            # merge useful active states across devices
            for key in ("voice","stream","watching"):
                if key in payload: by_user[uid][key] = payload[key]
    with db() as con:
        # include offline guild members
        rows = con.execute("""SELECT u.*,gm.role_id,r.name role_name FROM guild_members gm JOIN users u ON u.id=gm.user_id
                              LEFT JOIN roles r ON r.id=gm.role_id WHERE gm.guild_id=? ORDER BY u.display_name COLLATE NOCASE""", (guild_id,)).fetchall()
    out=[]
    for row in rows:
        uid=int(row["id"])
        p = by_user.get(uid) or public_user_row(row)
        p["role_id"] = row["role_id"]; p["role_name"] = row["role_name"] or "Membro"
        if uid not in by_user: p["status"]="offline"
        out.append(p)
    await broadcast_guild(guild_id,{"type":"presence_update","guild_id":guild_id,"users":out,"server_time":wall_time()})


def channel_row(channel_id: Any) -> sqlite3.Row | None:
    try: cid=int(channel_id)
    except Exception: return None
    with db() as con: return con.execute("SELECT * FROM channels WHERE id=?",(cid,)).fetchone()


def channel_access(client: Client, channel_id: Any, expected_type: str | None = None) -> sqlite3.Row | None:
    row=channel_row(channel_id)
    if not row or not client.user_id: return None
    if expected_type and row["type"]!=expected_type: return None
    membership=guild_membership(client.user_id,int(row["guild_id"]))
    if not membership: return None
    if is_banned(client.user_id,int(row["guild_id"])): return None
    if bool(row["private"]) and not has_perm(client,"manage_channels",int(row["guild_id"])):
        with db() as con:
            allowed=con.execute("SELECT 1 FROM channel_access_roles WHERE channel_id=? AND role_id=?",(row["id"],membership["role_id"])).fetchone()
        if not allowed:return None
    return row


def role_payloads(guild_id:int) -> list[dict[str,Any]]:
    with db() as con: rows=con.execute("SELECT * FROM roles WHERE guild_id=? ORDER BY priority DESC,id",(guild_id,)).fetchall()
    out=[]
    for r in rows:
        try: permissions=json.loads(r["permissions"] or "[]")
        except Exception: permissions=[]
        out.append({"id":r["id"],"name":r["name"],"permissions":permissions,"priority":r["priority"]})
    return out


def guild_structure(guild_id:int) -> dict[str,Any]:
    with db() as con:
        g=con.execute("SELECT * FROM guilds WHERE id=?",(guild_id,)).fetchone()
        cats=con.execute("SELECT * FROM categories WHERE guild_id=? ORDER BY position,id",(guild_id,)).fetchall()
        chs=con.execute("SELECT * FROM channels WHERE guild_id=? ORDER BY position,id",(guild_id,)).fetchall()
    channel_payloads=[]
    with db() as con:
        for x in chs:
            d=dict(x); d["allowed_role_ids"]=[int(r[0]) for r in con.execute("SELECT role_id FROM channel_access_roles WHERE channel_id=?",(x["id"],)).fetchall()]; channel_payloads.append(d)
    return {"guild":dict(g) if g else None,"categories":[dict(x) for x in cats],"channels":channel_payloads,"roles":role_payloads(guild_id)}


def guilds_for_user(user_id:int) -> list[dict[str,Any]]:
    with db() as con:
        rows=con.execute("""SELECT g.*,gm.role_id,r.name role_name,r.permissions FROM guild_members gm JOIN guilds g ON g.id=gm.guild_id
                            LEFT JOIN roles r ON r.id=gm.role_id WHERE gm.user_id=? ORDER BY g.id""",(user_id,)).fetchall()
    out=[]
    for r in rows:
        try:p=json.loads(r["permissions"] or "[]")
        except Exception:p=[]
        out.append({"id":r["id"],"name":r["name"],"icon_media_id":r["icon_media_id"] or "","role_id":r["role_id"],"role_name":r["role_name"],"permissions":p})
    return out


def unread_counts(user_id:int,guild_id:int)->dict[str,int]:
    with db() as con:
        rows=con.execute("""SELECT c.id, COALESCE(cr.last_read_at,0) lr,
            (SELECT COUNT(*) FROM messages m WHERE m.channel_id=c.id AND m.deleted=0 AND m.created_at>COALESCE(cr.last_read_at,0) AND m.sender_user_id<>?) cnt
            FROM channels c LEFT JOIN channel_reads cr ON cr.channel_id=c.id AND cr.user_id=? WHERE c.guild_id=? AND c.type='text'""",
            (user_id,user_id,guild_id)).fetchall()
    return {str(r["id"]):int(r["cnt"]) for r in rows}


def bootstrap_payload(client:Client,guild_id:int|None=None)->dict[str,Any]:
    assert client.user_id
    guilds=guilds_for_user(client.user_id)
    if not guilds:
        return {"type":"bootstrap","guilds":[],"profile":{"user_id":client.user_id,"username":client.username,"display_name":client.display_name,"avatar_media_id":client.avatar_media_id,"avatar_zoom":client.avatar_zoom,"avatar_x":client.avatar_x,"avatar_y":client.avatar_y,"status":client.status,"custom_status":client.custom_status}}
    gids={g["id"] for g in guilds}
    gid=int(guild_id or client.current_guild_id or guilds[0]["id"])
    if gid not in gids: gid=guilds[0]["id"]
    client.current_guild_id=gid
    structure=guild_structure(gid)
    if "manage_channels" not in perms_for(client.user_id,gid):
        membership=guild_membership(client.user_id,gid); role_id=int(membership["role_id"] or 0) if membership else 0
        structure["channels"]=[c for c in structure["channels"] if not c.get("private") or role_id in c.get("allowed_role_ids",[])]
        used={c.get("category_id") for c in structure["channels"]}; structure["categories"]=[cat for cat in structure["categories"] if cat["id"] in used]
    return {"type":"bootstrap","guilds":guilds,"current_guild_id":gid,"structure":structure,
            "profile":{"user_id":client.user_id,"username":client.username,"display_name":client.display_name,"avatar_media_id":client.avatar_media_id,"avatar_zoom":client.avatar_zoom,"avatar_x":client.avatar_x,"avatar_y":client.avatar_y,"status":client.status,"custom_status":client.custom_status},
            "unread":unread_counts(client.user_id,gid)}


def server_option(name:str,default:Any=None)->Any:
    try:
        cfg=json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        return cfg.get(name,default)
    except Exception:return default


def ensure_default_membership(user_id:int)->int:
    with db() as con:
        gid=int(con.execute("SELECT id FROM guilds ORDER BY id LIMIT 1").fetchone()[0])
        if is_banned(user_id,gid): return gid
        existing=con.execute("SELECT 1 FROM guild_members WHERE guild_id=? AND user_id=?",(gid,user_id)).fetchone()
        if not existing:
            member_count=con.execute("SELECT COUNT(*) FROM guild_members WHERE guild_id=?",(gid,)).fetchone()[0]
            # Primeiro usuário vira Dono. Depois disso, o padrão é estilo Discord: entrada por convite.
            if member_count==0 or str(server_option("registration_mode","invite")).lower()=="open":
                role_name="Dono" if member_count==0 else "Membro"
                role=con.execute("SELECT id FROM roles WHERE guild_id=? AND name=?",(gid,role_name)).fetchone()
                con.execute("INSERT INTO guild_members(guild_id,user_id,role_id,joined_at) VALUES(?,?,?,?)",(gid,user_id,role[0] if role else None,time.time()))
                if member_count==0: con.execute("UPDATE guilds SET owner_user_id=? WHERE id=?",(user_id,gid))
        return gid


def audit(gid:int|None,actor:int|None,action:str,target:str="",detail:str="") -> None:
    with db() as con: con.execute("INSERT INTO audit_log(guild_id,actor_user_id,action,target,detail,created_at) VALUES(?,?,?,?,?,?)",(gid,actor,action,target,detail,time.time()))


def serialize_message(row:sqlite3.Row, include_reactions=True)->dict[str,Any]:
    with db() as con:
        u=con.execute("SELECT * FROM users WHERE id=?",(row["sender_user_id"],)).fetchone()
        atts=con.execute("SELECT media_id,name,mime_type,size,kind FROM message_attachments WHERE message_id=?",(row["id"],)).fetchall()
        reply=None
        if row["reply_to"]:
            rr=con.execute("SELECT m.id,m.content,u.display_name FROM messages m JOIN users u ON u.id=m.sender_user_id WHERE m.id=?",(row["reply_to"],)).fetchone()
            if rr: reply={"id":rr["id"],"content":rr["content"],"display_name":rr["display_name"]}
        reactions=[]
        if include_reactions:
            rs=con.execute("""SELECT emoji,COUNT(*) count,GROUP_CONCAT(user_id) users FROM reactions WHERE message_id=? GROUP BY emoji""",(row["id"],)).fetchall()
            reactions=[{"emoji":r["emoji"],"count":r["count"],"user_ids":[int(x) for x in str(r["users"] or "").split(',') if x]} for r in rs]
    return {"type":"chat_message","id":row["id"],"channel_id":row["channel_id"],"sender":public_user_row(u),"content":"" if row["deleted"] else row["content"],
            "attachments":[] if row["deleted"] else [dict(a) for a in atts],"reply":reply,"reply_to":row["reply_to"],"pinned":bool(row["pinned"]),
            "edited_at":row["edited_at"],"created_at":row["created_at"],"deleted":bool(row["deleted"]),"reactions":reactions}


def serialize_dm(row:sqlite3.Row)->dict[str,Any]:
    with db() as con:
        u=con.execute("SELECT * FROM users WHERE id=?",(row["sender_user_id"],)).fetchone()
        atts=con.execute("SELECT media_id,name,mime_type,size,kind FROM dm_attachments WHERE message_id=?",(row["id"],)).fetchall()
    return {"type":"dm_message","id":row["id"],"thread_id":row["thread_id"],"sender":public_user_row(u),"content":"" if row["deleted"] else row["content"],
            "attachments":[] if row["deleted"] else [dict(a) for a in atts],"reply_to":row["reply_to"],"edited_at":row["edited_at"],"created_at":row["created_at"],"deleted":bool(row["deleted"])}


def validate_attachments(raw:Any)->list[dict[str,Any]]:
    out=[]
    if not isinstance(raw,list): return out
    for item in raw[:MAX_CHAT_ATTACHMENTS]:
        if not isinstance(item,dict): continue
        rec=read_media_record(item.get("media_id"))
        if not rec: continue
        out.append({"media_id":rec["media_id"],"name":rec["name"],"mime_type":rec["mime_type"],"size":int(rec["size"]),"kind":rec.get("kind") or "file"})
    return out


def media_record_for_file(path:Path,name:str,mime:str,size:int,owner_user_id:int,purpose="file",kind="file")->dict[str,Any]:
    mid=secrets.token_urlsafe(18); stored=f"{mid}.bin" if kind=="file" else f"{mid}{ALLOWED_IMAGE_TYPES.get(mime,'.bin')}"
    final=MEDIA_DIR/stored; path.replace(final)
    rec={"media_id":mid,"stored_name":stored,"name":Path(name).name[:180] or "arquivo","mime_type":mime[:160],"size":size,
         "purpose":purpose,"kind":kind,"owner_user_id":owner_user_id,"created_at":time.time()}
    media_metadata_path(mid).write_text(json.dumps(rec,ensure_ascii=False),encoding="utf-8")
    return rec


@app.post("/upload/start")
async def upload_start(request:Request,x_opencall_token:str=Header(default=""),x_opencall_file_name:str=Header(default="arquivo"),x_opencall_file_size:str=Header(default="0"),x_opencall_file_type:str=Header(default="application/octet-stream")):
    c=client_from_upload_token(x_opencall_token)
    if not c or not c.user_id: raise HTTPException(401,"Não autenticado")
    try:size=int(x_opencall_file_size)
    except: raise HTTPException(400,"Tamanho inválido")
    if size<=0 or size>MAX_FILE_BYTES: raise HTTPException(413,"Arquivo maior que 10 GB ou vazio")
    upload_id=secrets.token_urlsafe(18); temp=UPLOAD_DIR/f"{upload_id}.part"; temp.touch()
    meta={"upload_id":upload_id,"owner_user_id":c.user_id,"name":unquote(x_opencall_file_name)[:180],"mime_type":x_opencall_file_type[:160],"size":size,"offset":0,"created_at":time.time()}
    (UPLOAD_DIR/f"{upload_id}.json").write_text(json.dumps(meta,ensure_ascii=False),encoding="utf-8")
    return {"upload_id":upload_id,"offset":0,"chunk_size":UPLOAD_CHUNK_BYTES}


def upload_meta(upload_id:str)->dict[str,Any]|None:
    if not MEDIA_ID_RE.fullmatch(upload_id): return None
    p=UPLOAD_DIR/f"{upload_id}.json"
    try:return json.loads(p.read_text(encoding="utf-8"))
    except:return None


@app.post("/upload/{upload_id}/chunk")
async def upload_chunk(upload_id:str,request:Request,x_opencall_token:str=Header(default=""),x_opencall_offset:str=Header(default="0")):
    c=client_from_upload_token(x_opencall_token); meta=upload_meta(upload_id)
    if not c or not c.user_id or not meta or int(meta.get("owner_user_id",0))!=c.user_id: raise HTTPException(401,"Upload não autorizado")
    try:offset=int(x_opencall_offset)
    except: raise HTTPException(400,"Offset inválido")
    part=UPLOAD_DIR/f"{upload_id}.part"; actual=part.stat().st_size if part.exists() else 0
    if offset!=actual: return {"upload_id":upload_id,"offset":actual,"mismatch":True}
    total=actual
    with part.open("ab") as f:
        async for chunk in request.stream():
            if not chunk: continue
            total+=len(chunk)
            if total>int(meta["size"]) or total>MAX_FILE_BYTES: raise HTTPException(413,"Upload excedeu tamanho informado")
            f.write(chunk)
    meta["offset"]=total; (UPLOAD_DIR/f"{upload_id}.json").write_text(json.dumps(meta,ensure_ascii=False),encoding="utf-8")
    return {"upload_id":upload_id,"offset":total,"complete":total==int(meta["size"])}


@app.post("/upload/{upload_id}/finish")
async def upload_finish(upload_id:str,x_opencall_token:str=Header(default="")):
    c=client_from_upload_token(x_opencall_token); meta=upload_meta(upload_id)
    if not c or not c.user_id or not meta or int(meta.get("owner_user_id",0))!=c.user_id: raise HTTPException(401,"Upload não autorizado")
    part=UPLOAD_DIR/f"{upload_id}.part"; actual=part.stat().st_size if part.exists() else 0
    if actual!=int(meta["size"]): raise HTTPException(409,f"Upload incompleto: {actual}/{meta['size']}")
    rec=media_record_for_file(part,meta["name"],meta["mime_type"],actual,c.user_id)
    (UPLOAD_DIR/f"{upload_id}.json").unlink(missing_ok=True)
    return {k:rec[k] for k in ("media_id","name","mime_type","size","purpose","kind","created_at")}


@app.get("/upload/{upload_id}/status")
async def upload_status(upload_id:str,token:str=""):
    c=client_from_upload_token(token); meta=upload_meta(upload_id)
    if not c or not c.user_id or not meta or int(meta.get("owner_user_id",0))!=c.user_id: raise HTTPException(401,"Não autorizado")
    p=UPLOAD_DIR/f"{upload_id}.part"; return {"upload_id":upload_id,"offset":p.stat().st_size if p.exists() else 0,"size":meta["size"]}


# Compatibilidade: upload grande em uma única requisição
@app.post("/file")
async def upload_large_file(request:Request,x_opencall_token:str=Header(default=""),x_opencall_file_name:str=Header(default="arquivo")):
    c=client_from_upload_token(x_opencall_token)
    if not c or not c.user_id: raise HTTPException(401,"Não autenticado")
    tmp=UPLOAD_DIR/f"legacy-{secrets.token_urlsafe(12)}.part"; total=0
    try:
        with tmp.open("wb") as f:
            async for chunk in request.stream():
                if not chunk: continue
                total+=len(chunk)
                if total>MAX_FILE_BYTES: raise HTTPException(413,"Arquivo maior que 10 GB")
                f.write(chunk)
        if total<=0: raise HTTPException(400,"Arquivo vazio")
        mime=str(request.headers.get("content-type") or "application/octet-stream").split(";",1)[0]
        rec=media_record_for_file(tmp,unquote(x_opencall_file_name),mime,total,c.user_id)
        return {k:rec[k] for k in ("media_id","name","mime_type","size","purpose","kind","created_at")}
    except Exception:
        tmp.unlink(missing_ok=True); raise


@app.post("/media")
async def upload_media(file:UploadFile=File(...),purpose:str=Form("chat"),x_opencall_token:str=Header(default="")):
    c=client_from_upload_token(x_opencall_token)
    if not c or not c.user_id: raise HTTPException(401,"Não autenticado")
    mime=str(file.content_type or "application/octet-stream").lower(); ext=ALLOWED_IMAGE_TYPES.get(mime)
    if not ext: raise HTTPException(415,"Apenas PNG, JPEG, WebP e GIF")
    tmp=UPLOAD_DIR/f"img-{secrets.token_urlsafe(12)}.part"; total=0; header=b""
    try:
        with tmp.open("wb") as f:
            while True:
                chunk=await file.read(1024*1024)
                if not chunk: break
                total+=len(chunk)
                if total>MAX_MEDIA_BYTES: raise HTTPException(413,"Imagem maior que 8 MB")
                if len(header)<32: header=(header+chunk)[:32]
                f.write(chunk)
        if total<=0 or not media_signature_matches(mime,header): raise HTTPException(415,"Imagem inválida")
        mid=secrets.token_urlsafe(18); stored=f"{mid}{ext}"; final=MEDIA_DIR/stored; tmp.replace(final)
        rec={"media_id":mid,"stored_name":stored,"name":Path(file.filename or f"imagem{ext}").name[:180],"mime_type":mime,"size":total,
             "purpose":purpose[:32],"kind":"image","owner_user_id":c.user_id,"created_at":time.time()}
        media_metadata_path(mid).write_text(json.dumps(rec,ensure_ascii=False),encoding="utf-8")
        return {k:rec[k] for k in ("media_id","name","mime_type","size","purpose","kind","created_at")}
    except Exception:
        tmp.unlink(missing_ok=True); raise


@app.get("/media/{media_id}")
async def get_media(media_id:str,token:str="",download:bool=False):
    c=client_from_upload_token(token)
    if not c or not c.user_id: raise HTTPException(401,"Conecte ao mesmo servidor")
    rec=read_media_record(media_id)
    if not rec: raise HTTPException(404,"Arquivo não encontrado")
    return FileResponse(rec["path"],media_type=rec["mime_type"],filename=rec["name"],content_disposition_type="attachment" if download or rec.get("kind")=="file" else "inline")


def rtc_config_payload() -> dict[str, Any]:
    # Entrega as credenciais TURN somente depois da autenticação. O cliente usa
    # o mesmo host do WebSocket e tenta UDP e TCP automaticamente.
    cfg: dict[str, Any] = {}
    try:
        if CONFIG_FILE.exists():
            raw = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            if isinstance(raw, dict): cfg = raw
    except Exception:
        cfg = {}
    return {
        "turn_enabled": bool(cfg.get("turn_enabled", True)),
        "turn_port": int(cfg.get("turn_port", 3478) or 3478),
        "turn_username": str(cfg.get("turn_username") or ""),
        "turn_password": str(cfg.get("turn_password") or ""),
        "relay_min_port": int(cfg.get("turn_relay_min_port", 49160) or 49160),
        "relay_max_port": int(cfg.get("turn_relay_max_port", 49200) or 49200),
        "external_ip_configured": bool(str(cfg.get("turn_external_ip") or "").strip()),
    }


async def auth_client(client:Client,user:sqlite3.Row,token:str|None=None)->None:
    client.user_id=int(user["id"]); client.username=user["username"]; client.display_name=user["display_name"]
    client.avatar_media_id=user["avatar_media_id"] or ""; client.avatar_zoom=float(user["avatar_zoom"] or 1.0); client.avatar_x=float(user["avatar_x"] or 0.0); client.avatar_y=float(user["avatar_y"] or 0.0); client.status=user["status"] or "online"; client.custom_status=user["custom_status"] or ""
    gid=ensure_default_membership(client.user_id); client.current_guild_id=gid
    token=token or issue_auth_token(client.user_id)
    await send_json(client.id,{"type":"auth_ok","auth_token":token,"profile":public_user_row(user),"rtc_config":rtc_config_payload()})
    await send_json(client.id,bootstrap_payload(client,gid))
    for g in guilds_for_user(client.user_id): await broadcast_presence(int(g["id"]))


async def leave_voice(client:Client,notify=True)->None:
    cid=client.voice_channel_id
    if not cid:return
    participants=voice_rooms.setdefault(cid,set()); participants.discard(client.id)
    old=cid; client.voice_channel_id=None; client.voice_muted=False; client.voice_deafened=False; client.voice_camera=False; client.voice_speaking=False
    for pid in list(participants): await send_json(pid,{"type":"voice_participant_left","channel_id":old,"client_id":client.id,"user_id":client.user_id})
    if notify: await send_json(client.id,{"type":"voice_left","channel_id":old})
    row=channel_row(old)
    if row: await broadcast_presence(int(row["guild_id"]))


async def end_screen(code:str,reason="session_ended")->None:
    s=sessions.pop(code,None)
    if not s:return
    host=clients.get(s.host_id)
    if host and host.host_session_code==code: host.host_session_code=None
    for vid in list(s.viewers):
        v=clients.get(vid)
        if v and v.viewing_session_code==code:v.viewing_session_code=None
        await send_json(vid,{"type":"session_ended","code":code,"reason":reason})
    await send_json(s.host_id,{"type":"session_ended","code":code,"reason":reason})
    await broadcast_presence(s.guild_id)


async def leave_view(client:Client,notify=True)->None:
    code=client.viewing_session_code
    if not code:return
    s=sessions.get(code); client.viewing_session_code=None
    if s:
        s.viewers.discard(client.id); await send_json(s.host_id,{"type":"viewer_left","viewer_id":client.id})
        await broadcast_presence(s.guild_id)
    if notify: await send_json(client.id,{"type":"left_session","code":code})


async def remove_client(cid:str)->None:
    c=clients.get(cid)
    if not c:return
    gids=[g["id"] for g in guilds_for_user(c.user_id)] if c.user_id else []
    if c.voice_channel_id: await leave_voice(c,False)
    if c.host_session_code: await end_screen(c.host_session_code,"host_disconnected")
    if c.viewing_session_code: await leave_view(c,False)
    clients.pop(cid,None); chat_attempts.pop(cid,None); join_attempts.pop(cid,None)
    for gid in gids: await broadcast_presence(int(gid))


async def send_bootstrap(client:Client,guild_id:Any=None)->None:
    if client.user_id: await send_json(client.id,bootstrap_payload(client,int(guild_id) if guild_id else None))


async def handle_message(client:Client,m:dict[str,Any])->None:
    t=str(m.get("type") or "")
    if t=="hello":
        client.device_id=str(m.get("device_id") or "")[:256]; client.device_name=safe_name(m.get("device_name") or "Dispositivo",128); client.fingerprint=str(m.get("fingerprint") or "")[:256]
        client.upload_token=secrets.token_urlsafe(32); client.registered=True
        await send_json(client.id,{"type":"hello_ok","client_id":client.id,"server_version":SERVER_VERSION,"upload_token":client.upload_token,
            "features":{"auth":True,"persistent_chat":True,"guilds":True,"categories":True,"dynamic_channels":True,"roles":True,"permissions":True,
            "dms":True,"message_edit":True,"message_delete":True,"replies":True,"reactions":True,"pins":True,"search":True,"presence":True,
            "notifications":True,"voice":True,"camera":True,"speaking":True,"individual_volume":True,"screen_share":True,"multi_stream":True,
            "media_upload":True,"resumable_upload":True,"max_file_bytes":MAX_FILE_BYTES,"admin":True,"invites":True,"moderation":True,"avatar_framing":True,"rtc_auto_config":True}})
        token=str(m.get("auth_token") or "")
        u=user_for_token(token)
        if u: await auth_client(client,u,token)
        else: await send_json(client.id,{"type":"auth_required"})
        return
    if t=="ping": await send_json(client.id,{"type":"pong","time":time.time()}); return
    if t=="auth_register":
        username=str(m.get("username") or "").strip().lower(); password=str(m.get("password") or ""); display=safe_name(m.get("display_name") or username,64)
        if not USERNAME_RE.fullmatch(username): await send_json(client.id,{"type":"auth_error","error":"invalid_username"}); return
        if len(password)<6: await send_json(client.id,{"type":"auth_error","error":"weak_password"}); return
        try:
            with db() as con:
                cur=con.execute("INSERT INTO users(username,password_hash,display_name,created_at,last_seen) VALUES(?,?,?,?,?)",(username,pbkdf2_hash(password),display,time.time(),time.time()))
                uid=cur.lastrowid; u=con.execute("SELECT * FROM users WHERE id=?",(uid,)).fetchone()
            ensure_default_membership(uid); await auth_client(client,u); return
        except sqlite3.IntegrityError: await send_json(client.id,{"type":"auth_error","error":"username_taken"}); return
    if t=="auth_login":
        username=str(m.get("username") or "").strip().lower(); password=str(m.get("password") or "")
        with db() as con:u=con.execute("SELECT * FROM users WHERE username=?",(username,)).fetchone()
        if not u or not verify_password(password,u["password_hash"]): await send_json(client.id,{"type":"auth_error","error":"bad_credentials"}); return
        await auth_client(client,u); return
    if t=="invite_accept" and client.user_id:
        code=str(m.get("code") or "").strip()
        with db() as con:
            inv=con.execute("SELECT * FROM invites WHERE code=?",(code,)).fetchone()
            if not inv or (inv["expires_at"] and inv["expires_at"]<time.time()) or (inv["max_uses"] and inv["uses"]>=inv["max_uses"]):
                await send_json(client.id,{"type":"error","error":"invalid_invite"}); return
            gid=int(inv["guild_id"])
            if is_banned(client.user_id,gid): await send_json(client.id,{"type":"error","error":"banned"}); return
            role_id=inv["role_id"] or con.execute("SELECT id FROM roles WHERE guild_id=? AND name='Membro'",(gid,)).fetchone()[0]
            con.execute("INSERT OR IGNORE INTO guild_members(guild_id,user_id,role_id,joined_at) VALUES(?,?,?,?)",(gid,client.user_id,role_id,time.time()))
            con.execute("UPDATE invites SET uses=uses+1 WHERE code=?",(code,))
        client.current_guild_id=gid; await send_bootstrap(client,gid); await broadcast_presence(gid); return
    if not client.user_id:
        await send_json(client.id,{"type":"error","error":"auth_required"}); return
    if t=="logout":
        client.user_id=None; await send_json(client.id,{"type":"auth_required"}); return
    if t=="bootstrap": await send_bootstrap(client,m.get("guild_id")); return
    if t=="guild_select": await send_bootstrap(client,m.get("guild_id")); return
    if t=="guild_create":
        name=safe_name(m.get("name") or "Novo servidor",64)
        with db() as con:
            gid=con.execute("INSERT INTO guilds(name,owner_user_id,created_at) VALUES(?,?,?)",(name,client.user_id,time.time())).lastrowid
            role_defs=[("Dono",ADMIN_PERMS,100),("Administrador",ADMIN_PERMS,90),("Moderador",MOD_PERMS,50),("Membro",MEMBER_PERMS,10),("Visitante",["speak"],1)]
            ids={}
            for rn,ps,pri in role_defs: ids[rn]=con.execute("INSERT INTO roles(guild_id,name,permissions,priority) VALUES(?,?,?,?)",(gid,rn,json.dumps(ps),pri)).lastrowid
            con.execute("INSERT INTO guild_members(guild_id,user_id,role_id,joined_at) VALUES(?,?,?,?)",(gid,client.user_id,ids["Dono"],time.time()))
            cat=con.execute("INSERT INTO categories(guild_id,name,position) VALUES(?,?,0)",(gid,"GERAL")).lastrowid
            con.execute("INSERT INTO channels(guild_id,category_id,name,type,topic,position) VALUES(?,?,?,?,?,0)",(gid,cat,"geral","text","Conversa geral"))
            con.execute("INSERT INTO channels(guild_id,category_id,name,type,topic,position) VALUES(?,?,?,?,?,1)",(gid,cat,"Geral","voice","Canal de voz"))
        client.current_guild_id=gid; await send_bootstrap(client,gid); await broadcast_presence(gid); return
    gid=int(m.get("guild_id") or client.current_guild_id or 0)
    if gid and not guild_membership(client.user_id,gid): await send_json(client.id,{"type":"error","error":"not_guild_member"}); return
    if t in {"get_presence","list_users"}: await broadcast_presence(gid); return
    if t=="profile_update":
        display=safe_name(m.get("display_name") or client.display_name,64); status=str(m.get("status") or client.status)
        if status not in {"online","idle","dnd","invisible"}:status="online"
        custom=safe_name(m.get("custom_status") or "",120); avatar=str(m.get("avatar_media_id") or "")
        if avatar and not read_media_record(avatar): avatar=""
        try: avatar_zoom=max(0.5,min(4.0,float(m.get("avatar_zoom",client.avatar_zoom))))
        except Exception: avatar_zoom=client.avatar_zoom
        try: avatar_x=max(-100.0,min(100.0,float(m.get("avatar_x",client.avatar_x))))
        except Exception: avatar_x=client.avatar_x
        try: avatar_y=max(-100.0,min(100.0,float(m.get("avatar_y",client.avatar_y))))
        except Exception: avatar_y=client.avatar_y
        with db() as con: con.execute("UPDATE users SET display_name=?,avatar_media_id=?,avatar_zoom=?,avatar_x=?,avatar_y=?,status=?,custom_status=? WHERE id=?",(display,avatar,avatar_zoom,avatar_x,avatar_y,status,custom,client.user_id))
        client.display_name=display; client.avatar_media_id=avatar; client.avatar_zoom=avatar_zoom; client.avatar_x=avatar_x; client.avatar_y=avatar_y; client.status=status; client.custom_status=custom
        for g in guilds_for_user(client.user_id): await broadcast_presence(int(g["id"]))
        await send_json(client.id,{"type":"profile_updated"}); return
    if t=="password_change":
        old=str(m.get("old_password") or ""); new=str(m.get("new_password") or "")
        with db() as con:u=con.execute("SELECT * FROM users WHERE id=?",(client.user_id,)).fetchone()
        if not verify_password(old,u["password_hash"]): await send_json(client.id,{"type":"error","error":"bad_password"}); return
        if len(new)<6: await send_json(client.id,{"type":"error","error":"weak_password"}); return
        with db() as con: con.execute("UPDATE users SET password_hash=? WHERE id=?",(pbkdf2_hash(new),client.user_id))
        await send_json(client.id,{"type":"password_changed"}); return
    if t=="category_create":
        if not has_perm(client,"manage_channels",gid): await send_json(client.id,{"type":"error","error":"forbidden"}); return
        name=safe_name(m.get("name") or "NOVA CATEGORIA",48)
        with db() as con: con.execute("INSERT INTO categories(guild_id,name,position) VALUES(?,?,COALESCE((SELECT MAX(position)+1 FROM categories WHERE guild_id=?),0))",(gid,name,gid))
        audit(gid,client.user_id,"category_create",name); await broadcast_guild(gid,{"type":"structure_changed"}); return
    if t=="channel_create":
        if not has_perm(client,"manage_channels",gid): await send_json(client.id,{"type":"error","error":"forbidden"}); return
        ctype=str(m.get("channel_type") or "text");
        if ctype not in {"text","voice"}:ctype="text"
        name=safe_name(m.get("name") or ("novo-canal" if ctype=="text" else "Novo canal"),48); cat=m.get("category_id")
        with db() as con: con.execute("INSERT INTO channels(guild_id,category_id,name,type,topic,position) VALUES(?,?,?,?,?,COALESCE((SELECT MAX(position)+1 FROM channels WHERE guild_id=?),0))",(gid,int(cat) if cat else None,name,ctype,safe_name(m.get("topic") or "",160),gid))
        audit(gid,client.user_id,"channel_create",name,ctype); await broadcast_guild(gid,{"type":"structure_changed"}); return
    if t=="channel_update":
        if not has_perm(client,"manage_channels",gid): await send_json(client.id,{"type":"error","error":"forbidden"}); return
        row=channel_access(client,m.get("channel_id"));
        if not row or int(row["guild_id"])!=gid:return
        private=int(bool(m.get("private",row["private"])))
        allowed=[int(x) for x in (m.get("allowed_role_ids") or []) if str(x).isdigit()]
        with db() as con:
            con.execute("UPDATE channels SET name=?,topic=?,private=? WHERE id=?",(safe_name(m.get("name") or row["name"],48),safe_name(m.get("topic") or row["topic"],160),private,row["id"]))
            con.execute("DELETE FROM channel_access_roles WHERE channel_id=?",(row["id"],))
            for rid in allowed:
                if con.execute("SELECT 1 FROM roles WHERE id=? AND guild_id=?",(rid,gid)).fetchone(): con.execute("INSERT OR IGNORE INTO channel_access_roles(channel_id,role_id) VALUES(?,?)",(row["id"],rid))
        audit(gid,client.user_id,"channel_update",str(row["id"]),f"private={private}")
        await broadcast_guild(gid,{"type":"structure_changed"}); return
    if t=="channel_delete":
        if not has_perm(client,"manage_channels",gid): await send_json(client.id,{"type":"error","error":"forbidden"}); return
        row=channel_access(client,m.get("channel_id"));
        if row:
            with db() as con: con.execute("DELETE FROM channels WHERE id=?",(row["id"],))
            await broadcast_guild(gid,{"type":"structure_changed"}); return
    if t=="role_create":
        if not has_perm(client,"manage_roles",gid): await send_json(client.id,{"type":"error","error":"forbidden"}); return
        perms=[p for p in m.get("permissions",[]) if p in PERM_ALL]
        with db() as con: con.execute("INSERT INTO roles(guild_id,name,permissions,priority) VALUES(?,?,?,?)",(gid,safe_name(m.get("name") or "Cargo",48),json.dumps(perms),int(m.get("priority") or 5)))
        await broadcast_guild(gid,{"type":"structure_changed"}); return
    if t=="role_assign":
        if not has_perm(client,"manage_roles",gid): await send_json(client.id,{"type":"error","error":"forbidden"}); return
        uid=int(m.get("user_id") or 0); rid=int(m.get("role_id") or 0)
        with db() as con:
            role=con.execute("SELECT id FROM roles WHERE id=? AND guild_id=?",(rid,gid)).fetchone()
            if role: con.execute("UPDATE guild_members SET role_id=? WHERE guild_id=? AND user_id=?",(rid,gid,uid))
        await broadcast_presence(gid); return
    if t=="invite_create":
        if not has_perm(client,"create_invite",gid): await send_json(client.id,{"type":"error","error":"forbidden"}); return
        code=secrets.token_urlsafe(7); hours=max(0,min(24*30,int(m.get("hours") or 24))); max_uses=max(0,min(10000,int(m.get("max_uses") or 0))); role_id=m.get("role_id")
        with db() as con: con.execute("INSERT INTO invites(code,guild_id,creator_user_id,role_id,expires_at,max_uses,created_at) VALUES(?,?,?,?,?,?,?)",(code,gid,client.user_id,int(role_id) if role_id else None,time.time()+hours*3600 if hours else 0,max_uses,time.time()))
        await send_json(client.id,{"type":"invite_created","code":code,"hours":hours,"max_uses":max_uses}); return
    if t=="admin_stats":
        if not has_perm(client,"view_admin",gid): await send_json(client.id,{"type":"error","error":"forbidden"}); return
        with db() as con:
            stats={"members":con.execute("SELECT COUNT(*) FROM guild_members WHERE guild_id=?",(gid,)).fetchone()[0],
                   "messages":con.execute("SELECT COUNT(*) FROM messages m JOIN channels c ON c.id=m.channel_id WHERE c.guild_id=?",(gid,)).fetchone()[0],
                   "channels":con.execute("SELECT COUNT(*) FROM channels WHERE guild_id=?",(gid,)).fetchone()[0],
                   "invites":con.execute("SELECT COUNT(*) FROM invites WHERE guild_id=?",(gid,)).fetchone()[0]}
        stats["online"]=len({c.user_id for c in clients.values() if c.user_id in users_in_guild(gid)}); stats["calls"]=sum(1 for k,v in voice_rooms.items() if v and (channel_row(k) and int(channel_row(k)["guild_id"])==gid)); stats["storage_bytes"]=sum(p.stat().st_size for p in MEDIA_DIR.glob('*') if p.is_file() and not p.name.endswith('.json'))
        await send_json(client.id,{"type":"admin_stats","stats":stats,"roles":role_payloads(gid)}); return
    if t=="admin_log":
        if not has_perm(client,"view_admin",gid): await send_json(client.id,{"type":"error","error":"forbidden"}); return
        with db() as con:
            rows=con.execute("""SELECT a.*,u.display_name actor_name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.guild_id=? ORDER BY a.id DESC LIMIT 100""",(gid,)).fetchall()
        await send_json(client.id,{"type":"admin_log","entries":[dict(r) for r in rows]}); return
    if t in {"mod_kick","mod_ban","mod_timeout"}:
        perm={"mod_kick":"kick","mod_ban":"ban","mod_timeout":"timeout"}[t]
        if not has_perm(client,perm,gid): await send_json(client.id,{"type":"error","error":"forbidden"}); return
        uid=int(m.get("user_id") or 0); reason=safe_name(m.get("reason") or "",200)
        with db() as con:
            if t=="mod_kick": con.execute("DELETE FROM guild_members WHERE guild_id=? AND user_id=?",(gid,uid))
            elif t=="mod_ban":
                con.execute("INSERT OR REPLACE INTO bans(guild_id,user_id,reason,until_at,created_at) VALUES(?,?,?,?,?)",(gid,uid,reason,float(m.get("until_at") or 0),time.time())); con.execute("DELETE FROM guild_members WHERE guild_id=? AND user_id=?",(gid,uid))
            else: con.execute("UPDATE guild_members SET timeout_until=? WHERE guild_id=? AND user_id=?",(time.time()+max(60,int(m.get("seconds") or 600)),gid,uid))
        audit(gid,client.user_id,t,str(uid),reason); await send_to_user(uid,{"type":"moderation_event","action":t,"guild_id":gid,"reason":reason}); await broadcast_presence(gid); return
    if t=="get_chat_history":
        row=channel_access(client,m.get("channel_id"),"text")
        if not row:return
        limit=max(1,min(200,int(m.get("limit") or 100)))
        with db() as con: rows=con.execute("SELECT * FROM messages WHERE channel_id=? ORDER BY created_at DESC LIMIT ?",(row["id"],limit)).fetchall()[::-1]
        await send_json(client.id,{"type":"chat_history","channel_id":row["id"],"messages":[serialize_message(x) for x in rows]}); return
    if t=="chat_send":
        if not rate_limit(chat_attempts,client.id,CHAT_RATE_WINDOW,CHAT_RATE_MAX): await send_json(client.id,{"type":"error","error":"chat_rate_limited"}); return
        row=channel_access(client,m.get("channel_id"),"text")
        if not row:return
        if is_timed_out(client.user_id,int(row["guild_id"])): await send_json(client.id,{"type":"error","error":"timed_out"}); return
        content=str(m.get("content") or "").strip()[:MAX_CHAT_MESSAGE_CHARS]; atts=validate_attachments(m.get("attachments"))
        if any(tag in content.lower() for tag in ("@todos","@everyone")) and not has_perm(client,"mention_everyone",int(row["guild_id"])):
            await send_json(client.id,{"type":"error","error":"mention_everyone_forbidden"}); return
        if atts and not has_perm(client,"upload_files",int(row["guild_id"])): atts=[]
        if not content and not atts:return
        mid=secrets.token_urlsafe(12); reply=str(m.get("reply_to") or "") or None
        with db() as con:
            con.execute("INSERT INTO messages(id,channel_id,sender_user_id,content,reply_to,created_at) VALUES(?,?,?,?,?,?)",(mid,row["id"],client.user_id,content,reply,time.time()))
            for a in atts: con.execute("INSERT INTO message_attachments(message_id,media_id,name,mime_type,size,kind) VALUES(?,?,?,?,?,?)",(mid,a["media_id"],a["name"],a["mime_type"],a["size"],a["kind"]))
            mr=con.execute("SELECT * FROM messages WHERE id=?",(mid,)).fetchone()
        await broadcast_guild(int(row["guild_id"]),serialize_message(mr)); return
    if t=="chat_typing":
        row=channel_access(client,m.get("channel_id"),"text")
        if row: await broadcast_guild(int(row["guild_id"]),{"type":"chat_typing","channel_id":row["id"],"active":bool(m.get("active")),"sender":{"user_id":client.user_id,"display_name":client.display_name}},client.id)
        return
    if t=="chat_edit":
        mid=str(m.get("message_id") or ""); content=str(m.get("content") or "").strip()[:MAX_CHAT_MESSAGE_CHARS]
        with db() as con: mr=con.execute("SELECT m.*,c.guild_id FROM messages m JOIN channels c ON c.id=m.channel_id WHERE m.id=?",(mid,)).fetchone()
        if not mr or (mr["sender_user_id"]!=client.user_id and not has_perm(client,"manage_messages",mr["guild_id"])):return
        with db() as con: con.execute("UPDATE messages SET content=?,edited_at=? WHERE id=?",(content,time.time(),mid)); nr=con.execute("SELECT * FROM messages WHERE id=?",(mid,)).fetchone()
        await broadcast_guild(int(mr["guild_id"]),{"type":"chat_updated","message":serialize_message(nr)}); return
    if t=="chat_delete":
        mid=str(m.get("message_id") or "")
        with db() as con: mr=con.execute("SELECT m.*,c.guild_id FROM messages m JOIN channels c ON c.id=m.channel_id WHERE m.id=?",(mid,)).fetchone()
        if not mr or (mr["sender_user_id"]!=client.user_id and not has_perm(client,"delete_others_messages",mr["guild_id"])):return
        with db() as con: con.execute("UPDATE messages SET deleted=1,content='',edited_at=? WHERE id=?",(time.time(),mid)); nr=con.execute("SELECT * FROM messages WHERE id=?",(mid,)).fetchone()
        await broadcast_guild(int(mr["guild_id"]),{"type":"chat_updated","message":serialize_message(nr)}); return
    if t=="chat_react":
        mid=str(m.get("message_id") or ""); emoji=str(m.get("emoji") or "")[:16]
        if not emoji:return
        with db() as con:
            mr=con.execute("SELECT m.*,c.guild_id FROM messages m JOIN channels c ON c.id=m.channel_id WHERE m.id=?",(mid,)).fetchone()
            if not mr:return
            exists=con.execute("SELECT 1 FROM reactions WHERE message_id=? AND user_id=? AND emoji=?",(mid,client.user_id,emoji)).fetchone()
            if exists: con.execute("DELETE FROM reactions WHERE message_id=? AND user_id=? AND emoji=?",(mid,client.user_id,emoji))
            else: con.execute("INSERT INTO reactions(message_id,user_id,emoji) VALUES(?,?,?)",(mid,client.user_id,emoji))
            nr=con.execute("SELECT * FROM messages WHERE id=?",(mid,)).fetchone()
        await broadcast_guild(int(mr["guild_id"]),{"type":"chat_updated","message":serialize_message(nr)}); return
    if t=="chat_pin":
        mid=str(m.get("message_id") or "")
        with db() as con: mr=con.execute("SELECT m.*,c.guild_id FROM messages m JOIN channels c ON c.id=m.channel_id WHERE m.id=?",(mid,)).fetchone()
        if not mr or not has_perm(client,"pin",int(mr["guild_id"])):return
        val=0 if mr["pinned"] else 1
        with db() as con: con.execute("UPDATE messages SET pinned=? WHERE id=?",(val,mid)); nr=con.execute("SELECT * FROM messages WHERE id=?",(mid,)).fetchone()
        await broadcast_guild(int(mr["guild_id"]),{"type":"chat_updated","message":serialize_message(nr)}); return
    if t=="get_pins":
        row=channel_access(client,m.get("channel_id"),"text")
        if not row:return
        with db() as con: rows=con.execute("SELECT * FROM messages WHERE channel_id=? AND pinned=1 AND deleted=0 ORDER BY created_at DESC LIMIT 100",(row["id"],)).fetchall()
        await send_json(client.id,{"type":"pins_result","channel_id":row["id"],"messages":[serialize_message(x) for x in rows]}); return
    if t=="chat_search":
        q=str(m.get("query") or "").strip()[:100]; row=channel_access(client,m.get("channel_id"),"text")
        if not q or not row:return
        with db() as con: rows=con.execute("SELECT * FROM messages WHERE channel_id=? AND deleted=0 AND content LIKE ? ORDER BY created_at DESC LIMIT 50",(row["id"],f"%{q}%")).fetchall()
        await send_json(client.id,{"type":"chat_search_results","channel_id":row["id"],"query":q,"messages":[serialize_message(x) for x in rows]}); return
    if t=="channel_read":
        row=channel_access(client,m.get("channel_id"),"text")
        if row:
            with db() as con: con.execute("INSERT OR REPLACE INTO channel_reads(user_id,channel_id,last_read_at) VALUES(?,?,?)",(client.user_id,row["id"],time.time()))
        return
    if t=="dm_create":
        member_ids={int(x) for x in m.get("member_ids",[]) if str(x).isdigit()}; member_ids.add(client.user_id); member_ids={x for x in member_ids if x>0}
        if len(member_ids)<2 or len(member_ids)>10:return
        # reuse existing exact 1:1 thread
        thread=None
        if len(member_ids)==2:
            other=next(x for x in member_ids if x!=client.user_id)
            with db() as con:
                thread=con.execute("""SELECT d.id FROM dm_threads d WHERE
                  (SELECT COUNT(*) FROM dm_members x WHERE x.thread_id=d.id)=2 AND
                  EXISTS(SELECT 1 FROM dm_members x WHERE x.thread_id=d.id AND x.user_id=?) AND
                  EXISTS(SELECT 1 FROM dm_members x WHERE x.thread_id=d.id AND x.user_id=?) LIMIT 1""",(client.user_id,other)).fetchone()
        tid=thread[0] if thread else secrets.token_urlsafe(12)
        if not thread:
            with db() as con:
                con.execute("INSERT INTO dm_threads(id,name,created_at) VALUES(?,?,?)",(tid,safe_name(m.get("name") or "",48),time.time()))
                for uid in member_ids: con.execute("INSERT INTO dm_members(thread_id,user_id) VALUES(?,?)",(tid,uid))
        await send_json(client.id,{"type":"dm_opened","thread":dm_thread_payload(tid,client.user_id)}); return
    if t=="dm_list": await send_json(client.id,{"type":"dm_list","threads":dm_threads_for(client.user_id)}); return
    if t=="dm_history":
        tid=str(m.get("thread_id") or "")
        if not dm_member(tid,client.user_id):return
        with db() as con: rows=con.execute("SELECT * FROM dm_messages WHERE thread_id=? ORDER BY created_at DESC LIMIT 100",(tid,)).fetchall()[::-1]
        await send_json(client.id,{"type":"dm_history","thread_id":tid,"messages":[serialize_dm(x) for x in rows]}); return
    if t=="dm_send":
        tid=str(m.get("thread_id") or "");
        if not dm_member(tid,client.user_id):return
        content=str(m.get("content") or "").strip()[:MAX_CHAT_MESSAGE_CHARS]; atts=validate_attachments(m.get("attachments"))
        if not content and not atts:return
        mid=secrets.token_urlsafe(12)
        with db() as con:
            con.execute("INSERT INTO dm_messages(id,thread_id,sender_user_id,content,reply_to,created_at) VALUES(?,?,?,?,?,?)",(mid,tid,client.user_id,content,str(m.get("reply_to") or "") or None,time.time()))
            for a in atts: con.execute("INSERT INTO dm_attachments(message_id,media_id,name,mime_type,size,kind) VALUES(?,?,?,?,?,?)",(mid,a["media_id"],a["name"],a["mime_type"],a["size"],a["kind"]))
            row=con.execute("SELECT * FROM dm_messages WHERE id=?",(mid,)).fetchone(); members=[r[0] for r in con.execute("SELECT user_id FROM dm_members WHERE thread_id=?",(tid,)).fetchall()]
        payload=serialize_dm(row)
        with db() as con:
            blocked_by={int(r[0]) for r in con.execute("SELECT blocker_user_id FROM blocks WHERE blocked_user_id=?",(client.user_id,)).fetchall()}
        for uid in members:
            if int(uid)==client.user_id or int(uid) not in blocked_by: await send_to_user(int(uid),payload)
        return
    if t=="block_user":
        uid=int(m.get("user_id") or 0)
        with db() as con:
            ex=con.execute("SELECT 1 FROM blocks WHERE blocker_user_id=? AND blocked_user_id=?",(client.user_id,uid)).fetchone()
            if ex: con.execute("DELETE FROM blocks WHERE blocker_user_id=? AND blocked_user_id=?",(client.user_id,uid))
            else: con.execute("INSERT INTO blocks(blocker_user_id,blocked_user_id) VALUES(?,?)",(client.user_id,uid))
        return
    if t=="voice_join":
        row=channel_access(client,m.get("channel_id"),"voice")
        if not row:return
        if is_timed_out(client.user_id,int(row["guild_id"])) or not has_perm(client,"speak",int(row["guild_id"])): await send_json(client.id,{"type":"error","error":"forbidden"}); return
        cid=int(row["id"])
        if client.voice_channel_id and client.voice_channel_id!=cid: await leave_voice(client,False)
        room=voice_rooms.setdefault(cid,set()); existing=[]
        for pid in list(room):
            p=clients.get(pid)
            if p and p.user_id: existing.append(client_public_payload(p))
            else: room.discard(pid)
        already=client.id in room; room.add(client.id); client.voice_channel_id=cid
        await send_json(client.id,{"type":"voice_joined","channel_id":cid,"participants":existing,"already_joined":already})
        if not already:
            for pid in room:
                if pid!=client.id: await send_json(pid,{"type":"voice_participant_joined","channel_id":cid,"participant":client_public_payload(client)})
        await broadcast_presence(int(row["guild_id"])); return
    if t=="voice_leave": await leave_voice(client); return
    if t=="voice_state":
        if not client.voice_channel_id:return
        client.voice_muted=bool(m.get("muted")); client.voice_deafened=bool(m.get("deafened")); client.voice_camera=bool(m.get("camera",client.voice_camera))
        payload={"type":"voice_state","channel_id":client.voice_channel_id,"client_id":client.id,"user_id":client.user_id,"muted":client.voice_muted,"deafened":client.voice_deafened,"camera":client.voice_camera}
        for pid in voice_rooms.get(client.voice_channel_id,set()): await send_json(pid,payload)
        row=channel_row(client.voice_channel_id)
        if row:await broadcast_presence(int(row["guild_id"])); return
    if t=="voice_speaking":
        if not client.voice_channel_id:return
        active=bool(m.get("active"));
        if active==client.voice_speaking:return
        client.voice_speaking=active
        for pid in voice_rooms.get(client.voice_channel_id,set()):
            if pid!=client.id: await send_json(pid,{"type":"voice_speaking","client_id":client.id,"user_id":client.user_id,"active":active})
        return
    if t=="voice_signal":
        target=str(m.get("target_id") or ""); tc=clients.get(target)
        if not tc or not client.voice_channel_id or tc.voice_channel_id!=client.voice_channel_id:return
        await send_json(target,{"type":"voice_signal","from_id":client.id,"payload":m.get("payload")}); return
    if t=="create_session":
        if client.host_session_code:return
        channel_id=int(m.get("channel_id") or client.voice_channel_id or 0) or None
        if channel_id:
            row=channel_access(client,channel_id,"voice")
            if not row or not has_perm(client,"stream",int(row["guild_id"])):return
            sgid=int(row["guild_id"])
        else: sgid=gid
        raw=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(8)); code=f"{raw[:4]}-{raw[4:]}"
        sessions[code]=ScreenSession(code,client.id,sgid,channel_id,now()); client.host_session_code=code
        await send_json(client.id,{"type":"session_created","code":code,"expires_in":SESSION_CODE_TTL}); await broadcast_presence(sgid); return
    if t in {"join_host","join_session"}:
        if not rate_limit(join_attempts,client.id,MAX_JOIN_ATTEMPTS_WINDOW,MAX_JOIN_ATTEMPTS):return
        s=None
        if t=="join_host":
            hc=clients.get(str(m.get("host_id") or "")); s=sessions.get(hc.host_session_code) if hc and hc.host_session_code else None
        else:s=sessions.get(str(m.get("code") or "").upper())
        if not s or not guild_membership(client.user_id,s.guild_id): await send_json(client.id,{"type":"error","error":"session_not_found"}); return
        if client.id==s.host_id:return
        if client.viewing_session_code and client.viewing_session_code!=s.code:await leave_view(client,False)
        s.viewers.add(client.id); client.viewing_session_code=s.code
        await send_json(client.id,{"type":"join_approved","code":s.code,"host_id":s.host_id,"automatic":True}); await send_json(s.host_id,{"type":"viewer_joined","viewer_id":client.id,"device_name":client.display_name,"reconnect":True}); await broadcast_presence(s.guild_id); return
    if t=="signal":
        target=str(m.get("target_id") or ""); related=False
        if client.host_session_code and client.host_session_code in sessions and target in sessions[client.host_session_code].viewers:related=True
        if client.viewing_session_code and client.viewing_session_code in sessions and target==sessions[client.viewing_session_code].host_id:related=True
        if related:await send_json(target,{"type":"signal","from_id":client.id,"payload":m.get("payload")})
        return
    if t=="leave_session":await leave_view(client);return
    if t=="end_session":
        if client.host_session_code:await end_screen(client.host_session_code,"host_ended")
        return


def dm_member(tid:str,uid:int)->bool:
    with db() as con:return bool(con.execute("SELECT 1 FROM dm_members WHERE thread_id=? AND user_id=?",(tid,uid)).fetchone())


def dm_thread_payload(tid:str,viewer_uid:int)->dict[str,Any]:
    with db() as con:
        th=con.execute("SELECT * FROM dm_threads WHERE id=?",(tid,)).fetchone(); rows=con.execute("SELECT u.* FROM dm_members d JOIN users u ON u.id=d.user_id WHERE d.thread_id=?",(tid,)).fetchall()
    return {"id":tid,"name":th["name"] if th else "","members":[public_user_row(r) for r in rows],"display_name":(th["name"] if th and th["name"] else ", ".join(r["display_name"] for r in rows if r["id"]!=viewer_uid))}


def dm_threads_for(uid:int)->list[dict[str,Any]]:
    with db() as con: tids=[r[0] for r in con.execute("SELECT thread_id FROM dm_members WHERE user_id=?",(uid,)).fetchall()]
    return [dm_thread_payload(t,uid) for t in tids]


@app.get("/")
async def root():
    with db() as con: users=con.execute("SELECT COUNT(*) FROM users").fetchone()[0]; guilds=con.execute("SELECT COUNT(*) FROM guilds").fetchone()[0]
    return {"name":"OpenCall Local RTC Server","version":SERVER_VERSION,"status":"ok","users":users,"guilds":guilds,"features":{"persistent":True,"sqlite":True,"voice":True,"screen":True,"files_10gb":True}}


@app.get("/health")
async def health():
    return {"status":"ok","version":SERVER_VERSION,"clients":len([c for c in clients.values() if c.user_id]),"screen_sessions":len(sessions),"voice_rooms":sum(1 for x in voice_rooms.values() if x)}


@app.websocket("/ws")
async def websocket_endpoint(ws:WebSocket):
    await ws.accept(); cid=secrets.token_urlsafe(18); c=Client(cid,ws); clients[cid]=c
    try:
        await send_json(cid,{"type":"connected","client_id":cid,"server_version":SERVER_VERSION})
        while True:
            try:
                raw=await ws.receive_text()
            except WebSocketDisconnect:
                break
            except RuntimeError as exc:
                # Starlette can raise RuntimeError instead of WebSocketDisconnect when
                # receive_text() is called after the disconnect frame was already
                # consumed. Treat only that known connection-state error as a normal
                # disconnect; unrelated RuntimeError exceptions must still surface.
                msg=str(exc)
                if "WebSocket is not connected" in msg or "disconnect message has been received" in msg:
                    break
                raise
            if len(raw.encode())>MAX_MESSAGE_BYTES: await ws.close(code=1009); return
            try:data=json.loads(raw)
            except json.JSONDecodeError:continue
            if not isinstance(data,dict):continue
            async with state_lock: await handle_message(c,data)
    except WebSocketDisconnect:
        pass
    finally:
        async with state_lock: await remove_client(cid)

PY

# ------------------------------------------------------------
# Gerenciador do servidor
# ------------------------------------------------------------

cat > "${APPDIR}/usr/share/private-screen-share-server/manager.py" <<'PY'
from __future__ import annotations

import argparse
import json
import logging
import os
import secrets
import signal
import socket
import stat
import subprocess
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import unquote

import uvicorn

APP_VERSION = "0.6.3"


def xdg_dir(env_name: str, fallback: str) -> Path:
    value = os.environ.get(env_name)
    if value:
        return Path(value).expanduser()
    return Path.home() / fallback


CONFIG_DIR = xdg_dir("XDG_CONFIG_HOME", ".config") / "private-screen-share-server"
DATA_DIR = xdg_dir("XDG_DATA_HOME", ".local/share") / "private-screen-share-server"
LOG_DIR = DATA_DIR / "logs"
CONFIG_FILE = CONFIG_DIR / "server.json"
TURN_RUNTIME_CONFIG = DATA_DIR / "turnserver.generated.conf"


DEFAULT_CONFIG: dict[str, Any] = {
    "signaling_host": "0.0.0.0",
    "signaling_port": 8765,
    "registration_mode": "invite",
    "turn_enabled": True,
    "turn_port": 3478,
    "turn_relay_min_port": 49160,
    "turn_relay_max_port": 49200,
    "turn_realm": "private-screen-share",
    "turn_username": "",
    "turn_password": "",
    "turn_external_ip": "",
    "tls_certfile": "",
    "tls_keyfile": "",
    "log_level": "info",
}


def chmod_private(path: Path) -> None:
    try:
        path.chmod(stat.S_IRUSR | stat.S_IWUSR)
    except OSError:
        pass


def load_or_create_config() -> tuple[dict[str, Any], bool]:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    created = False

    if CONFIG_FILE.exists():
        try:
            cfg = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception as exc:
            raise SystemExit(f"Configuração inválida em {CONFIG_FILE}: {exc}")
    else:
        cfg = {}
        created = True

    merged = dict(DEFAULT_CONFIG)
    merged.update(cfg if isinstance(cfg, dict) else {})

    if not merged.get("turn_username"):
        merged["turn_username"] = "pss-" + secrets.token_hex(4)
        created = True

    if not merged.get("turn_password"):
        merged["turn_password"] = secrets.token_urlsafe(24)
        created = True

    CONFIG_FILE.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    chmod_private(CONFIG_FILE)

    return merged, created


def local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("1.1.1.1", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def appdir() -> Path:
    env = os.environ.get("APPDIR")
    if env:
        return Path(env)
    # Execução extraída/manual.
    return Path(__file__).resolve().parents[3]


def turn_binary() -> Path:
    candidate = appdir() / "usr" / "bin" / "turnserver"
    if candidate.exists():
        return candidate
    system = os.environ.get("PSS_TURNSERVER")
    if system:
        return Path(system)
    raise SystemExit("turnserver não encontrado dentro do AppImage.")


def write_turn_config(cfg: dict[str, Any]) -> None:
    lines = [
        f"listening-port={int(cfg['turn_port'])}",
        "fingerprint",
        "lt-cred-mech",
        f"realm={cfg['turn_realm']}",
        f"user={cfg['turn_username']}:{cfg['turn_password']}",
        "no-cli",
        "no-tls",
        "no-dtls",
        f"min-port={int(cfg['turn_relay_min_port'])}",
        f"max-port={int(cfg['turn_relay_max_port'])}",
        "simple-log",
        "no-stdout-log",
        f"log-file={LOG_DIR / 'turnserver.log'}",
    ]

    external_ip = str(cfg.get("turn_external_ip") or "").strip()
    if external_ip:
        lines.append(f"external-ip={external_ip}")

    TURN_RUNTIME_CONFIG.write_text("\n".join(lines) + "\n", encoding="utf-8")
    chmod_private(TURN_RUNTIME_CONFIG)


def print_summary(cfg: dict[str, Any], first_run: bool = False) -> None:
    ip = local_ip()

    print()
    print("=" * 66)
    print(f" OpenCall Local RTC Server {APP_VERSION}")
    print("=" * 66)
    print(f" Signaling LAN : ws://{ip}:{cfg['signaling_port']}/ws")
    print(f" Health        : http://{ip}:{cfg['signaling_port']}/health")

    if cfg.get("turn_enabled"):
        print(f" STUN/TURN     : stun:{ip}:{cfg['turn_port']}")
        print(f" TURN          : turn:{ip}:{cfg['turn_port']}")
        print(
            " Relay UDP     : "
            f"{cfg['turn_relay_min_port']}-{cfg['turn_relay_max_port']}"
        )
        print(f" TURN usuário  : {cfg['turn_username']}")
        print(" TURN senha    : ******** (use --show-credentials para exibir)")

    print(f" Configuração  : {CONFIG_FILE}")
    print(f" Mídia         : {DATA_DIR / 'media'}")
    print(f" Logs          : {LOG_DIR}")

    if first_run:
        print()
        print(" PRIMEIRA EXECUÇÃO:")
        print(" As credenciais TURN foram geradas automaticamente.")
        print(" Para vê-las depois, rode o AppImage com --show-credentials.")

    print()
    print(" Para acesso pela internet você ainda precisa de IP público/IPv6")
    print(" acessível ou outro relay externo, além das regras de firewall/NAT.")
    print("=" * 66)
    print()


def show_credentials(cfg: dict[str, Any]) -> None:
    print(f"TURN URL      : turn:{local_ip()}:{cfg['turn_port']}")
    print(f"TURN usuário  : {cfg['turn_username']}")
    print(f"TURN senha    : {cfg['turn_password']}")
    print(f"TURN realm    : {cfg['turn_realm']}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="OpenCall Local RTC Server"
    )
    parser.add_argument(
        "--no-turn",
        action="store_true",
        help="Inicia apenas o servidor de sinalização.",
    )
    parser.add_argument(
        "--show-config",
        action="store_true",
        help="Mostra a configuração e sai.",
    )
    parser.add_argument(
        "--show-credentials",
        action="store_true",
        help="Mostra as credenciais TURN e sai.",
    )
    parser.add_argument(
        "--init-only",
        action="store_true",
        help="Cria a configuração inicial e sai.",
    )
    args = parser.parse_args()

    cfg, created = load_or_create_config()

    if args.show_config:
        print(CONFIG_FILE.read_text(encoding="utf-8"))
        return 0

    if args.show_credentials:
        show_credentials(cfg)
        return 0

    if args.init_only:
        print_summary(cfg, first_run=created)
        return 0

    write_turn_config(cfg)
    print_summary(cfg, first_run=created)

    log_level = str(cfg.get("log_level") or "info").upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="[%(asctime)s] [%(levelname)s] %(name)s: %(message)s",
    )

    turn_proc: subprocess.Popen[bytes] | None = None
    shutting_down = False

    def stop_children(*_: object) -> None:
        nonlocal shutting_down
        if shutting_down:
            return
        shutting_down = True

        if turn_proc and turn_proc.poll() is None:
            print("\n[INFO] Encerrando coturn...")
            turn_proc.terminate()
            try:
                turn_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                turn_proc.kill()

    signal.signal(signal.SIGTERM, stop_children)

    if cfg.get("turn_enabled") and not args.no_turn:
        print("[INFO] Iniciando coturn...")
        turn_proc = subprocess.Popen(
            [
                str(turn_binary()),
                "-c",
                str(TURN_RUNTIME_CONFIG),
            ],
            stdin=subprocess.DEVNULL,
        )
        time.sleep(0.7)

        if turn_proc.poll() is not None:
            raise SystemExit(
                "coturn encerrou imediatamente. Consulte: "
                f"{LOG_DIR / 'turnserver.log'}"
            )

        print(f"[OK] coturn ativo (PID {turn_proc.pid})")
    else:
        print("[INFO] TURN desativado nesta execução.")

    try:
        print("[INFO] Iniciando servidor FastAPI/WebSocket...")
        tls_cert = str(cfg.get("tls_certfile") or "").strip()
        tls_key = str(cfg.get("tls_keyfile") or "").strip()
        if bool(tls_cert) != bool(tls_key):
            raise SystemExit("Configure tls_certfile e tls_keyfile juntos, ou deixe ambos vazios.")
        uvicorn.run(
            "server_main:app",
            host=str(cfg["signaling_host"]),
            port=int(cfg["signaling_port"]),
            log_level=str(cfg.get("log_level") or "info"),
            access_log=False,
            ssl_certfile=tls_cert or None,
            ssl_keyfile=tls_key or None,
        )
    except KeyboardInterrupt:
        pass
    finally:
        stop_children()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
PY

# ------------------------------------------------------------
# Incluir coturn
# ------------------------------------------------------------

say "Empacotando coturn"
cp -L "${TURN_BIN}" "${APPDIR}/usr/bin/turnserver"
chmod +x "${APPDIR}/usr/bin/turnserver"

# ------------------------------------------------------------
# AppRun
# ------------------------------------------------------------

cat > "${APPDIR}/AppRun" <<'SH'
#!/bin/sh
set -eu

HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

export APPDIR="$HERE"
export PYTHONHOME="$HERE/usr"
export PYTHONPATH="$HERE/usr/lib/pss-site-packages:$HERE/usr/share/private-screen-share-server"
export LD_LIBRARY_PATH="$HERE/usr/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export PATH="$HERE/usr/bin:$PATH"

cd "$HERE/usr/share/private-screen-share-server"
exec "$HERE/usr/bin/python3" "$HERE/usr/share/private-screen-share-server/manager.py" "$@"
SH
chmod +x "${APPDIR}/AppRun"

# ------------------------------------------------------------
# Desktop entry + ícone
# ------------------------------------------------------------

cat > "${APPDIR}/${APP_NAME}.desktop" <<EOF
[Desktop Entry]
Name=OpenCall Local RTC Server
Comment=Servidor local de chat, voz, signaling WebRTC e TURN
Exec=${APP_NAME}
Icon=private-screen-share-server
Terminal=true
Type=Application
Categories=Network;
StartupNotify=false
EOF

cp "${APPDIR}/${APP_NAME}.desktop" \
   "${APPDIR}/usr/share/applications/${APP_NAME}.desktop"

cat > "${APPDIR}/private-screen-share-server.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect x="28" y="40" width="200" height="142" rx="18" fill="#20242b"/>
  <rect x="44" y="56" width="168" height="110" rx="8" fill="#4f8cff"/>
  <rect x="96" y="190" width="64" height="14" rx="7" fill="#20242b"/>
  <rect x="72" y="210" width="112" height="12" rx="6" fill="#20242b"/>
  <circle cx="190" cy="78" r="28" fill="#25c26e"/>
  <path d="M177 78l9 9 17-19" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
SVG

cp "${APPDIR}/private-screen-share-server.svg" \
   "${APPDIR}/usr/share/icons/hicolor/scalable/apps/private-screen-share-server.svg"

# ------------------------------------------------------------
# Bundling de bibliotecas ELF
# ------------------------------------------------------------

should_skip_lib() {
    local base
    base="$(basename "$1")"

    case "$base" in
        libc.so.*|libm.so.*|libpthread.so.*|libdl.so.*|librt.so.*|\
        ld-linux-x86-64.so.*|libresolv.so.*|libnss_*.so.*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

bundle_deps_for() {
    local elf="$1"

    while IFS= read -r lib; do
        [[ -f "$lib" ]] || continue

        if should_skip_lib "$lib"; then
            continue
        fi

        local dest="${APPDIR}/usr/lib/$(basename "$lib")"
        if [[ ! -e "$dest" ]]; then
            cp -L "$lib" "$dest"
        fi
    done < <(lddtree -l "$elf" 2>/dev/null || true)
}

say "Coletando bibliotecas dinâmicas"

bundle_deps_for "${APPDIR}/usr/bin/python3"
bundle_deps_for "${APPDIR}/usr/bin/turnserver"

# Extensões nativas do stdlib e pacotes pip.
while IFS= read -r -d '' elf; do
    if file "$elf" 2>/dev/null | grep -q 'ELF'; then
        bundle_deps_for "$elf"
    fi
done < <(
    find \
        "${APPDIR}/usr/lib/python${PY_VER}" \
        "${SITE_PACKAGES}" \
        -type f \( -name '*.so' -o -name '*.so.*' \) -print0
)

# Nova rodada para dependências das bibliotecas que acabamos de copiar.
for _round in 1 2; do
    while IFS= read -r -d '' elf; do
        if file "$elf" 2>/dev/null | grep -q 'ELF'; then
            bundle_deps_for "$elf"
        fi
    done < <(find "${APPDIR}/usr/lib" -maxdepth 1 -type f -print0)
done

# ------------------------------------------------------------
# Sanidade da árvore
# ------------------------------------------------------------

say "Testando runtime dentro do AppDir"

APPDIR="${APPDIR}" \
PYTHONHOME="${APPDIR}/usr" \
PYTHONPATH="${SITE_PACKAGES}:${APPDIR}/usr/share/private-screen-share-server" \
LD_LIBRARY_PATH="${APPDIR}/usr/lib" \
"${APPDIR}/usr/bin/python3" - <<'PY'
import fastapi
import uvicorn
import websockets
import server_main

print("Python embutido: OK")
print("FastAPI:", fastapi.__version__)
print("Uvicorn:", uvicorn.__version__)
print("WebSockets:", websockets.__version__)
print("Servidor importado: OK")
PY

"${APPDIR}/usr/bin/turnserver" --version >/dev/null 2>&1 || true
echo "coturn empacotado: OK"

# ------------------------------------------------------------
# appimagetool
# ------------------------------------------------------------

say "Baixando appimagetool e runtime AppImage"

curl -fL --retry 3 \
    "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-${ARCH}.AppImage" \
    -o "${APPIMAGETOOL}"

curl -fL --retry 3 \
    "https://github.com/AppImage/type2-runtime/releases/download/continuous/runtime-${ARCH}" \
    -o "${APPIMAGE_RUNTIME}"

chmod +x "${APPIMAGETOOL}" "${APPIMAGE_RUNTIME}"

say "Gerando AppImage"

rm -f "${SAFE_OUTPUT}" "${OUTPUT}"

# appimagetool recebe apenas caminhos ASCII em /tmp.
# Também fixamos locale UTF-8 para evitar:
# "Option parsing failed: Sequência de bytes inválida na entrada de conversão"
(
    export LC_ALL=C.UTF-8
    export LANG=C.UTF-8

    ARCH="${ARCH}" \
    VERSION="${VERSION}" \
    "${APPIMAGETOOL}" --appimage-extract-and-run \
        --runtime-file "${APPIMAGE_RUNTIME}" \
        "${APPDIR}" \
        "${SAFE_OUTPUT}"
)

[[ -f "${SAFE_OUTPUT}" ]] || die "appimagetool não criou o AppImage esperado."

chmod +x "${SAFE_OUTPUT}"

say "Copiando AppImage para a pasta original"
cp -f "${SAFE_OUTPUT}" "${OUTPUT}"
chmod +x "${OUTPUT}"

# ------------------------------------------------------------
# Resultado
# ------------------------------------------------------------

say "BUILD CONCLUÍDO"

echo
echo "Arquivo:"
echo "  ${OUTPUT}"
echo
echo "Tamanho:"
du -h "${OUTPUT}" | awk '{print "  " $1}'
echo
echo "Executar:"
echo "  ./${APP_NAME}-${VERSION}-${ARCH}.AppImage"
echo
echo "Ver credenciais TURN:"
echo "  ./${APP_NAME}-${VERSION}-${ARCH}.AppImage --show-credentials"
echo
echo "Somente signaling, sem TURN:"
echo "  ./${APP_NAME}-${VERSION}-${ARCH}.AppImage --no-turn"
echo
echo "Configuração persistente:"
echo "  ~/.config/private-screen-share-server/server.json"
echo
echo "IMPORTANTE:"
echo "  Para internet, configure firewall/port-forwarding:"
echo "    TCP 8765              -> signaling (LAN/dev; depois use WSS/reverse proxy)"
echo "    UDP/TCP 3478          -> STUN/TURN"
echo "    UDP 49160-49200       -> relay TURN"
echo
echo "  Se o servidor estiver atrás de NAT, preencha turn_external_ip em:"
echo "    ~/.config/private-screen-share-server/server.json"
echo
