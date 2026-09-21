import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  FileArchive,
  File,
  Download,
  Trash2,
  CornerUpLeft,
  Check,
  CheckCheck,
  Loader2,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import {
  getMessages,
  sendMessage,
  deleteMessage,
  uploadFile,
  downloadFile,
  deleteFile,
  markMessageRead,
} from '../../services/callChatService';

/**
 * Format bytes to readable size (e.g. 1.5 MB)
 */
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Format message date/time
 */
const formatTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Get file icon based on mime type or extension
 */
const getFileIcon = (mimeType, originalName = '') => {
  const ext = originalName.split('.').pop().toLowerCase();
  if (mimeType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return <ImageIcon className="w-5 h-5 text-emerald-400" />;
  }
  if (['zip', 'rar', '7z'].includes(ext)) {
    return <FileArchive className="w-5 h-5 text-amber-400" />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'csv', 'xlsx', 'pptx'].includes(ext)) {
    return <FileText className="w-5 h-5 text-cyan-400" />;
  }
  return <File className="w-5 h-5 text-slate-400" />;
};

const InCallChatPanel = ({
  roomCode,
  currentUser,
  isHost,
  isOpen,
  onClose,
  socket,
  onUnreadCountChange,
}) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Input states
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { id, senderName, text }
  const [uploadProgress, setUploadProgress] = useState(null);
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [chatError, setChatError] = useState(null);

  // Typing indicators: Map of userId -> { username, displayName, timer }
  const [typingUsers, setTypingUsers] = useState({});

  const messagesEndRef = useRef(null);
  const chatScrollContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // 1. Initial messages fetch when roomCode changes
  useEffect(() => {
    if (!roomCode) return;
    let isMounted = true;

    const fetchInitial = async () => {
      try {
        setLoading(true);
        setChatError(null);
        const data = await getMessages(roomCode, { page: 1, limit: 50 });
        if (isMounted) {
          setMessages(data.messages || []);
          setHasMore(data.pagination?.hasMore || false);
          setPage(1);
        }
      } catch (err) {
        if (isMounted) {
          setChatError(err.response?.data?.message || 'Failed to load chat history');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInitial();

    return () => {
      isMounted = false;
    };
  }, [roomCode]);

  // 2. Auto-scroll to bottom when messages change and user is near bottom
  useEffect(() => {
    if (loading) return;
    if (chatScrollContainerRef.current) {
      const container = chatScrollContainerRef.current;
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 180;
      if (isNearBottom || messages.length <= 50) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, loading]);

  // 3. Socket event listeners for real-time chat & typing
  useEffect(() => {
    if (!socket || !roomCode) return;

    // Incoming new message (text or file)
    const handleNewMessage = (payload) => {
      if (payload.roomCode !== roomCode || !payload.message) return;
      const newMsg = payload.message;

      setMessages((prev) => {
        // Prevent duplicate appending if local user just sent it
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Mark read if chat is currently open and message is from someone else
      if (isOpen && newMsg.senderId !== currentUser?.id) {
        markMessageRead(roomCode, newMsg.id).catch(() => {});
        socket.emit('room:message-read', { roomCode, messageId: newMsg.id });
      } else if (!isOpen && newMsg.senderId !== currentUser?.id) {
        if (typeof onUnreadCountChange === 'function') {
          onUnreadCountChange((count) => count + 1);
        }
      }
    };

    // Message deleted
    const handleMessageDeleted = (payload) => {
      if (payload.roomCode !== roomCode || !payload.messageId) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === payload.messageId
            ? { ...msg, isDeleted: true, text: 'This message was deleted', file: null }
            : msg
        )
      );
    };

    // File deleted
    const handleFileDeleted = (payload) => {
      if (payload.roomCode !== roomCode || !payload.fileId) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.file?.id === payload.fileId
            ? { ...msg, isDeleted: true, text: 'This message was deleted', file: null }
            : msg
        )
      );
    };

    // Typing start
    const handleTypingStart = (payload) => {
      if (payload.roomCode !== roomCode || payload.userId === currentUser?.id) return;
      setTypingUsers((prev) => ({
        ...prev,
        [payload.userId]: {
          username: payload.username,
          displayName: payload.displayName || payload.username,
          timestamp: Date.now(),
        },
      }));
    };

    // Typing stop
    const handleTypingStop = (payload) => {
      if (payload.roomCode !== roomCode) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[payload.userId];
        return next;
      });
    };

    // Message read receipt
    const handleMessageRead = (payload) => {
      if (payload.roomCode !== roomCode || !payload.messageId) return;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === payload.messageId) {
            const reads = new Set(msg.readBy || []);
            reads.add(payload.userId);
            return { ...msg, readBy: Array.from(reads) };
          }
          return msg;
        })
      );
    };

    // Reconnection synchronization (Phase 28)
    const handleReconnect = async () => {
      try {
        console.log('[InCallChat] Socket reconnected, synchronizing message history...');
        const data = await getMessages(roomCode, { page: 1, limit: 50 });
        const fresh = data.messages || [];
        setMessages((prev) => {
          const prevIds = new Set(prev.map((m) => m.id));
          const toAdd = fresh.filter((m) => !prevIds.has(m.id));
          if (toAdd.length === 0) {
            const freshMap = new Map(fresh.map((m) => [m.id, m]));
            return prev.map((m) => {
              const updated = freshMap.get(m.id);
              if (updated && updated.isDeleted && !m.isDeleted) return updated;
              return m;
            });
          }
          const merged = [...prev, ...toAdd].sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          );
          return merged;
        });
      } catch (e) {
        console.warn('[InCallChat] Error reconciling messages on reconnect:', e.message);
      }
    };

    socket.on('room:chat-message', handleNewMessage);
    socket.on('room:chat-message-deleted', handleMessageDeleted);
    socket.on('room:file-deleted', handleFileDeleted);
    socket.on('room:typing-start', handleTypingStart);
    socket.on('room:typing-stop', handleTypingStop);
    socket.on('room:message-read', handleMessageRead);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('room:chat-message', handleNewMessage);
      socket.off('room:chat-message-deleted', handleMessageDeleted);
      socket.off('room:file-deleted', handleFileDeleted);
      socket.off('room:typing-start', handleTypingStart);
      socket.off('room:typing-stop', handleTypingStop);
      socket.off('room:message-read', handleMessageRead);
      socket.off('connect', handleReconnect);
    };
  }, [socket, roomCode, isOpen, currentUser?.id, onUnreadCountChange]);

  // 4. Mark all unread messages as read when panel is opened
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      if (typeof onUnreadCountChange === 'function') {
        onUnreadCountChange(0);
      }
      const unreadOthers = messages.filter(
        (m) => m.senderId !== currentUser?.id && !m.readBy?.includes(currentUser?.id)
      );
      unreadOthers.forEach((m) => {
        markMessageRead(roomCode, m.id).catch(() => {});
        if (socket) {
          socket.emit('room:message-read', { roomCode, messageId: m.id });
        }
      });
    }
  }, [isOpen, messages, currentUser?.id, roomCode, socket, onUnreadCountChange]);

  // 5. Load older messages pagination
  const handleLoadOlder = async () => {
    if (loadingOlder || !hasMore) return;
    try {
      setLoadingOlder(true);
      const nextPage = page + 1;
      const data = await getMessages(roomCode, { page: nextPage, limit: 50 });
      setMessages((prev) => [...(data.messages || []), ...prev]);
      setHasMore(data.pagination?.hasMore || false);
      setPage(nextPage);
    } catch (err) {
      setChatError(err.response?.data?.message || 'Failed to load older messages');
    } finally {
      setLoadingOlder(false);
    }
  };

  // 6. Typing debounce handler
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (!socket || !roomCode) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('room:typing-start', { roomCode });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('room:typing-stop', { roomCode });
    }, 2500);
  };

  // 7. Send text message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;

    // Clear typing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current && socket) {
      isTypingRef.current = false;
      socket.emit('room:typing-stop', { roomCode });
    }

    try {
      setSending(true);
      setChatError(null);
      const res = await sendMessage(roomCode, {
        text: trimmed,
        replyToMessageId: replyingTo?.id || null,
      });

      if (res.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.message.id)) return prev;
          return [...prev, res.message];
        });
      }

      setInputText('');
      setReplyingTo(null);
    } catch (err) {
      setChatError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // 8. Delete message handler
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      await deleteMessage(roomCode, messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, isDeleted: true, text: 'This message was deleted', file: null }
            : m
        )
      );
    } catch (err) {
      setChatError(err.response?.data?.message || 'Failed to delete message');
    }
  };

  // 9. File upload handler
  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local file validation check before upload
    const maxBytes = 25 * 1024 * 1024; // 25 MB
    if (file.size > maxBytes) {
      setChatError('File is too large. Maximum allowed size is 25 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setSending(true);
      setUploadProgress(0);
      setChatError(null);

      const res = await uploadFile(
        roomCode,
        file,
        replyingTo?.id || null,
        (percent) => setUploadProgress(percent)
      );

      if (res.chatMessage) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.chatMessage.id)) return prev;
          return [...prev, res.chatMessage];
        });
      }

      setReplyingTo(null);
    } catch (err) {
      setChatError(err.response?.data?.message || 'File upload failed. Please try again.');
    } finally {
      setSending(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 10. File download handler
  const handleDownloadFile = async (file) => {
    if (!file || downloadingFileId) return;
    try {
      setDownloadingFileId(file.id);
      await downloadFile(roomCode, file.id, file.originalName);
    } catch (err) {
      setChatError(err.response?.data?.message || 'Failed to download file');
    } finally {
      setDownloadingFileId(null);
    }
  };

  // 11. File delete handler
  const handleDeleteFile = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this shared file?')) return;
    try {
      await deleteFile(roomCode, fileId);
      setMessages((prev) =>
        prev.map((m) =>
          m.file?.id === fileId
            ? { ...m, isDeleted: true, text: 'This message was deleted', file: null }
            : m
        )
      );
    } catch (err) {
      setChatError(err.response?.data?.message || 'Failed to delete file');
    }
  };

  // Typing indicator text
  const typingList = Object.values(typingUsers);
  let typingLabel = '';
  if (typingList.length === 1) {
    typingLabel = `${typingList[0].displayName} is typing...`;
  } else if (typingList.length === 2) {
    typingLabel = `${typingList[0].displayName} and ${typingList[1].displayName} are typing...`;
  } else if (typingList.length > 2) {
    typingLabel = 'Several people are typing...';
  }

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 border-l border-slate-800 text-white select-text">
      {/* 1. Header */}
      <div className="p-3.5 sm:p-4 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>In-Call Chat</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            </h3>
            <p className="text-[11px] text-slate-400">Messages are private to this room</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Close Chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Error Banner */}
      {chatError && (
        <div className="mx-3 mt-2 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{chatError}</span>
          </div>
          <button
            onClick={() => setChatError(null)}
            className="text-rose-400 hover:text-white ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Messages List */}
      <div
        ref={chatScrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0"
      >
        {/* Load older button */}
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              onClick={handleLoadOlder}
              disabled={loadingOlder}
              className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 transition-colors flex items-center space-x-1.5"
            >
              {loadingOlder && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>Load older messages</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-400 text-center px-4">
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60">
              <MessageSquare className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-xs font-medium text-slate-300">No messages yet</p>
            <p className="text-[11px] text-slate-500">
              Say hello or share documents with participants in this call!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.id;
            const canDelete = isMe || isHost;

            return (
              <div
                key={msg.id}
                className={`group flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
              >
                {/* Sender name & time */}
                <div className="flex items-center space-x-2 px-1 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">
                    {isMe ? 'You' : msg.sender?.displayName || msg.sender?.username}
                  </span>
                  <span>•</span>
                  <span>{formatTime(msg.createdAt)}</span>
                </div>

                {/* Bubble Container */}
                <div
                  className={`relative max-w-[85%] rounded-2xl p-3 shadow-md transition-all ${
                    msg.isDeleted
                      ? 'bg-slate-800/50 border border-slate-700/50 text-slate-400 italic text-xs'
                      : isMe
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/60'
                  }`}
                >
                  {/* Reply Quote Banner */}
                  {msg.replyTo && !msg.isDeleted && (
                    <div
                      className={`mb-2 p-2 rounded-xl text-xs border-l-2 ${
                        isMe
                          ? 'bg-indigo-700/60 border-indigo-300 text-indigo-100'
                          : 'bg-slate-700/60 border-indigo-400 text-slate-300'
                      }`}
                    >
                      <div className="font-bold text-[10px] text-indigo-200">
                        Replying to {msg.replyTo.senderName}
                      </div>
                      <div className="truncate text-[11px] opacity-90">
                        {msg.replyTo.text}
                      </div>
                    </div>
                  )}

                  {/* Deleted Message */}
                  {msg.isDeleted ? (
                    <p className="text-xs text-slate-400 italic flex items-center space-x-1.5">
                      <span>This message was deleted</span>
                    </p>
                  ) : msg.messageType === 'FILE' && msg.file ? (
                    /* Shared File Card */
                    <div className="space-y-2">
                      {msg.file.isImage && (
                        <div className="rounded-xl overflow-hidden max-h-48 bg-black/20 border border-white/10">
                          <img
                            src={msg.file.downloadUrl}
                            alt={msg.file.originalName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // If authenticated image preview fails, hide the image element
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-black/20 border border-white/10">
                        <div className="p-2 rounded-lg bg-white/10">
                          {getFileIcon(msg.file.mimeType, msg.file.originalName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate text-white" title={msg.file.originalName}>
                            {msg.file.originalName}
                          </p>
                          <p className="text-[10px] text-slate-300">
                            {formatFileSize(msg.file.fileSize)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownloadFile(msg.file)}
                          disabled={downloadingFileId === msg.file.id}
                          className="p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
                          title="Download file"
                        >
                          {downloadingFileId === msg.file.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Text Message */
                    <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                      {msg.text}
                    </p>
                  )}

                  {/* Actions overlay on hover (Reply, Delete) */}
                  {!msg.isDeleted && (
                    <div
                      className={`absolute top-1 ${
                        isMe ? '-left-14' : '-right-14'
                      } hidden group-hover:flex items-center space-x-1 bg-slate-900/90 border border-slate-700 px-1.5 py-1 rounded-xl shadow-lg backdrop-blur z-10`}
                    >
                      <button
                        onClick={() =>
                          setReplyingTo({
                            id: msg.id,
                            senderName: msg.sender?.displayName || msg.sender?.username,
                            text: msg.text,
                          })
                        }
                        className="p-1 text-slate-400 hover:text-white transition-colors"
                        title="Reply"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() =>
                            msg.file
                              ? handleDeleteFile(msg.file.id)
                              : handleDeleteMessage(msg.id)
                          }
                          className="p-1 text-rose-400 hover:text-rose-300 transition-colors"
                          title="Delete message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Read receipt checkmark for sender */}
                {isMe && !msg.isDeleted && (
                  <div className="flex items-center space-x-1 pr-1 text-[10px] text-slate-400">
                    {msg.readBy && msg.readBy.length > 1 ? (
                      <span className="flex items-center text-indigo-400" title="Read by participants">
                        <CheckCheck className="w-3 h-3" />
                      </span>
                    ) : (
                      <span title="Delivered">
                        <Check className="w-3 h-3 text-slate-400" />
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Typing Indicator Banner */}
      {typingLabel && (
        <div className="px-4 py-1.5 text-[11px] text-indigo-300/90 italic flex items-center space-x-1.5 flex-shrink-0 animate-pulse">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400" />
          <span>{typingLabel}</span>
        </div>
      )}

      {/* 4. Reply Preview Banner */}
      {replyingTo && (
        <div className="px-3.5 py-2 bg-slate-800/80 border-t border-slate-700/60 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2 text-xs truncate">
            <CornerUpLeft className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span className="text-slate-400">Replying to</span>
            <span className="font-semibold text-white">{replyingTo.senderName}:</span>
            <span className="truncate text-slate-300 italic">{replyingTo.text}</span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-slate-400 hover:text-white ml-2 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5. Upload Progress Bar */}
      {uploadProgress !== null && (
        <div className="px-4 py-1.5 bg-slate-800 border-t border-slate-700 flex-shrink-0">
          <div className="flex justify-between text-[10px] text-slate-300 mb-1">
            <span>Uploading file...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* 6. Input Area */}
      <div className="p-3 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          {/* File Picker Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50"
            title="Attach a file (Max 25 MB)"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelected}
            className="hidden"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif,.zip,.rar,.7z"
          />

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder="Type a message..."
            disabled={sending}
            maxLength={2000}
            className="flex-1 bg-slate-800/90 text-white placeholder-slate-400 text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition-all shadow-md"
            title="Send message"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default InCallChatPanel;
