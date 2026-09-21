import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCallRoom } from '../../services/callRoomService';
import Button from '../common/Button';
import { Video, Users, User, X, AlertCircle, Loader2 } from 'lucide-react';

const CreateRoomModal = ({ isOpen, onClose }) => {
  const [roomType, setRoomType] = useState('GROUP'); // 'GROUP' | 'ONE_TO_ONE'
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await createCallRoom({
        roomType,
        maxParticipants: roomType === 'ONE_TO_ONE' ? 2 : maxParticipants,
      });

      if (res?.success && res.room?.roomCode) {
        onClose();
        navigate(`/call-room/${res.room.roomCode}`);
      } else {
        setError(res?.message || 'Failed to create room.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error creating call room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-cyan-950/40 flex items-center justify-center text-indigo-600 dark:text-cyan-400">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create Video Room</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Instant encrypted peer-to-peer room</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-2xl text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-5">
          {/* Room Type Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Room Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setRoomType('ONE_TO_ONE');
                  setMaxParticipants(2);
                }}
                className={`p-4 rounded-2xl border flex flex-col items-center justify-center space-y-2 text-center transition-all ${
                  roomType === 'ONE_TO_ONE'
                    ? 'border-indigo-600 dark:border-cyan-400 bg-indigo-50/50 dark:bg-cyan-950/20 text-indigo-600 dark:text-cyan-400 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <User className="w-5 h-5" />
                <span className="text-xs">One-to-One</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRoomType('GROUP');
                  setMaxParticipants(6);
                }}
                className={`p-4 rounded-2xl border flex flex-col items-center justify-center space-y-2 text-center transition-all ${
                  roomType === 'GROUP'
                    ? 'border-indigo-600 dark:border-cyan-400 bg-indigo-50/50 dark:bg-cyan-950/20 text-indigo-600 dark:text-cyan-400 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-xs">Group Call</span>
              </button>
            </div>
          </div>

          {/* Participant Limit for Group Call */}
          {roomType === 'GROUP' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Maximum Participants
                </label>
                <span className="font-bold text-indigo-600 dark:text-cyan-400">{maxParticipants} Participants</span>
              </div>
              <input
                type="range"
                min="2"
                max="6"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-cyan-400"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
                <span>6 (Max)</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center space-x-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="flex-1"
              disabled={loading}
              leftIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
            >
              {loading ? 'Creating...' : 'Start Room'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;
