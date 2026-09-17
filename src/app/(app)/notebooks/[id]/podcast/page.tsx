'use client';

import { useState, useEffect, useRef } from 'react';
import { Headphones, Loader2, Play, Pause, Square, User, UserRound } from 'lucide-react';

interface ScriptLine {
  host: 'Alex' | 'Sam';
  text: string;
}

export default function PodcastPage({ params }: { params: Promise<{ id: string }> }) {
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [script, setScript] = useState<ScriptLine[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    params.then(p => setNotebookId(p.id));
    
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (synthRef.current) synthRef.current.cancel();
    };
  }, [params]);

  const generatePodcast = async () => {
    if (!notebookId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/podcast`);
      if (!res.ok) throw new Error('Failed to generate podcast script');
      const data = await res.json();
      setScript(data.script || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const playPodcast = async () => {
    if (!synthRef.current || script.length === 0) return;
    
    // Ensure voices are loaded
    let voices = synthRef.current.getVoices();
    if (voices.length === 0) {
      await new Promise(resolve => {
        window.speechSynthesis.onvoiceschanged = () => {
          voices = synthRef.current!.getVoices();
          resolve(true);
        };
      });
    }

    // Attempt to find English voices (preferably different genders/accents for Alex and Sam)
    const englishVoices = voices.filter(v => v.lang.startsWith('en'));
    const alexVoice = englishVoices.find(v => v.name.includes('Male') || v.name.includes('David') || v.name.includes('George')) || englishVoices[0];
    const samVoice = englishVoices.find(v => v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Hazel')) || englishVoices[1] || englishVoices[0];

    setIsPlaying(true);
    setCurrentLineIndex(0);

    const speakLine = (index: number) => {
      if (!synthRef.current || index >= script.length) {
        setIsPlaying(false);
        setCurrentLineIndex(-1);
        return;
      }

      const line = script[index];
      const utterance = new SpeechSynthesisUtterance(line.text);
      utterance.voice = line.host === 'Alex' ? alexVoice : samVoice;
      utterance.rate = 1.0;
      utterance.pitch = line.host === 'Alex' ? 1.0 : 1.2;
      
      utterance.onstart = () => setCurrentLineIndex(index);
      
      utterance.onend = () => {
        // Automatically proceed to next line
        if (isPlaying) {
            speakLine(index + 1);
        }
      };
      
      utterance.onerror = (e) => {
        console.error('Speech synthesis error', e);
        setIsPlaying(false);
      };

      synthRef.current.speak(utterance);
    };

    synthRef.current.cancel(); // clear queue
    speakLine(0);
  };

  const stopPodcast = () => {
    if (synthRef.current) synthRef.current.cancel();
    setIsPlaying(false);
    setCurrentLineIndex(-1);
  };

  const pauseResumePodcast = () => {
    if (!synthRef.current) return;
    
    if (synthRef.current.paused) {
      synthRef.current.resume();
      setIsPlaying(true);
    } else {
      synthRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0a0a0c]">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Headphones className="text-rose-500" /> Audio Overview
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Listen to a generated podcast discussing the key concepts in your workspace.
          </p>
        </div>

        {!loading && script.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-[#1a1a1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm text-center">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mb-4">
              <Headphones size={32} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Generate a Podcast</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
              Our AI will write an engaging two-host script based on your workspace's knowledge and play it back for you.
            </p>
            <button
              onClick={generatePodcast}
              className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-colors shadow-sm"
            >
              Generate Episode
            </button>
            {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 size={32} className="animate-spin text-rose-500" />
            <p className="text-gray-500 animate-pulse">Writing the script and booking the hosts...</p>
          </div>
        )}

        {script.length > 0 && !loading && (
          <div className="bg-white dark:bg-[#1a1a1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm p-8">
            <div className="flex items-center gap-4 mb-8 bg-gray-50 dark:bg-white/5 p-4 rounded-xl">
              {!isPlaying && currentLineIndex === -1 ? (
                <button
                  onClick={playPodcast}
                  className="w-12 h-12 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-md"
                >
                  <Play className="ml-1" fill="currentColor" />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={pauseResumePodcast}
                    className="w-12 h-12 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-md"
                  >
                    {isPlaying ? <Pause fill="currentColor" /> : <Play className="ml-1" fill="currentColor" />}
                  </button>
                  <button
                    onClick={stopPodcast}
                    className="w-12 h-12 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200 rounded-full flex items-center justify-center transition-colors"
                  >
                    <Square fill="currentColor" size={16} />
                  </button>
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Now Playing</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isPlaying ? 'Reading script...' : 'Ready to play'}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {script.map((line, idx) => {
                const isCurrent = currentLineIndex === idx;
                const isAlex = line.host === 'Alex';
                
                return (
                  <div key={idx} className={`flex gap-4 p-4 rounded-xl transition-colors ${isCurrent ? 'bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30' : ''}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isAlex ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                      {isAlex ? <User size={20} /> : <UserRound size={20} />}
                    </div>
                    <div>
                      <div className="font-semibold text-sm mb-1 opacity-70 flex items-center gap-2">
                        {line.host}
                        {isCurrent && (
                          <span className="flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        )}
                      </div>
                      <p className={`text-lg leading-relaxed ${isCurrent ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                        {line.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
