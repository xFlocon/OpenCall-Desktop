"""Run: python3 scripts/check-membership.py"""
import ast
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
builder = (root / 'server/build-opencall-local-server-appimage-0.7.1-guild-leave-delete.sh').read_text()
start = builder.index('def ensure_default_membership(')
end = builder.index('\ndef friend_pair(', start)
con = sqlite3.connect(':memory:')
con.executescript('CREATE TABLE guild_members(guild_id INTEGER,user_id INTEGER); INSERT INTO guild_members VALUES(1,1),(2,3);')
namespace = {'db': lambda: con}
exec(compile(ast.parse(builder[start:end]), '<membership>', 'exec'), namespace)
membership = namespace['ensure_default_membership']
before = list(con.execute('SELECT * FROM guild_members'))
assert membership(2) is None  # Cadastro e login repetido não inserem membro.
assert membership(2) is None
assert membership(1) == 1
assert membership(3) == 2
assert list(con.execute('SELECT * FROM guild_members')) == before
con.execute('DELETE FROM guild_members WHERE user_id=1')
assert membership(1) is None  # Sair/expulsar não é revertido no próximo login.
con.execute('DELETE FROM guild_members')
assert membership(4) is None  # Comunidade vazia também não admite automaticamente.
print('Membership: cadastro/login sem autoentrada; membros existentes preservados: OK')
