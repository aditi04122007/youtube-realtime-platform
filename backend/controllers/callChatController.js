const callChatService = require('../services/callChatService');

/**
 * 1. Send In-Call Text Message
 * POST /api/call-rooms/:roomCode/messages
 */
const sendMessage = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { text, replyToMessageId } = req.body;
    const senderId = req.user?.id;

    const message = await callChatService.sendMessage({
      roomCode,
      senderId,
      text,
      replyToMessageId,
    });

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (err) {
    console.error('[CallChatController] sendMessage error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to send message',
    });
  }
};

/**
 * 2. Get In-Call Messages (Paginated)
 * GET /api/call-rooms/:roomCode/messages
 */
const getMessages = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { page, limit } = req.query;
    const userId = req.user?.id;

    const result = await callChatService.getMessages({
      roomCode,
      userId,
      page,
      limit,
    });

    return res.json({
      success: true,
      messages: result.messages,
      pagination: result.pagination,
    });
  } catch (err) {
    console.error('[CallChatController] getMessages error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to fetch messages',
    });
  }
};

/**
 * 3. Soft Delete In-Call Message
 * DELETE /api/call-rooms/:roomCode/messages/:messageId
 */
const deleteMessage = async (req, res) => {
  try {
    const { roomCode, messageId } = req.params;
    const userId = req.user?.id;

    const result = await callChatService.deleteMessage({
      roomCode,
      userId,
      messageId,
    });

    return res.json({
      success: true,
      message: 'Message deleted successfully',
      ...result,
    });
  } catch (err) {
    console.error('[CallChatController] deleteMessage error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to delete message',
    });
  }
};

/**
 * 4. Upload and Share File in Call Room
 * POST /api/call-rooms/:roomCode/files
 */
const uploadFile = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { replyToMessageId } = req.body;
    const uploaderId = req.user?.id;
    const file = req.file;

    const result = await callChatService.uploadFile({
      roomCode,
      uploaderId,
      file,
      replyToMessageId,
    });

    return res.status(201).json({
      success: true,
      message: 'File shared successfully',
      sharedFile: result.file,
      chatMessage: result.message,
    });
  } catch (err) {
    console.error('[CallChatController] uploadFile error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to upload and share file',
    });
  }
};

/**
 * 5. Download Shared File (Authenticated Stream)
 * GET /api/call-rooms/:roomCode/files/:fileId
 */
const downloadFile = async (req, res) => {
  try {
    const { roomCode, fileId } = req.params;
    const userId = req.user?.id;

    await callChatService.downloadFile({
      roomCode,
      userId,
      fileId,
      res,
    });
  } catch (err) {
    console.error('[CallChatController] downloadFile error:', err.message);
    const status = err.statusCode || 500;
    // Note: If headers have already been sent, don't send json
    if (!res.headersSent) {
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to download file',
      });
    }
  }
};

/**
 * 6. Delete Shared File
 * DELETE /api/call-rooms/:roomCode/files/:fileId
 */
const deleteFile = async (req, res) => {
  try {
    const { roomCode, fileId } = req.params;
    const userId = req.user?.id;

    const result = await callChatService.deleteFile({
      roomCode,
      userId,
      fileId,
    });

    return res.json({
      success: true,
      message: 'File deleted successfully',
      ...result,
    });
  } catch (err) {
    console.error('[CallChatController] deleteFile error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to delete file',
    });
  }
};

/**
 * 7. Mark Message as Read
 * POST /api/call-rooms/:roomCode/messages/:messageId/read
 */
const markMessageRead = async (req, res) => {
  try {
    const { roomCode, messageId } = req.params;
    const userId = req.user?.id;

    const result = await callChatService.markMessageRead({
      roomCode,
      userId,
      messageId,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('[CallChatController] markMessageRead error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to mark message as read',
    });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  deleteMessage,
  uploadFile,
  downloadFile,
  deleteFile,
  markMessageRead,
};
