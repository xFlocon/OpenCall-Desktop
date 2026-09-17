import ast
import json
from pathlib import Path

source=(Path(__file__).resolve().parents[1]/'server/build-opencall-local-server-appimage-0.7.1-guild-leave-delete.sh').read_text()
start=source.index('def can_manage_member(');end=source.index('def has_perm(',start)
roles={1:{'priority':100},2:{'priority':50},3:{'priority':10},4:{'priority':50},5:{'priority':80}}
permissions={1:{'manage_server','manage_roles'},2:{'manage_server','manage_roles'},3:set(),4:{'manage_server'},5:{'manage_roles'}}
ns={'json':json,'guild_owner':lambda uid,gid:uid==1,'guild_membership':lambda uid,gid:roles.get(uid),'perms_for':lambda uid,gid:permissions.get(uid,set())}
exec(compile(ast.parse(source[start:end]),'<hierarchy>','exec'),ns)
manage=ns['can_manage_member'];grant=ns['can_grant_role']
assert manage(1,2,1)
assert not manage(2,1,1)
assert not manage(2,4,1)
assert not manage(2,5,1)
assert not manage(2,2,1)
assert manage(2,3,1)
assert grant(2,1,{'priority':50,'permissions':'["manage_server"]'})
assert not grant(2,1,{'priority':51,'permissions':'[]'})
assert not grant(2,1,{'priority':1,'permissions':'["ban"]'})
assert not grant(99,1,{'priority':1,'permissions':'[]'})
print('Hierarquia: dono, administradores, pares, superiores e permissões: OK')
