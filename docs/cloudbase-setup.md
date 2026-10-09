# WeChat CloudBase Setup

## 1. Create the environment

1. Open the project in WeChat DevTools with the user's Mini Program AppID.
2. Open Cloud Development and create one environment.
3. If more than one environment exists, select the environment used by this project in DevTools.
4. Right-click `cloudfunctions/roomApi`, choose upload and deploy with cloud dependency installation.
5. Right-click `cloudfunctions/cleanupExpiredRooms`, choose upload and deploy with cloud dependency installation.

## 2. Create collections

Create these collections:

- `rooms`
- `room_views`
- `hands`

Do not create seed documents. Cloud functions create all documents.

## 3. Set collection permissions

Use custom security rules in the CloudBase console.

`rooms`:

```json
{
  "read": false,
  "write": false
}
```

`room_views`:

```json
{
  "read": "doc.openid == auth.openid",
  "write": false
}
```

`hands`:

```json
{
  "read": "doc.openid == auth.openid",
  "write": false
}
```

Cloud functions run with admin permission and continue to write all documents.

## 4. Create indexes

Create these indexes:

- `rooms.roomCode`: unique ascending index.
- `rooms.expiresAt`: ascending index.
- `room_views.roomId + room_views.openid`: unique composite index.
- `hands.roomId + hands.roundNumber + hands.openid`: unique composite index.

## 5. Schedule cleanup

Add a timer trigger to `cleanupExpiredRooms`:

```text
0 0 * * * * *
```

The expression runs the cleanup once per hour.

## 6. Deploy verification

After deployment, run the `createRoom` action from DevTools Cloud Function testing:

```json
{
  "action": "createRoom",
  "payload": {
    "nickname": "测试房主",
    "avatarUrl": ""
  }
}
```

Expected result:

```json
{
  "ok": true,
  "data": {
    "roomId": "<generated>",
    "roomCode": "<six digits>"
  }
}
```
