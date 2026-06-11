"use client";

import Link from "next/link";

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
            ← Back to Inkforge Reader
          </Link>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tighter">
            Legal &amp; Community Guidelines
          </h1>
          <p className="mt-2 text-[var(--text-muted)]">
            Last Updated: June 2026
          </p>
        </div>

        <div className="max-w-none space-y-10 text-[15px] leading-relaxed">
          {/* 1 */}
          <section>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)] mb-3">1. Content Creation &amp; Copyright</h2>
            <p className="text-[var(--text-muted)]">
              All users must respect intellectual property laws.
            </p>
            <p className="text-[var(--text-muted)] mt-2">
              <strong className="text-[var(--text)]">You are strictly prohibited from</strong> uploading, publishing, or sharing any content that infringes on someone else&apos;s copyright, trademark, or other intellectual property rights.
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-1 text-[var(--text-muted)]">
              <li>Do not upload traced, copied, or heavily referenced work from other artists/creators without explicit permission.</li>
              <li>Do not repost webtoons, manhwa, manga, or any commercial content.</li>
              <li>AI-generated content must be original and not trained on or replicating protected works.</li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)] mb-3">2. AI-Generated Content Rules</h2>
            <p className="text-[var(--text-muted)]">
              Inkforge is an AI creation platform. When using AI tools:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-1 text-[var(--text-muted)]">
              <li>You are responsible for the content you generate and publish.</li>
              <li>Ensure your creations do not violate any third-party copyrights.</li>
              <li>We encourage original storytelling and artwork.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)] mb-3">3. Prohibited Activities</h2>
            <p className="text-[var(--text-muted)]">The following is <strong className="text-[var(--text)]">strictly forbidden</strong>:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1 text-[var(--text-muted)]">
              <li>Uploading or sharing copyrighted material without authorization</li>
              <li>Copying or imitating existing webtoons/manhwa/manga</li>
              <li>Posting illegal, harmful, pornographic, or abusive content</li>
              <li>Harassing other users</li>
              <li>Attempting to bypass payment/unlock systems</li>
              <li>Using the platform for spam or commercial advertising (except your own original works)</li>
            </ul>
            <p className="mt-3 text-[var(--text-muted)]">
              Violations may result in <strong className="text-[var(--text)]">immediate account suspension</strong> and content removal.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)] mb-3">4. Intellectual Property</h2>
            <ul className="list-disc pl-6 space-y-1 text-[var(--text-muted)]">
              <li>You retain ownership of your original creations.</li>
              <li>By publishing publicly, you grant other users a license to read your work on the platform.</li>
              <li>We reserve the right to remove any content that we believe violates these terms.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)] mb-3">5. Liability Disclaimer</h2>
            <p className="text-[var(--text-muted)]">This platform is provided &quot;as is&quot; without any warranties.</p>
            <p className="mt-2 text-[var(--text-muted)]">We are not responsible for:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-[var(--text-muted)]">
              <li>Any content uploaded by users</li>
              <li>Copyright disputes between users and third parties</li>
              <li>Any loss or damage resulting from use of the platform</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)] mb-3">6. User Responsibility</h2>
            <p className="text-[var(--text-muted)]">You agree to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-[var(--text-muted)]">
              <li>Comply with all applicable copyright and intellectual property laws</li>
              <li>Take full legal responsibility for the content you create and share</li>
              <li>Indemnify us against any claims arising from your content</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)] mb-3">7. Privacy &amp; Data</h2>
            <p className="text-[var(--text-muted)]">
              Your data is stored securely via Supabase. We respect user privacy but may access content for moderation purposes when necessary.
            </p>
          </section>
        </div>

        {/* Final agreement */}
        <div className="mt-12 border-t border-[var(--border)] pt-8">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 text-center">
            <p className="font-medium text-[var(--text)]">
              By using Inkforge Reader, you agree to these terms.
            </p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              This document may be updated periodically. Continued use of the platform constitutes acceptance of the latest version.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
