const Chat = require('../models/Chat');
require('./setup');

describe('Chat model basic behavior', () => {
  it('saves a chat and persists messages', async () => {
    const chat = new Chat({
      customer: { name: 'Charlie', email: 'charlie@test.com' },
      messages: [{ sender: 'customer', senderName: 'Charlie', text: 'Hi', timestamp: new Date() }],
      status: 'waiting'
    });

    await chat.save();

    // add a new message and save
    chat.messages.push({ sender: 'agent', senderName: 'Agent', text: 'Hello Charlie', timestamp: new Date() });
    await chat.save();

    const found = await Chat.findById(chat._id).lean();
    expect(found).toBeDefined();
    expect(Array.isArray(found.messages)).toBe(true);
    expect(found.messages.length).toBe(2);
    expect(found.messages[1].text).toBe('Hello Charlie');
  });
});
