import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
   <Link to="/" className={`flex items-center gap-3 group ${className}`}>
  {/* Icon Container: Emerald gradient for SDG 13 (Sustainability) + Health */}
  <div className="size-10 bg-gradient-to-br from-emerald-500 to-green-700 rounded-xl flex items-center justify-center text-white shadow-md transition-transform duration-300 group-hover:scale-105">
    
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="size-6"
    >
      {/* Queue nodes representing patients in line */}
      <circle cx="4" cy="12" r="1.5" />
      <circle cx="10" cy="12" r="1.5" />
      
      {/* Flow line representing the adaptive motion/movement */}
      <path d="M10 12h6" />
      
      {/* Medical Cross representing healthcare */}
      <path d="M19 9v6" />
      <path d="M16 12h6" />
    </svg>
  </div>

  {/* Typography */}
  <div className="flex flex-col justify-center">
    <span className="font-display text-xl font-extrabold tracking-tight uppercase leading-none text-gray-900 dark:text-white">
      Motion Adaptive
    </span>
    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase mt-1">
      Sustainable Health Flow
    </span>
  </div>
</Link>
  );
}
