import React from 'react';

export default function PipMascot({ mood = 'neutral', size = 120 }) {
  // SVG drawing of Pip the Duckling based on mood
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ transition: 'all 0.5s ease' }}
    >
      {/* Background soft leaf halo */}
      <circle cx="50" cy="50" r="45" fill="#E8F0E5" stroke="#C3DDC0" strokeWidth="1.5" strokeDasharray="3 3"/>
      
      {/* Little leaf on head */}
      <path d="M 50 15 C 45 5, 38 12, 50 15 C 62 12, 55 5, 50 15 Z" fill="#8DB87A" stroke="#4A7C59" strokeWidth="1"/>
      <path d="M 50 15 L 50 10" stroke="#4A7C59" strokeWidth="1"/>

      {/* Main body */}
      <circle cx="50" cy="56" r="28" fill="#FFE066" stroke="#2C2C2C" strokeWidth="2.5" />
      
      {/* Left Wing */}
      {mood === 'happy' ? (
        // Happy wing waving
        <path d="M 22 56 C 15 48, 12 58, 22 62" fill="#FFE066" stroke="#2C2C2C" strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        // Standard wing resting
        <path d="M 22 56 C 18 52, 16 62, 22 64" fill="#FFE066" stroke="#2C2C2C" strokeWidth="2.5" strokeLinecap="round" />
      )}

      {/* Right Wing */}
      {mood === 'concerned' ? (
        // Concerned wing holding face
        <path d="M 78 56 C 82 50, 72 45, 68 52" fill="#FFE066" stroke="#2C2C2C" strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        <path d="M 78 56 C 82 52, 84 62, 78 64" fill="#FFE066" stroke="#2C2C2C" strokeWidth="2.5" strokeLinecap="round" />
      )}

      {/* Cheeks */}
      <circle cx="36" cy="58" r="4" fill="#FFA8A8" opacity="0.6" />
      <circle cx="64" cy="58" r="4" fill="#FFA8A8" opacity="0.6" />

      {/* Eyes */}
      {mood === 'happy' && (
        <>
          {/* Happy/Smiling arch eyes */}
          <path d="M 32 50 Q 36 44 40 50" stroke="#2C2C2C" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M 60 50 Q 64 44 68 50" stroke="#2C2C2C" strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === 'neutral' && (
        <>
          {/* Friendly open eyes with white highlights */}
          <circle cx="36" cy="49" r="4" fill="#2C2C2C" />
          <circle cx="35" cy="48" r="1.2" fill="#FFFFFF" />
          <circle cx="64" cy="49" r="4" fill="#2C2C2C" />
          <circle cx="63" cy="48" r="1.2" fill="#FFFFFF" />
        </>
      )}
      {mood === 'concerned' && (
        <>
          {/* Worried/angled eyes and downward eyebrows */}
          <path d="M 32 46 L 40 49" stroke="#2C2C2C" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 68 46 L 60 49" stroke="#2C2C2C" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 32 51 Q 36 53 40 51" stroke="#2C2C2C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M 60 51 Q 64 53 68 51" stroke="#2C2C2C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Little drop of sweat */}
          <path d="M 72 40 C 71 43, 73 45, 74 43 Z" fill="#74C0FC" />
        </>
      )}

      {/* Beak */}
      {mood === 'happy' ? (
        // Wide open happy smile
        <path d="M 44 54 Q 50 63 56 54 Z" fill="#FF922B" stroke="#2C2C2C" strokeWidth="2" />
      ) : mood === 'concerned' ? (
        // Small downward beak
        <path d="M 44 56 Q 50 52 56 56 Q 50 60 44 56 Z" fill="#FF922B" stroke="#2C2C2C" strokeWidth="2" />
      ) : (
        // Regular friendly beak
        <path d="M 43 54 Q 50 59 57 54 Z" fill="#FF922B" stroke="#2C2C2C" strokeWidth="2" />
      )}

      {/* Little webbed feet */}
      <path d="M 40 83 C 40 86, 44 86, 43 83" stroke="#2C2C2C" strokeWidth="2" fill="#FF922B"/>
      <path d="M 57 83 C 57 86, 61 86, 60 83" stroke="#2C2C2C" strokeWidth="2" fill="#FF922B"/>
    </svg>
  );
}
