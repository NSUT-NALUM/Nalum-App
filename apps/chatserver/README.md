# Chatserver frontend integration guide

This service owns real-time chat delivery and chat REST APIs. It runs separately
from the main API, but accepts the same JWT access tokens.

## Base URLs and authentication

Local defaults:

- REST: `http://localhost:3001/api`
- WebSocket: `ws://localhost:3001/ws`
- Production WebSocket: `wss://<api-domain>/ws` through nginx

All REST routes require the main backend's access token:

```http
Authorization: Bearer <access-token>
```

For WebSockets, create the connection with these two subprotocols, in this
order. Do not put the token in the URL.

```ts
const socket = new WebSocket(WS_URL, ["nalum.chat.v1", accessToken]);
```

The service only accepts JWTs whose `tokenType` is `access`. It rejects expired
tokens, refresh tokens, banned users, deleted users, and alumni who are not
verified. The same database-backed check runs again for every WebSocket event.
Ban and alumni-access changes are also published through Redis so existing
connections close immediately.

## Data shapes

All IDs are UUID strings. Timestamps are serialized as ISO-8601 strings in HTTP
and WebSocket JSON responses.

```ts
type ParticipantRole = "OWNER" | "ADMIN" | "MEMBER";
type ConversationType = "DIRECT" | "GROUP";

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  text: string;
  createdAt: string;
};
```

`clientMessageId` must be a client-generated UUID. Keep it when retrying a
send: the server returns the original persisted message instead of creating a
duplicate.

## REST endpoints

REST responses are direct JSON values, except errors. Successful endpoints do
not use the main backend's `{ success, data }` envelope.

### Health

`GET /api/health`

```json
{ "status": "OK", "service": "chatserver" }
```

### Create or get a direct conversation

`POST /api/conversations/direct`

```json
{ "recipientUserId": "uuid" }
```

Returns the existing or newly created canonical direct conversation. There is
exactly one direct conversation for a pair of users; self-conversations are
rejected.

### List my conversations

`GET /api/conversations?limit=50&cursor=<opaque-cursor>`

- `limit`: optional, 1–100, defaults to 50.
- `cursor`: optional opaque value returned by the previous response.

```json
{
  "conversations": [
    {
      "id": "uuid",
      "type": "DIRECT",
      "name": null,
      "directPairKey": "internal",
      "lastMessageAt": "2026-07-22T10:00:00.000Z",
      "participants": [{ "userId": "uuid", "role": "MEMBER" }],
      "messages": [{ "id": "uuid", "text": "Latest message" }]
    }
  ],
  "nextCursor": "opaque-string-or-null"
}
```

Results are newest-first by `(lastMessageAt, id)`. Pass `nextCursor` until it
is `null`; never construct or modify a cursor yourself.

### Load message history

`GET /api/conversations/:conversationId/messages?limit=50&cursor=<opaque-cursor>`

```json
{
  "messages": [
    {
      "id": "uuid",
      "conversationId": "uuid",
      "senderId": "uuid",
      "clientMessageId": "uuid",
      "text": "Hello",
      "createdAt": "2026-07-22T10:00:00.000Z"
    }
  ],
  "nextCursor": "opaque-string-or-null"
}
```

Only active participants can load history. Results are newest-first by
`(createdAt, id)`; prepend older pages in the UI when scrolling upward.

### Create a group

`POST /api/conversations/groups`

```json
{
  "name": "NSUT CSE 2024",
  "memberIds": ["uuid", "uuid"]
}
```

`name` is 1–120 characters and `memberIds` accepts 1–250 user IDs. The caller
is included automatically and becomes `OWNER`; initial members become `MEMBER`.

### Add a group member

`POST /api/conversations/:conversationId/members`

```json
{ "userId": "uuid" }
```

Only an active group `OWNER` or `ADMIN` can add members. Adding a previously
removed user reactivates them as `MEMBER`.

### Remove a group member

`DELETE /api/conversations/:conversationId/members/:userId`

Only an `OWNER` or `ADMIN` can remove an active member. The owner cannot be
removed; ownership transfer is not implemented yet.

### Change a member role

