# OpenCall Local Server 0.6.8

## 0.6.8 — edição de anexos

- adiciona `message_attachment_edit` ao handshake de features;
- `chat_edit` aceita `attachments` opcional: se omitido, preserva os anexos atuais; se enviado, troca a lista de anexos;
- valida no máximo 4 anexos, IDs reais de mídia e propriedade dos novos uploads;
- moderadores podem manter anexos já existentes ao editar uma mensagem, mas novos arquivos precisam pertencer ao usuário que está fazendo a operação;
- mantém canais somente leitura e todas as capacidades do 0.6.7.

Builder recomendado: `build-opencall-local-server-appimage-0.6.8-attachment-edit.sh`.

# OpenCall Local RTC Server 0.6.7

## 0.6.7 — canais somente leitura

Mantém as funções do 0.6.6 e adiciona:
- coluna persistente `channels.read_only`, com migração automática do banco existente;
- feature flag `read_only_channels`;
- bloqueio no servidor de `chat_send`, `chat_edit` e `chat_typing` para membros comuns em canais somente leitura;
- administradores (`manage_server` / `manage_channels`) continuam podendo escrever;
- `channel_update` persiste o estado somente leitura.

Builder recomendado: `build-opencall-local-server-appimage-0.6.7-read-only-chat.sh`.


## 0.6.9 · identidade social
- Contas recebem identidade pública `Nome#0000`.
- Amigos, pedidos de amizade e DMs globais no mesmo servidor.
- Servidor residencial/público padrão permite auto-join (`home_server_auto_join=true`).
- Builder: `build-opencall-local-server-appimage-0.6.9-social-identity.sh`.
