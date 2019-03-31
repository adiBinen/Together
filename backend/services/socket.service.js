const chatService = require('./chat.service');
const notificationService = require('./notification.service');
const pushService = require('../services/push.service');

// EVENTS LIST:
// REPORT MUKI
const SOCKET_CONNECT = 'socket-connect';
const SOCKET_DISCONNECT = 'socket-disconnect';

// CHAT EVENTS
const CHAT_REGISTER_ROOMS = 'socket-register-rooms';
const CHAT_JOIN = 'chat-join';
const CHAT_JOIN_NEW = 'chat-join-new';
const CHAT_LEAVE = 'chat-leave';
const CHAT_SEND_MSG = 'chat-send-msg';
const CHAT_RECEIVE_MSG = 'chat-receive-msg';

// TRIP EVENTS
const TRIP_JOIN_REQUEST = 'trip-join-request';

// NOTIFICATIONS EVENTS
const NOTIFICATION_RECEIVE = 'notification-receive';
const NOTIFICATION_SEND = 'notification-send';
const NOTIFICATION_ADD = 'notification-add';
const NOTIFICATION_ADDED = 'notification-added';

const PUSH_NOTIFICATION = 'push-notification';


const connectedSockets = [];

module.exports = (io) => {

    io.on('connection', socket => {
        socket.on(SOCKET_CONNECT, userId => {
            socket.userId = userId;
            connectedSockets.push(socket)
            console.log('Hello user:', userId, 'in socket:', socket.userId);
        })

        socket.on(SOCKET_DISCONNECT, () => {
            socket.userId = null;
        })

        socket.on(CHAT_REGISTER_ROOMS, chats => {
            chats.forEach(chat => {
                socket.join(chat._id);
            })
        })

        socket.on('disconnect', () => {
            console.log('bye user', socket.userId);
            const socketIdx = connectedSockets.findIndex(inSocket => inSocket.id === socket.id);
            if (socketIdx !== -1) connectedSockets.splice(socketIdx, 1);
        })

        socket.on(CHAT_JOIN, async payload => {
            if (payload.chatId) socket.join(payload.chatId);
            else {
                payload.users.push(payload.loggedUserId);
                let chat = {
                    users: payload.users,
                    msgs: [],
                }
                try {
                    chat = await chatService.createChat(chat);
                    socket.join(chat._id);
                    socket.emit(CHAT_JOIN_NEW, chat);
                } catch {

                }
            }
        });

        socket.on(CHAT_SEND_MSG, async payload => {
            if (payload.msg.forGroup) payload.msg.sender = null;
            else payload.msg.sender = socket.userId;
            payload.unread = [];
            // TODO: Force socket to reconnect to his room upon message sent and referred to him
            payload.recipients.forEach(recipient => {
                if (recipient._id !== socket.userId) {
                    const recipientSocket = connectedSockets.find(inSocket => inSocket.userId === recipient._id);
                    if (recipientSocket) recipientSocket.join(payload.chatId);
                    else payload.unread.push(recipient._id);
                }
            })
            await chatService.addMsg(payload);
            io.in(payload.chatId).emit(CHAT_RECEIVE_MSG, payload);
        })


        // Notifications
        socket.on(NOTIFICATION_ADD, async notification => {
            notification.createdAt = Date.now();
            let addedNotification = await notificationService.add(notification)
            io.emit(NOTIFICATION_ADDED, addedNotification);
        });

        socket.on(NOTIFICATION_SEND, async ({ userId, payload }) => {
            console.log('got this notification for user:', userId, 'and his load:', payload);
            // send it to him:
            const recipientSocket = connectedSockets.find(inSocket => inSocket.userId === userId);
            if (recipientSocket) {
                recipientSocket.emit(NOTIFICATION_RECEIVE, payload);
                console.log('recipientIs:', recipientSocket.userId, userId)
            }
        })

        // PUSH NOTIFICATIONS:
        socket.on(PUSH_NOTIFICATION, async ({userId, notification}) => {
            console.log('GOT TO SOCKET WITH NOTIFICATION PAYLOAD TO:'. userId, notification)
            pushService.send(userId, notification);
        })
    });
}