import React from 'react';
import { BookOpen, ShieldCheck, Volume2, Video, AlertOctagon, X } from 'lucide-react';
import Button from '../common/Button';

const RoomRulesModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-cyan-950/50 text-indigo-600 dark:text-cyan-400 border border-indigo-200 dark:border-cyan-900/50">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Room Rules & Safety Guidelines
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Standards for safe, respectful real-time collaboration
            </p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">Respectful Interaction</span>
              Treat all call participants with dignity and civility. Harassment, threats, hate speech, and discriminatory behavior are strictly prohibited.
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start space-x-3">
            <Volume2 className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">Microphone Etiquette</span>
              Keep background noise to a minimum. Use headphones if possible. Room hosts reserve the right to mute microphones to preserve audio clarity.
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start space-x-3">
            <Video className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">Appropriate Camera Content</span>
              Broadcast only appropriate, safe-for-work video. Any visual nudity, explicit imagery, or disruptive visuals will result in immediate ejection.
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 flex items-start space-x-3">
            <AlertOctagon className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-rose-700 dark:text-rose-300 block">Host Enforcement</span>
              Room hosts have complete authority to mute audio, disable camera feeds, eject participants, or permanently ban bad actors.
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="primary" size="md" className="w-full" onClick={onClose}>
            I Understand
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RoomRulesModal;
