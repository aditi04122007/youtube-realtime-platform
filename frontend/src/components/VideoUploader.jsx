import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, Film, X, CheckCircle, AlertCircle } from 'lucide-react';

const ALLOWED_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const VideoUploader = ({
  file,
  onChange,
  onClear,
  error = null,
  disabled = false,
}) => {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [videoDuration, setVideoDuration] = useState(null);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
      setVideoDuration(null);
    }
  }, [file]);

  const validateAndSelect = (selectedFile) => {
    setLocalError(null);
    if (!selectedFile) return;

    // Check extension
    const ext = `.${selectedFile.name.split('.').pop().toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setLocalError(`Invalid video type (${ext}). Please select an MP4, WebM, MOV, or M4V video.`);
      return;
    }

    // Check size
    if (selectedFile.size > MAX_SIZE_BYTES) {
      setLocalError(`File size exceeds 500 MB limit (${formatBytes(selectedFile.size)}).`);
      return;
    }

    onChange(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelect(e.target.files[0]);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLocalError(null);
    onClear();
  };

  const activeError = error || localError;

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
        className="hidden"
        disabled={disabled}
        onChange={handleFileInputChange}
      />

      {!file ? (
        // Dropzone when no file selected
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[260px] ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[1.01]'
              : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/60'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">
            Drag and drop video files to upload
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm">
            Your videos will be private until you publish them. Supports MP4, WebM, MOV, and M4V.
          </p>

          <button
            type="button"
            disabled={disabled}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition-all focus:ring-2 focus:ring-indigo-400"
          >
            Select Video File
          </button>

          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-4">
            Maximum file size: 500 MB
          </span>
        </div>
      ) : (
        // Video Preview & File Details
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 overflow-hidden">
          <div className="flex flex-col md:flex-row gap-5 items-start">
            {/* 16:9 Video Player Preview */}
            <div className="relative w-full md:w-72 aspect-video bg-black rounded-xl overflow-hidden shadow-inner flex-shrink-0">
              {previewUrl && (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Video File Meta */}
            <div className="flex-1 min-w-0 w-full flex flex-col justify-between h-full space-y-3">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle className="w-3 h-3 mr-1" /> Ready for upload
                  </span>
                  {videoDuration && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Duration: {formatDuration(videoDuration)}
                    </span>
                  )}
                </div>

                <h4 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate" title={file.name}>
                  {file.name}
                </h4>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>Size: <strong className="text-slate-700 dark:text-slate-300">{formatBytes(file.size)}</strong></span>
                  <span>Type: <strong className="text-slate-700 dark:text-slate-300">{file.type || 'video'}</strong></span>
                </div>
              </div>

              {/* Action buttons */}
              {!disabled && (
                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"
                  >
                    Change Video File
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline flex items-center"
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error alert */}
      {activeError && (
        <div className="flex items-center space-x-2 mt-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/40">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{activeError}</span>
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
