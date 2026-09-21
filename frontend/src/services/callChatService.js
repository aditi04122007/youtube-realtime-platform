import api from './api';

/**
 * Fetch messages for a call room with pagination
 * @param {string} roomCode
 * @param {object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 */
export const getMessages = async (roomCode, { page = 1, limit = 50 } = {}) => {
  const res = await api.get(`/call-rooms/${encodeURIComponent(roomCode)}/messages`, {
    params: { page, limit },
  });
  return res.data;
};

/**
 * Send a text message in a call room
 * @param {string} roomCode
 * @param {object} payload
 * @param {string} payload.text
 * @param {number} [payload.replyToMessageId]
 */
export const sendMessage = async (roomCode, { text, replyToMessageId }) => {
  const res = await api.post(`/call-rooms/${encodeURIComponent(roomCode)}/messages`, {
    text,
    replyToMessageId,
  });
  return res.data;
};

/**
 * Delete a message (Sender or Host)
 * @param {string} roomCode
 * @param {number|string} messageId
 */
export const deleteMessage = async (roomCode, messageId) => {
  const res = await api.delete(
    `/call-rooms/${encodeURIComponent(roomCode)}/messages/${encodeURIComponent(messageId)}`
  );
  return res.data;
};

/**
 * Upload and share a file in a call room
 * @param {string} roomCode
 * @param {File} file
 * @param {number} [replyToMessageId]
 * @param {Function} [onUploadProgress]
 */
export const uploadFile = async (roomCode, file, replyToMessageId = null, onUploadProgress = null) => {
  const formData = new FormData();
  formData.append('file', file);
  if (replyToMessageId) {
    formData.append('replyToMessageId', replyToMessageId);
  }

  const res = await api.post(
    `/call-rooms/${encodeURIComponent(roomCode)}/files`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (typeof onUploadProgress === 'function' && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percent);
        }
      },
    }
  );
  return res.data;
};

/**
 * Download a shared call file (streams authenticated binary and triggers browser save)
 * @param {string} roomCode
 * @param {number|string} fileId
 * @param {string} [filename]
 */
export const downloadFile = async (roomCode, fileId, filename = 'download') => {
  const res = await api.get(
    `/call-rooms/${encodeURIComponent(roomCode)}/files/${encodeURIComponent(fileId)}`,
    {
      responseType: 'blob',
    }
  );

  // Extract filename from content-disposition header if available
  let downloadName = filename;
  const disposition = res.headers['content-disposition'];
  if (disposition && disposition.indexOf('filename=') !== -1) {
    const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
    if (matches && matches[1]) {
      downloadName = matches[1].replace(/['"]/g, '');
    }
  }

  // Create temporary link and trigger download
  const blob = new Blob([res.data]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', downloadName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);

  return true;
};

/**
 * Delete a shared file (Uploader or Host)
 * @param {string} roomCode
 * @param {number|string} fileId
 */
export const deleteFile = async (roomCode, fileId) => {
  const res = await api.delete(
    `/call-rooms/${encodeURIComponent(roomCode)}/files/${encodeURIComponent(fileId)}`
  );
  return res.data;
};

/**
 * Mark a message as read
 * @param {string} roomCode
 * @param {number|string} messageId
 */
export const markMessageRead = async (roomCode, messageId) => {
  const res = await api.post(
    `/call-rooms/${encodeURIComponent(roomCode)}/messages/${encodeURIComponent(messageId)}/read`
  );
  return res.data;
};

export default {
  getMessages,
  sendMessage,
  deleteMessage,
  uploadFile,
  downloadFile,
  deleteFile,
  markMessageRead,
};
