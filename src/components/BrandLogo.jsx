import React from 'react';

/**
 * Official Technical Skill Development Hub Logo
 * Sir Visvesvaraya Institute of Technology (SVIT), Nashik - Pravara
 * Tagline: Learn | Build | Grow
 */
export const SVITHubLogo = ({ className = "w-10 h-10", alt = "Technical Skill Development Hub SVIT" }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden shadow-md ring-2 ring-[#B3122B]/20 bg-white ${className}`}>
    <img 
      src="/hub-logo.png" 
      alt={alt}
      className="w-full h-full object-cover select-none"
      loading="eager"
    />
  </div>
);


/**
 * Elegant Traditional Durga Mata Sketch Vector
 * Features the sacred Trishul (Trident), divine Third Eye, iconic crescent bindi,
 * and graceful artistic line work representing Shakti, Wisdom, and Victory of Knowledge.
 */
export const DurgaMataSketch = ({ className = "w-16 h-16", color = "currentColor" }) => (
  <svg 
    viewBox="0 0 200 200" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    aria-label="Durga Mata Divine Sketch"
  >
    {/* Central Divine Trishul (Trident) */}
    <path 
      d="M100 20 V180 M96 180 H104" 
      stroke={color} 
      strokeWidth="3.5" 
      strokeLinecap="round" 
    />
    {/* Central Trishul Sharp Spearhead */}
    <path 
      d="M100 15 L92 38 C92 48 100 52 100 52 C100 52 108 48 108 38 L100 15 Z" 
      fill={color} 
      opacity="0.9" 
    />
    {/* Left Trishul Curved Blade */}
    <path 
      d="M100 55 C82 55 68 40 72 24 C72 24 74 36 84 43 C91 48 97 50 100 51" 
      stroke={color} 
      strokeWidth="3.5" 
      strokeLinecap="round" 
      fill={color}
      fillOpacity="0.2"
    />
    {/* Right Trishul Curved Blade */}
    <path 
      d="M100 55 C118 55 132 40 128 24 C128 24 126 36 116 43 C109 48 103 50 100 51" 
      stroke={color} 
      strokeWidth="3.5" 
      strokeLinecap="round" 
      fill={color}
      fillOpacity="0.2"
    />

    {/* Sacred Crescent Moon & Red Sindoor Bindi */}
    <path 
      d="M90 68 C96 73 104 73 110 68 C106 70 94 70 90 68 Z" 
      fill="#B3122B" 
    />
    <circle cx="100" cy="62" r="4.5" fill="#B3122B" />

    {/* Divine Third Eye (Trinetra) */}
    <path 
      d="M100 70 C93 78 93 84 100 92 C107 84 107 78 100 70 Z" 
      stroke={color} 
      strokeWidth="2.5" 
      fill="#B3122B" 
      fillOpacity="0.3"
    />
    <circle cx="100" cy="81" r="2.5" fill={color} />

    {/* Graceful Divine Left Eye (Shubha Drashti) */}
    <path 
      d="M48 98 C64 90 82 92 90 104 C78 114 60 114 48 98 Z" 
      stroke={color} 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
    <circle cx="71" cy="102" r="6" fill={color} />
    <circle cx="73" cy="100" r="2" fill="white" />
    {/* Left Eyebrow */}
    <path 
      d="M44 88 C62 76 80 82 92 94" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round" 
    />
    {/* Left Eyelash Stroke */}
    <path 
      d="M48 98 C40 94 36 90 32 86" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round" 
    />

    {/* Graceful Divine Right Eye */}
    <path 
      d="M152 98 C136 90 118 92 110 104 C122 114 140 114 152 98 Z" 
      stroke={color} 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
    <circle cx="129" cy="102" r="6" fill={color} />
    <circle cx="127" cy="100" r="2" fill="white" />
    {/* Right Eyebrow */}
    <path 
      d="M156 88 C138 76 120 82 108 94" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round" 
    />
    {/* Right Eyelash Stroke */}
    <path 
      d="M152 98 C160 94 164 90 168 86" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round" 
    />

    {/* Divine Traditional Nose Ring (Nath) */}
    <circle cx="112" cy="128" r="9" stroke="#E5A93B" strokeWidth="2.5" fill="none" />
    <circle cx="112" cy="137" r="2.5" fill="#B3122B" />
    <path d="M121 128 C138 128 152 118 160 110" stroke="#E5A93B" strokeWidth="1.5" strokeDasharray="3 2" />

    {/* Graceful Lip Smile Curve */}
    <path 
      d="M84 142 C92 148 108 148 116 142 C108 152 92 152 84 142 Z" 
      fill="#B3122B" 
      stroke="#B3122B" 
      strokeWidth="1.5"
    />

    {/* Auspicious Lotus / Floral Aura Halo at the base */}
    <path 
      d="M60 165 C80 152 120 152 140 165 C125 178 75 178 60 165 Z" 
      stroke={color} 
      strokeWidth="2" 
      opacity="0.6" 
      fill={color} 
      fillOpacity="0.08"
    />
  </svg>
);

/**
 * Universal Shakti Vidya Background Watermark for all pages
 */
export const ShaktiVidyaWatermark = ({ className = "" }) => (
  <div 
    className={`fixed inset-0 pointer-events-none z-20 overflow-hidden flex items-center justify-center select-none ${className}`}
    aria-hidden="true"
  >
    <div className="flex flex-col items-center justify-center text-[#8B0D20] dark:text-[#ff758f] opacity-[0.26] dark:opacity-[0.34] transition-opacity">
      <DurgaMataSketch className="w-[360px] h-[360px] sm:w-[520px] sm:h-[520px]" color="currentColor" />
      <div className="text-center mt-3 tracking-[0.35em] font-serif font-black uppercase text-2xl sm:text-4xl text-[#8B0D20] dark:text-[#ff758f]">
        <span>शक्ति</span>
        <span className="mx-2.5 text-[#E5A93B]">•</span>
        <span>विद्या</span>
      </div>
      <div className="text-sm sm:text-base font-mono font-black tracking-[0.45em] text-[#8B0D20] dark:text-[#ff758f] mt-1.5">
        SHAKTI • VIDYA
      </div>
      <div className="text-xs sm:text-sm font-sans font-black tracking-[0.25em] text-[#8B0D20] dark:text-[#ff758f] mt-1 uppercase">
        Technical Skill Development Hub • SVIT Nashik
      </div>
    </div>
  </div>
);
