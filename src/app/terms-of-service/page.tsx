import React from 'react';

export const metadata = {
  title: 'Terms of Service | PAL',
  description: 'Terms of Service for PAL application',
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-neutral-900 rounded-xl p-8 shadow-xl border border-neutral-800">
        <h1 className="text-3xl font-bold text-white mb-6">Terms of Service</h1>
        <p className="mb-4 text-sm text-neutral-400">Last updated: September 17, 2026</p>

        <div className="space-y-6 text-neutral-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using this application (PAL), you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use the application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              PAL is a tool designed to process, analyze, and generate insights from your documents and text data. 
              The service relies on external integrations (such as Google Drive for document fetching and third-party AI models for processing).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. User Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You agree not to upload any content that is illegal, harmful, or infringes on the intellectual property rights of others.</li>
              <li>You understand that processing large documents via third-party AI services may consume significant system resources and API quotas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Third-Party Services</h2>
            <p>
              Our application integrates with third-party services, including Google API Services. 
              Your use of Google Drive through our application is also governed by Google's Terms of Service. 
              We are not responsible for the availability, accuracy, or reliability of these external services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Disclaimer of Warranties</h2>
            <p>
              The service is provided "AS IS" and "AS AVAILABLE" without any warranties of any kind. 
              We do not guarantee that the service will be uninterrupted, secure, or error-free. The AI-generated insights 
              provided by the application should not be solely relied upon for critical decision-making.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Limitation of Liability</h2>
            <p>
              In no event shall the developers or administrators of this application be liable for any indirect, incidental, 
              special, or consequential damages arising out of or in connection with your use of the service or the loss of your data.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
