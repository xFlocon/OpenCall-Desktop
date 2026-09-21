import asyncio
import secrets
from pathlib import Path
from types import SimpleNamespace as NS
source=(Path(__file__).resolve().parents[1]/'server/build-opencall-local-server-appimage-0.7.1-guild-leave-delete.sh').read_text()
start=source.index('    if t=="dm_screen_start":');end=source.index('    if t=="dm_screen_signal":',start)
events=[]
async def send(cid,payload):events.append((cid,payload))
sessions={};index={}
async def broadcast(tid):events.append(('list',tid))
async def leave(client,notify):
    old=sessions.get(client.dm_viewing_session_code)
    if old:old.viewers.discard(client.id)
    client.dm_viewing_session_code=None
ns={'secrets':secrets,'now':lambda:0,'dm_member':lambda tid,uid:tid=='group','dm_screen_sessions':sessions,'dm_screen_by_thread':index,'send_json':send,'broadcast_dm_streams':broadcast,'leave_dm_screen_view':leave,'DMScreenSession':lambda code,tid,host,at:NS(code=code,thread_id=tid,host_id=host,viewers=set())}
exec('async def handle(client,m):\n    t=m["type"]\n'+source[start:end],ns)
async def test():
    a=NS(id='a',user_id=1,dm_call_thread_id='group',dm_host_session_code=None,dm_viewing_session_code=None)
    b=NS(id='b',user_id=2,dm_call_thread_id='group',dm_host_session_code=None,dm_viewing_session_code=None)
    for c in (a,b):await ns['handle'](c,{'type':'dm_screen_start'})
    assert len(sessions)==2 and len(index['group'])==2
    await ns['handle'](a,{'type':'dm_screen_start'});assert len(sessions)==2
    await ns['handle'](a,{'type':'dm_screen_join','code':b.dm_host_session_code})
    await ns['handle'](b,{'type':'dm_screen_join','code':a.dm_host_session_code})
    assert a.dm_viewing_session_code==b.dm_host_session_code
    assert b.dm_viewing_session_code==a.dm_host_session_code
    outsider=NS(id='c',user_id=3,dm_call_thread_id='other',dm_viewing_session_code=None)
    await ns['handle'](outsider,{'type':'dm_screen_join','code':a.dm_host_session_code})
    assert outsider.dm_viewing_session_code is None
asyncio.run(test())
print('DM streams: concurrent hosts, reciprocal viewing, idempotence, isolation OK')
