'use client';

import { useEffect, useState } from 'react';

type Health = { status: string; service: string };

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
    fetch(`${apiUrl}/health`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return response.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className='min-h-screen bg-slate-950 px-6 py-16 text-slate-100'>
      <section className='mx-auto max-w-4xl'>
        <p className='mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400'>
          Careerneed · v0.1
        </p>
        <h1 className='text-4xl font-bold tracking-tight sm:text-6xl'>
          Your career, operated with evidence.
        </h1>
        <p className='mt-6 max-w-2xl text-lg leading-8 text-slate-300'>
          A job-discovery and career-intelligence platform for technical
          professionals. Today: establish a reliable development foundation.
        </p>
        <div className='mt-10 rounded-2xl border border-slate-700 bg-slate-900 p-6'>
          <p className='text-sm text-slate-400'>API health</p>
          {health && (
            <p className='mt-2 text-xl font-semibold text-emerald-400'>
              {health.service}: {health.status}
            </p>
          )}
          {error && (
            <p className='mt-2 text-xl font-semibold text-rose-400'>
              API unavailable: {error}
            </p>
          )}
          {!health && !error && (
            <p className='mt-2 text-xl font-semibold text-amber-300'>
              Checking API…
            </p>
          )}
        </div>
        <div className='mt-8 grid gap-4 sm:grid-cols-3'>
          {[
            'Ingest target-company jobs',
            'Match jobs to evidence',
            'Create actionable growth plans',
          ].map((item, index) => (
            <div
              key={item}
              className='rounded-xl border border-slate-800 bg-slate-900/50 p-5'
            >
              <p className='text-sm text-cyan-400'>0{index + 1}</p>
              <p className='mt-2 font-medium'>{item}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
