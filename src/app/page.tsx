import Link from 'next/link';
import { Bot, ArrowRight, Shield, Zap, Lock } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-gray-900 dark:text-white font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      {/* Navbar */}
      <nav className="absolute top-0 w-full flex items-center justify-between p-6 z-50">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <div className="bg-black dark:bg-white text-white dark:text-black p-1.5 rounded-lg shadow-sm">
            <Bot size={22} strokeWidth={2.5} />
          </div>
          PAL
        </div>
        <div>
          <Link href="/login" className="text-sm font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 px-5 py-2.5 rounded-full transition-colors">
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-16 sm:pt-40 sm:pb-24 lg:pb-32 overflow-hidden flex flex-col items-center justify-center min-h-[85vh] text-center px-4">
        {/* Abstract Background Element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-gray-200 to-gray-100 dark:from-white/5 dark:to-white/10 blur-[120px] rounded-full -z-10 opacity-60"></div>
        
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tighter max-w-4xl mx-auto leading-[1.1] mb-8 bg-clip-text text-transparent bg-gradient-to-b from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
          Your Private Enterprise AI Workspace.
        </h1>
        
        <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Secure, isolated, and incredibly fast. PAL connects your internal documents to powerful LLMs without compromising your data privacy.
        </p>

        <div className="flex items-center gap-4 flex-col sm:flex-row">
          <Link href="/login" className="group flex items-center gap-2 bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black px-8 py-4 rounded-full text-base font-semibold transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5">
            Get Started
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <a href="#features" className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white px-6 py-4 transition-colors">
            Learn More
          </a>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-gray-50 dark:bg-[#121214] border-t border-gray-200 dark:border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Enterprise-grade by design</h2>
            <p className="text-gray-600 dark:text-gray-400">Everything you need to deploy AI safely within your organization.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-[#1e1e20] p-8 rounded-3xl shadow-sm border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-colors">
              <div className="h-12 w-12 bg-gray-100 dark:bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-gray-900 dark:text-white">
                <Shield size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Total Isolation</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                Workspaces are completely sandboxed. Your context, embeddings, and chat history never leak across organizational boundaries.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-[#1e1e20] p-8 rounded-3xl shadow-sm border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-colors">
              <div className="h-12 w-12 bg-gray-100 dark:bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-gray-900 dark:text-white">
                <Zap size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Multi-Model Routing</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                Intelligently route queries to the best LLM provider (Groq, OpenAI, Anthropic) based on task complexity and latency requirements.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-[#1e1e20] p-8 rounded-3xl shadow-sm border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-colors">
              <div className="h-12 w-12 bg-gray-100 dark:bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-gray-900 dark:text-white">
                <Lock size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">RBAC Built-in</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                Granular role-based access control ensures that sensitive documents are only visible to authorized personnel and the AI.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-500 dark:text-gray-500 border-t border-gray-200 dark:border-white/5">
        &copy; {new Date().getFullYear()} PAL Enterprise. All rights reserved.
      </footer>
    </div>
  );
}
