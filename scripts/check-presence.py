import ast
from pathlib import Path
from types import SimpleNamespace as NS

source=(Path(__file__).resolve().parents[1]/'server/build-opencall-local-server-appimage-0.7.1-guild-leave-delete.sh').read_text()
start=source.index('def guild_presence_payload(')
end=source.index('async def broadcast_presence(',start)
ns={'Client':NS,'Any':object,'sessions':{'watch':NS(guild_id=1)},
    'client_public_payload':lambda c:{'user_id':7,'voice':{'channel_id':10},'stream':{'channel_id':10},'watching':{'session_code':'watch'}}}
exec(compile(ast.parse(source[start:end]),'<presence>','exec'),ns)
client=NS(viewing_session_code='watch')
first=ns['guild_presence_payload'](client,1,{10,11})
second=ns['guild_presence_payload'](client,2,{20,21})
assert all(key in first for key in ('voice','stream','watching'))
assert second=={'user_id':7}
assert ns['guild_presence_payload'](client,1,{10})==first
print('Presence: call/stream/viewer isolated by community, identity preserved: OK')
