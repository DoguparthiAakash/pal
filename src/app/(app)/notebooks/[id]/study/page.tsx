'use client';

import { useState, useEffect } from 'react';
import { GraduationCap, Loader2, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';

interface Flashcard {
  front: string;
  back: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export default function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  
  const [activeTab, setActiveTab] = useState<'flashcards' | 'quiz'>('flashcards');
  
  // Flashcard state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    params.then(p => setNotebookId(p.id));
  }, [params]);

  const generateStudySet = async () => {
    if (!notebookId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/study`);
      if (!res.ok) throw new Error('Failed to generate study set');
      const data = await res.json();
      setFlashcards(data.flashcards || []);
      setQuiz(data.quiz || []);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setSelectedAnswers({});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex((prev) => Math.min(prev + 1, flashcards.length - 1));
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex((prev) => Math.max(prev - 1, 0));
    }, 150);
  };

  const handleQuizAnswer = (qIndex: number, optIndex: number) => {
    if (selectedAnswers[qIndex] !== undefined) return; // already answered
    setSelectedAnswers(prev => ({ ...prev, [qIndex]: optIndex }));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0a0a0c]">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="text-emerald-500" /> Study Mode
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Test your knowledge with AI-generated flashcards and quizzes.
          </p>
        </div>

        {!loading && flashcards.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-[#1a1a1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-4">
              <GraduationCap size={32} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Ready to Study?</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
              Generate a personalized study set based on the knowledge graph extracted from your documents.
            </p>
            <button
              onClick={generateStudySet}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors shadow-sm"
            >
              Generate Study Set
            </button>
            {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 size={32} className="animate-spin text-emerald-500" />
            <p className="text-gray-500 animate-pulse">Designing your curriculum...</p>
          </div>
        )}

        {flashcards.length > 0 && !loading && (
          <div>
            <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-white/10 pb-2">
              <button
                onClick={() => setActiveTab('flashcards')}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'flashcards' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
              >
                Flashcards
              </button>
              <button
                onClick={() => setActiveTab('quiz')}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'quiz' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
              >
                Quiz
              </button>
            </div>

            {activeTab === 'flashcards' && (
              <div className="flex flex-col items-center">
                <div className="mb-4 text-sm text-gray-500 font-medium">
                  Card {currentCardIndex + 1} of {flashcards.length}
                </div>
                
                <div 
                  className="w-full max-w-2xl h-80 relative perspective-1000 cursor-pointer"
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <div className={`w-full h-full absolute transition-transform duration-500 transform-style-preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                    {/* Front */}
                    <div className="w-full h-full absolute backface-hidden bg-white dark:bg-[#1a1a1c] border-2 border-gray-200 dark:border-white/10 rounded-2xl shadow-sm flex items-center justify-center p-8 text-center">
                      <div>
                        <p className="text-sm text-emerald-500 font-medium uppercase tracking-wider mb-4">Question</p>
                        <h3 className="text-2xl font-semibold">{flashcards[currentCardIndex].front}</h3>
                      </div>
                    </div>
                    {/* Back */}
                    <div className="w-full h-full absolute backface-hidden rotate-y-180 bg-emerald-50 dark:bg-emerald-900/10 border-2 border-emerald-200 dark:border-emerald-800/30 rounded-2xl shadow-sm flex items-center justify-center p-8 text-center">
                      <div>
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wider mb-4">Answer</p>
                        <p className="text-xl">{flashcards[currentCardIndex].back}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 mt-8">
                  <button
                    onClick={prevCard}
                    disabled={currentCardIndex === 0}
                    className="p-3 bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/10 rounded-full disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="px-6 py-2 bg-gray-100 dark:bg-white/5 rounded-full text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                  >
                    Flip
                  </button>
                  <button
                    onClick={nextCard}
                    disabled={currentCardIndex === flashcards.length - 1}
                    className="p-3 bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/10 rounded-full disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'quiz' && (
              <div className="space-y-8 max-w-3xl mx-auto">
                {quiz.map((q, qIndex) => {
                  const answered = selectedAnswers[qIndex] !== undefined;
                  const selectedIdx = selectedAnswers[qIndex];
                  const isCorrect = selectedIdx === q.correctOptionIndex;

                  return (
                    <div key={qIndex} className="bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                      <h3 className="text-lg font-medium mb-4"><span className="text-emerald-500 mr-2">{qIndex + 1}.</span>{q.question}</h3>
                      <div className="space-y-3">
                        {q.options.map((opt, optIndex) => {
                          let btnClass = "w-full text-left p-4 rounded-xl border transition-colors ";
                          
                          if (!answered) {
                            btnClass += "border-gray-200 dark:border-white/10 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10";
                          } else {
                            if (optIndex === q.correctOptionIndex) {
                              btnClass += "bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300";
                            } else if (optIndex === selectedIdx) {
                              btnClass += "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300";
                            } else {
                              btnClass += "border-gray-200 dark:border-white/10 opacity-50";
                            }
                          }

                          return (
                            <button
                              key={optIndex}
                              onClick={() => handleQuizAnswer(qIndex, optIndex)}
                              disabled={answered}
                              className={btnClass}
                            >
                              <div className="flex justify-between items-center">
                                <span>{opt}</span>
                                {answered && optIndex === q.correctOptionIndex && <CheckCircle size={18} className="text-green-500" />}
                                {answered && optIndex === selectedIdx && optIndex !== q.correctOptionIndex && <XCircle size={18} className="text-red-500" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      
                      {answered && (
                        <div className={`mt-4 p-4 rounded-xl text-sm ${isCorrect ? 'bg-green-50 dark:bg-green-900/10 text-green-800 dark:text-green-200' : 'bg-gray-50 dark:bg-white/5'}`}>
                          <span className="font-semibold block mb-1">{isCorrect ? 'Correct!' : 'Incorrect.'}</span>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Required CSS for 3D flip effect */}
      <style dangerouslySetInnerHTML={{__html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}} />
    </div>
  );
}
