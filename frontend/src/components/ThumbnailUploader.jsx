import React, { useRef, useState, useEffect } from 'react';
import { ImagePlus, X, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { getMediaUrl } from '../services/api';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ThumbnailUploader = ({
  file,
  currentUrl = null,
  onChange,
  onClear,
  error = null,
  disabled = false,
}) => {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (currentUrl) {
      setPreviewUrl(getMediaUrl(currentUrl));
    } else {
      setPreviewUrl(null);
    }
  }, [file, currentUrl]);

  const validateAndSelect = (selectedFile) => {
    setLocalError(null);
    if (!selectedFile) return;

    const ext = `.${selectedFile.name.split('.').pop().toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setLocalError(`Invalid image format (${ext}). Supported: JPEG, PNG, WebP.`);
      return;
    }

    if (selectedFile.size > MAX_SIZE_BYTES) {
      setLocalError('Thumbnail image must be under 5 MB.');
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
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={disabled}
        onChange={handleFileInputChange}
      />

      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
        Thumbnail <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(Optional)</span>
      </label>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">
        Select or upload a picture that shows what's in your video. A good thumbnail stands out and draws viewers' attention (16:9 ratio recommended).
      </p>

      {previewUrl ? (
        // Preview state
        <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black/90 w-full sm:w-64 aspect-video shadow-sm">
          <img
            src={previewUrl}
            alt="Thumbnail preview"
            className="w-full h-full object-cover"
          />
          {!disabled && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium hover:bg-white shadow"
              >
                Change
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="p-1.5 bg-rose-600/90 text-white rounded-lg text-xs font-medium hover:bg-rose-600 shadow"
                title="Remove thumbnail"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        // Empty upload dropzone
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 sm:p-6 text-center cursor-pointer transition-colors w-full sm:w-64 aspect-video flex flex-col items-center justify-center ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
              : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/40'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mb-2">
            <ImagePlus className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Upload thumbnail
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            JPEG, PNG, WebP (max 5 MB)
          </span>
        </div>
      )}

      {/* Error display */}
      {activeError && (
        <div className="flex items-center space-x-1.5 mt-2 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{activeError}</span>
        </div>
      )}
    </div>
  );
};

export default ThumbnailUploader;
