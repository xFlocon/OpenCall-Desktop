#!/usr/bin/env bash
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
HOST="${OPENCALL_HOST:-127.0.0.1}"
PORT="${OPENCALL_PORT:-3000}"
PORT_EXPLICIT=0
[[ -n "${OPENCALL_PORT:-}" ]] && PORT_EXPLICIT=1

command -v python3 >/dev/null 2>&1 || { echo "ERRO: python3 não encontrado. No Arch: sudo pacman -S python" >&2; exit 1; }
if [[ "${1:-}" == "--lan" ]]; then HOST="0.0.0.0"; shift; fi
if [[ "${1:-}" =~ ^[0-9]+$ ]]; then PORT="$1"; PORT_EXPLICIT=1; fi

port_is_free(){ python3 - "$HOST" "$1" <<'PY'
import socket,sys
s=socket.socket();
try:s.bind((sys.argv[1],int(sys.argv[2])))
except OSError:raise SystemExit(1)
finally:s.close()
PY
}
if ! port_is_free "$PORT"; then
  if (( PORT_EXPLICIT )); then echo "ERRO: porta $PORT ocupada." >&2; exit 1; fi
  original="$PORT"
  for candidate in $(seq $((PORT+1)) $((PORT+20))); do if port_is_free "$candidate"; then PORT="$candidate"; break; fi; done
  [[ "$PORT" != "$original" ]] || { echo "ERRO: sem porta livre." >&2; exit 1; }
  echo "AVISO: porta $original ocupada; usando $PORT." >&2
fi
SCHEME=http
EXTRA=()
if [[ -n "${OPENCALL_CERT:-}" || -n "${OPENCALL_KEY:-}" ]]; then
  [[ -n "${OPENCALL_CERT:-}" && -n "${OPENCALL_KEY:-}" ]] || { echo "ERRO: use OPENCALL_CERT e OPENCALL_KEY juntos." >&2; exit 1; }
  SCHEME=https
  EXTRA+=(--certfile "$OPENCALL_CERT" --keyfile "$OPENCALL_KEY")
fi
cat <<TXT
============================================================
 OpenCall Desktop 0.7.32 - Discord-like self-hosted
============================================================
 Interface : ${SCHEME}://${HOST}:${PORT}
 Signaling padrão: ws://127.0.0.1:8765/ws
 Servidor recomendado: OpenCall Local RTC Server 0.6.7

 Recursos: contas, servidores/categorias/canais, chat persistente,
 DMs/grupos, cargos/permissões, voz, câmera, tela, arquivos 10 GB,
 reações/respostas/pins/busca, convites, moderação e painel admin.
============================================================
TXT
cd "$ROOT"
exec python3 "$ROOT/scripts/serve.py" --host "$HOST" --port "$PORT" "${EXTRA[@]}"
