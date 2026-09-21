import React, { useState, useEffect, useRef } from 'react';
import { Globe, Loader2, RefreshCw, AlertCircle, ChevronDown, Check } from 'lucide-react';
import { translateComment } from '../services/translationService';
import LanguageSelector, { fetchSupportedLanguagesCached } from './LanguageSelector';

const CommentTranslation = ({
  commentId,
  originalContent,
  onTranslationStateChange,
  isDeleted = false,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    // Default to browser language or Hindi/English
    const browserLang = navigator.language?.split('-')[0]?.toLowerCase();
    return browserLang || 'en';
  });
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [translation, setTranslation] = useState(null);
  const [isShowingTranslated, setIsShowingTranslated] = useState(false);
  const buttonContainerRef = useRef(null);

  // Load language names for nice labels
  useEffect(() => {
    let isMounted = true;
    fetchSupportedLanguagesCached()
      .then((langs) => {
        if (isMounted) setLanguages(langs);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // When comment changes externally (e.g. edited), reset translation state
  useEffect(() => {
    setTranslation(null);
    setIsShowingTranslated(false);
    setError(null);
    if (onTranslationStateChange) {
      onTranslationStateChange({
        isShowingTranslated: false,
        translatedContent: null,
        translationData: null,
      });
    }
  }, [originalContent]);

  // Helper to find language name from code
  const getLanguageName = (code) => {
    if (!code) return '';
    const match = languages.find((l) => l.code.toLowerCase() === code.toLowerCase());
    return match ? match.name : code.toUpperCase();
  };

  const handlePerformTranslation = async (targetLang) => {
    if (isDeleted || !originalContent) return;
    setLoading(true);
    setError(null);
    setIsPickerOpen(false);

    try {
      const res = await translateComment(commentId, targetLang);
      if (res && res.success && res.translation) {
        setTranslation(res.translation);
        setIsShowingTranslated(true);
        setSelectedLanguage(targetLang);
        if (onTranslationStateChange) {
          onTranslationStateChange({
            isShowingTranslated: true,
            translatedContent: res.translation.translatedContent,
            translationData: res.translation,
          });
        }
      } else {
        throw new Error(res?.message || 'Translation could not be completed');
      }
    } catch (err) {
      console.error('[CommentTranslation] Translation error:', err);
      const msg = err.response?.data?.message || err.message || 'Translation failed. Please try again.';
      setError(msg);
      setIsShowingTranslated(false);
      if (onTranslationStateChange) {
        onTranslationStateChange({
          isShowingTranslated: false,
          translatedContent: null,
          translationData: null,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleView = () => {
    const nextState = !isShowingTranslated;
    setIsShowingTranslated(nextState);
    if (onTranslationStateChange) {
      onTranslationStateChange({
        isShowingTranslated: nextState,
        translatedContent: translation ? translation.translatedContent : null,
        translationData: translation,
      });
    }
  };

  const handleLanguageSelect = (langCode) => {
    setSelectedLanguage(langCode);
    handlePerformTranslation(langCode);
  };

  if (isDeleted) return null;

  return (
    <div className="relative inline-flex items-center" ref={buttonContainerRef}>
      {/* If translation already exists, show quick toggle or options */}
      {translation ? (
        <div className="inline-flex items-center space-x-1.5 text-xs">
          <button
            type="button"
            onClick={handleToggleView}
            className="inline-flex items-center space-x-1 py-1 px-2.5 rounded-full text-indigo-600 dark:text-cyan-400 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors focus:outline-none"
            aria-label={isShowingTranslated ? 'See original comment' : 'See translated comment'}
          >
            <Globe className="w-3.5 h-3.5 mr-0.5" />
            <span>{isShowingTranslated ? 'See original' : `See translation (${getLanguageName(translation.targetLanguage)})`}</span>
          </button>

          {/* Language selector button to change language */}
          <button
            type="button"
            onClick={() => setIsPickerOpen((prev) => !prev)}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
            title="Translate to another language"
            aria-label="Translate to another language"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Translate action button when not yet translated */
        <div className="inline-flex items-center">
          <button
            type="button"
            onClick={() => {
              if (!loading) {
                // If user hasn't translated yet, open language picker so they can choose
                setIsPickerOpen((prev) => !prev);
              }
            }}
            disabled={loading}
            aria-label="Translate comment"
            className="inline-flex items-center space-x-1 py-1 px-2.5 rounded-full hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 mr-0.5 animate-spin text-indigo-600 dark:text-cyan-400" />
            ) : (
              <Globe className="w-3.5 h-3.5 mr-0.5" />
            )}
            <span aria-live="polite">
              {loading ? 'Translating...' : 'Translate'}
            </span>
          </button>
        </div>
      )}

      {/* Language Selector Dropdown */}
      <LanguageSelector
        selectedLanguage={selectedLanguage}
        onSelectLanguage={handleLanguageSelect}
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        title="Translate comment to"
      />

      {/* Inline Error Message */}
      {error && (
        <div className="absolute left-0 top-full mt-1.5 z-30 p-2.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-lg shadow-md text-xs text-rose-700 dark:text-rose-300 max-w-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1 min-w-0">
            <p className="leading-tight">{error}</p>
            <div className="mt-1.5 flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handlePerformTranslation(selectedLanguage)}
                className="font-semibold underline hover:no-underline text-rose-800 dark:text-rose-200"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentTranslation;
