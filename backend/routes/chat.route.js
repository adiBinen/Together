const chatService = require('../services/chat.service');
module.exports = (app) => {

    // EXPERIMENT WITH CHATS DB
    app.get('/api/chat', async (req, res) => {
        const { userId } = req.query
        try {
            const chats = await chatService.query(userId);
            res.json(chats);
        } catch {
            res.status(404).end();
        }

    });

    // get single chat by id
    app.get('/api/chat/:chatId', async (req, res) => {
        const { chatId } = req.params;
        try {
            const chat = await chatService.getById(chatId);
            if (chat) res.json(chat);
            else res.status(404).end();
        } catch {
            // TODO: handle error
        }
    })

    app.post('/api/chat', async (req, res) => {
        const chat = req.body;
        try {
            const newChat = await chatService.createChat(chat);
            res.json(newChat);
        } catch {
            res.status(404).end();
        }
    })

    app.put('/api/chat/:chatId', async (req, res) => {
        const msg = req.body;
        const { chatId } = req.params;
        try {
            const isSuccess = await chatService.addMsg(msg, chatId)
            res.json(isSuccess);
        } catch {
            res.status(500).end('We have a problem');
        }
    })

    app.patch('/api/chat/:chatId', async (req, res) => {
        const { chatId } = req.params;
        const {userId} = req.body;
        try {
            await chatService.removeUserFromUnread(chatId, userId);
            res.json('Success');

        } catch (err) {
            res.status(500).end();
        }
    })
}