`PATCH /api/conversations/:conversationId/members/:userId/role`

```json
{ "role": "ADMIN" }
```

Only the `OWNER` may set a non-owner active member to `ADMIN` or `MEMBER`.
The owner role cannot be changed through this endpoint.

## WebSocket events

Every frame is JSON in this shape:

```ts
type SocketEvent = { type: string; payload: unknown };
```

### Server: socket acknowledgement

Immediately after a successful connection:

```json
{
  "type": "socket:ack",
  "payload": {
    "connectionId": "uuid",
    "userId": "uuid",
    "serverTime": "2026-07-22T10:00:00.000Z"
  }
}
```

### Client: send a message

```json
{
  "type": "message:send",
  "payload": {
    "conversationId": "uuid",
    "clientMessageId": "uuid",
    "text": "Hello"
  }
}
```

`text` is trimmed and must be 1–4,000 characters. The sender must still be an
active conversation participant at send time.

### Server: accepted message

Sent to the originating socket after persistence:

```json
{ "type": "message:accepted", "payload": { "id": "uuid", "...": "Message" } }
```

Use this to replace an optimistic message keyed by `clientMessageId` with the
server message.

### Server: new message

Sent to all active participants, including the sender's other connections:

```json
{ "type": "message:new", "payload": { "id": "uuid", "...": "Message" } }
```

Deduplicate messages by `Message.id` in the client because the sender can
receive both `message:accepted` and `message:new`.

### Client: presence heartbeat

```json
{ "type": "presence:heartbeat", "payload": {} }
```

Send once every 30 seconds while connected. The server also registers an
initial heartbeat at connection time. Presence is shared only with users who
currently share an active conversation with that user.

### Server: presence update

```json
{
  "type": "presence:update",
  "payload": {
    "userId": "uuid",
    "status": "online",
    "lastSeenAt": "2026-07-22T10:00:00.000Z"
  }
}
```

`lastSeenAt` is present for `offline` events only. A user remains online while
any tab/device heartbeat is active. Abrupt disconnects are marked offline after
the 75-second TTL and up to the next 30-second server sweep.

### Client: typing start

```json
{
  "type": "typing:start",
  "payload": { "conversationId": "uuid" }
}
```

Emit while the user is typing, debounced to at most once every two seconds. Do
not send a stop event.

### Server: typing update

```json
{
  "type": "typing:update",
  "payload": {
    "conversationId": "uuid",
    "userId": "uuid",
    "isTyping": true
  }
}
```

Typing expires automatically after five seconds without another `typing:start`.
It is Redis-only and is never written to PostgreSQL.

### Server: socket error

```json
{
  "type": "error",
  "payload": {
    "code": "CHAT_NOT_PARTICIPANT",
    "message": "You are not a participant in this conversation"
  }
}
```

## Error handling

REST errors use:

```json
{
  "success": false,
  "code": "CHAT_VALIDATION",
  "message": "Invalid request payload"
}
```

Important error codes include:

- `CHAT_AUTH_REQUIRED`, `CHAT_ACCESS_TOKEN_REQUIRED`, `CHAT_USER_NOT_ALLOWED`
- `CHAT_VALIDATION`, `CHAT_INVALID_CURSOR`, `CHAT_UNKNOWN_EVENT`
- `CHAT_NOT_PARTICIPANT`, `CHAT_RECIPIENT_NOT_FOUND`, `CHAT_MEMBER_NOT_FOUND`
- `CHAT_MEMBER_NOT_ACTIVE`, `CHAT_GROUP_FORBIDDEN`, `CHAT_NOT_GROUP`
- `CHAT_SELF_DIRECT`, `CHAT_OWNER_REMOVAL`, `CHAT_OWNER_ROLE`
- `ALUMNI_VERIFICATION_PENDING`, `ALUMNI_VERIFICATION_REJECTED`, `USER_BANNED`

## Current feature boundary

Available now: direct chat, groups, participant roles, text messages,
idempotent send/retry, reconnectable cursor history, presence, last seen, and
typing indicators.

Not implemented yet: receipts, reactions, replies, mentions, message edits or
deletes, attachments, search, unread counts, push notifications, and frontend
screens.
