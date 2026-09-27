const db = require('../config/db');

const Support = {
  async getOrCreateConversation(userId) {
    const existing = await db.query('SELECT * FROM support_conversations WHERE user_id = $1', [userId]);
    if (existing.rows[0]) return existing.rows[0];
    const { rows } = await db.query('INSERT INTO support_conversations (user_id) VALUES ($1) RETURNING *', [userId]);
    return rows[0];
  },
  async messages(conversationId) {
    const { rows } = await db.query(`SELECT sm.id, sm.sender_user_id, u.username, u.role, sm.message, sm.created_at FROM support_messages sm JOIN users u ON u.id = sm.sender_user_id WHERE sm.conversation_id = $1 ORDER BY sm.created_at ASC`, [conversationId]);
    return rows;
  },
  async addMessage(conversationId, senderUserId, message) {
    const { rows } = await db.query('INSERT INTO support_messages (conversation_id, sender_user_id, message) VALUES ($1,$2,$3) RETURNING *', [conversationId, senderUserId, message]);
    await db.query('UPDATE support_conversations SET updated_at = NOW(), status = \'open\' WHERE id = $1', [conversationId]);
    return rows[0];
  },
  async listConversations() {
    const { rows } = await db.query(`SELECT c.id, c.user_id, u.username, u.email, c.status, c.updated_at, c.created_at, (SELECT message FROM support_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message FROM support_conversations c JOIN users u ON u.id = c.user_id ORDER BY c.updated_at DESC`);
    return rows;
  },
  async findConversation(id) {
    const { rows } = await db.query('SELECT * FROM support_conversations WHERE id = $1', [id]);
    return rows[0] || null;
  },
};

module.exports=Support;