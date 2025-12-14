'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// Optional: Register the hook to avoid tree-shaking issues in some strict bundlers
gsap.registerPlugin(useGSAP);

export default function SourcingLoader({ complete = false }: { complete?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // We use specific refs for elements we need to target without searching strings, 
  // though scoped string selectors work great with useGSAP too.
  const matchCardRef = useRef<SVGGElement>(null);

  useGSAP(
    () => {
      // 1. Initial State Setup (avoids "flash of unstyled content")
      gsap.set('.candidate-card', { opacity: 0, scale: 0.8 });
      gsap.set('.magnifier', { opacity: 0, scale: 0.8 });
      gsap.set('.check-mark', { scale: 0, opacity: 0 });
      gsap.set('#match-card-bg', { attr: { stroke: '#e2e8f0', 'stroke-width': 2 } }); // Reset border color

      // If complete, just show the success state immediately
      if (complete) {
        gsap.set(matchCardRef.current, { scale: 1.1, opacity: 1 });
        gsap.set('#match-card-bg', { attr: { stroke: '#22c55e', 'stroke-width': 4 } });
        gsap.set('.check-mark', { scale: 1, opacity: 1 });
        gsap.set('.magnifier', { opacity: 0, scale: 0.5 });
        gsap.set('.candidate-card:not(:nth-child(2))', { opacity: 0, scale: 0.5 });
        // Ensure middle card is visible
        gsap.set('.candidate-card:nth-child(2)', { opacity: 1 });
        return;
      }

      const tl = gsap.timeline({ 
        repeat: -1, 
        repeatDelay: 1 
      });

      tl
        // Step 1: Pop in candidates
        .to('.candidate-card', {
          opacity: 1,
          scale: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: 'back.out(1.7)',
        })
        
        // Step 2: Magnifier Enters
        .to('.magnifier', {
          opacity: 1,
          scale: 1,
          duration: 0.5,
          ease: 'power2.out',
        }, '-=0.2')

        // Step 3: Scan Motion
        .to('.magnifier', {
          x: 220, // Adjusted for the SVG viewBox coordinate system
          duration: 1.5,
          ease: 'power1.inOut',
        })

        // Step 4: The Match Moment (Middle Card)
        .to(matchCardRef.current, {
          scale: 1.1,
          duration: 0.3,
          ease: 'power2.out',
        }, '-=0.9') // Sync with magnifier passing middle
        
        // Turn border green (animating class/attribute manually for max performance)
        .to('#match-card-bg', {
          attr: { stroke: '#22c55e', 'stroke-width': 4 },
          duration: 0.2,
        }, '<')
        
        // Checkmark pop
        .to('.check-mark', {
          scale: 1,
          opacity: 1,
          duration: 0.4,
          ease: 'elastic.out(1, 0.5)',
        }, '<0.1')

        // Step 5: Exit
        .to('.magnifier', {
          opacity: 0,
          scale: 0.5,
          duration: 0.3,
        }, '+=0.5')
        
        // Reset everything for loop
        .to('.candidate-card', {
          opacity: 0,
          scale: 0.5,
          duration: 0.4,
          stagger: 0.05,
        })
        .to('#match-card-bg', {
          attr: { stroke: '#e2e8f0', 'stroke-width': 2 }, // Reset border color
          duration: 0.2
        }, '<')
        .to('.check-mark', {
          scale: 0,
          opacity: 0,
          duration: 0.2
        }, '<');
    },
    { scope: containerRef, dependencies: [complete] } // Re-run when complete changes
  );

  return (
    <div 
      ref={containerRef} 
      className="flex w-full items-center justify-center p-4"
      aria-label="Searching for candidates"
    >
      <svg
        viewBox="0 0 400 200"
        xmlns="http://www.w3.org/2000/svg"
        className="h-[min(220px,35svh)] w-full max-w-[400px] overflow-visible"
      >
        {/* --- Candidates Group --- */}
        <g id="candidates-group">
          {/* Card 1 (Left) */}
          <g className="candidate-card origin-center" transform="translate(50, 60)">
            <rect
              className="fill-white stroke-slate-200"
              width="80" height="100" rx="8" strokeWidth="2"
            />
            <circle cx="40" cy="30" r="15" className="fill-slate-300" />
            <rect x="15" y="55" width="50" height="6" rx="3" className="fill-slate-200" />
            <rect x="15" y="70" width="30" height="6" rx="3" className="fill-slate-200" />
          </g>

          {/* Card 2 (Center - The Match) */}
          <g 
            ref={matchCardRef} 
            className="candidate-card origin-center" 
            transform="translate(160, 60)"
          >
            <rect
              id="match-card-bg"
              className="fill-white stroke-slate-200 transition-colors"
              width="80" height="100" rx="8" strokeWidth="2"
            />
            <circle cx="40" cy="30" r="15" className="fill-slate-300" />
            <rect x="15" y="55" width="50" height="6" rx="3" className="fill-slate-200" />
            <rect x="15" y="70" width="30" height="6" rx="3" className="fill-slate-200" />

            {/* Green Checkmark */}
            <g className="check-mark origin-center" transform="translate(40, 50)">
              <circle r="12" className="fill-green-500" />
              <path
                d="M-4 -1 L-1 3 L5 -3"
                className="fill-none stroke-white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </g>

          {/* Card 3 (Right) */}
          <g className="candidate-card origin-center" transform="translate(270, 60)">
            <rect
              className="fill-white stroke-slate-200"
              width="80" height="100" rx="8" strokeWidth="2"
            />
            <circle cx="40" cy="30" r="15" className="fill-slate-300" />
            <rect x="15" y="55" width="50" height="6" rx="3" className="fill-slate-200" />
            <rect x="15" y="70" width="30" height="6" rx="3" className="fill-slate-200" />
          </g>
        </g>

        {/* --- Magnifier Icon --- */}
        <g className="magnifier origin-center will-change-transform" transform="translate(40, 100)">
          {/* Glass Lens */}
          <circle
            cx="0" cy="0" r="25"
            className="fill-blue-500/20 stroke-blue-500"
            strokeWidth="3"
          />
          {/* Handle */}
          <line
            x1="18" y1="18" x2="35" y2="35"
            className="stroke-blue-500"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Reflection Glint */}
          <path
            d="M-15 -10 Q-5 -20 5 -10"
            className="fill-none stroke-white opacity-60"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>
  );
}
