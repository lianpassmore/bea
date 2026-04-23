import Link from 'next/link';
import { Mic } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col h-[90vh] justify-between pt-12 pb-6">
      
      {/* Top: Greeting & Household Pulse */}
      <div className="space-y-8 animate-fade-in px-2">
        <header>
          <h1 className="font-serif text-4xl text-bea-charcoal mb-3">
            Kia ora, Lian.
          </h1>
          <p className="font-body text-bea-olive text-lg leading-relaxed">
            The household feels a little rushed this morning. Evenings have been more settled lately.
          </p>
        </header>

        {/* Member Card */}
        <div className="bg-white/40 border border-bea-amber/20 rounded-2xl p-5 shadow-sm backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-serif text-2xl text-bea-charcoal">Lian</h2>
              <p className="font-ui text-sm text-bea-olive mt-1">Last check-in: Yesterday</p>
            </div>
            <div className="bg-bea-amber/10 px-4 py-1.5 rounded-full border border-bea-amber/20">
              <span className="font-body text-sm text-bea-charcoal">Reflective</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Talk to Bea Button */}
      <div className="flex flex-col items-center gap-4">
        <Link 
          href="/check-in"
          className="group flex items-center gap-3 bg-bea-charcoal text-bea-milk px-8 py-4 rounded-full font-body text-lg hover:bg-[#1a1a1a] transition-all shadow-md hover:shadow-lg"
        >
          <Mic className="w-5 h-5 text-bea-amber group-hover:scale-110 transition-transform" />
          Talk to Bea
        </Link>
      </div>

    </div>
  );
}