import React from 'react';

export const metadata = {
  title: 'Privacy Policy | PAL',
  description: 'Privacy Policy for PAL application',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-neutral-900 rounded-xl p-8 shadow-xl border border-neutral-800">
        <h1 className="text-3xl font-bold text-white mb-6">Privacy Policy</h1>
        <p className="mb-4 text-sm text-neutral-400">Last updated: September 17, 2026</p>

        <div className="space-y-6 text-neutral-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              Welcome to PAL. We respect your privacy and are committed to protecting your personal data. 
              This privacy policy explains how we collect, use, and safeguard your information when you use our application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Data We Collect</h2>
            <p className="mb-2">We may collect the following types of information:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account Information:</strong> Name, email address, and authentication tokens provided by OAuth providers (like Google).</li>
              <li><strong>User Content:</strong> Documents, text, and files you explicitly upload or connect to the application for the purpose of processing and analysis.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Use of Google User Data</h2>
            <p className="mb-2">
              Our application integrates with Google Drive to allow you to seamlessly import your documents. 
              If you choose to connect your Google Drive account, please be aware of the following:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Limited Use:</strong> Our application's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.</li>
              <li><strong>Data Processing:</strong> Files you select from Google Drive are processed by our system to generate AI embeddings and text summaries to power the features of this application.</li>
              <li><strong>No Third-Party Sharing:</strong> We do not share your Google Drive files or data with unauthorized third parties. Data is processed solely to provide the services within the application.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Storage and Security</h2>
            <p>
              Your data is stored securely using industry-standard encryption and security practices. 
              We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, loss, or alteration.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Your Rights</h2>
            <p>
              You have the right to access, update, or delete your personal data. You can disconnect your Google Drive account at any time, 
              which will revoke our access to your Google account immediately. You may also contact us to request the deletion of any documents 
              previously imported into our system.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Contact Us</h2>
            <p>
              If you have any questions or concerns about this Privacy Policy or our data practices, please contact the developer or administrator of this application instance.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
