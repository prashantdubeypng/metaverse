'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

export default function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isClient, setIsClient] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const spaceRef = useRef<HTMLDivElement>(null);

  // Set client flag after hydration to prevent mismatches
  useEffect(() => {
    setIsClient(true);
    
    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Generate deterministic star positions to avoid hydration mismatch
  const generateStars = () => {
    const stars = [];
    for (let i = 0; i < 300; i++) {
      // Use index-based deterministic values instead of Math.random()
      const seed = i * 9301 + 49297; // Simple pseudo-random based on index
      const left = ((seed % 10000) / 100);
      const top = (((seed * 7) % 10000) / 100);
      const width = 1 + ((seed % 3));
      const height = 1 + (((seed * 3) % 3));
      const delay = ((seed % 4000) / 1000);
      const duration = 3 + ((seed % 4000) / 1000);

      stars.push({
        id: i,
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}px`,
        height: `${height}px`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`
      });
    }
    return stars;
  };

  const stars = generateStars();

  // Generate deterministic particles
  const generateParticles = () => {
    const particles = [];
    for (let i = 0; i < 50; i++) {
      const seed = i * 12345 + 67890;
      const left = ((seed % 10000) / 100);
      const top = (((seed * 5) % 10000) / 100);
      const delay = ((seed % 8000) / 1000);
      const duration = 8 + ((seed % 12000) / 1000);

      particles.push({
        id: i,
        left: `${left}%`,
        top: `${top}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`
      });
    }
    return particles;
  };

  const particles = generateParticles();

  const handleGetStarted = () => {
    router.push('/signup');
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const handleDemo = () => {
    router.push('/test-loading');
  };

  const handleNewsletterSignup = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Thank you for subscribing!');
    setEmail('');
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden" suppressHydrationWarning>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  MetaSpace
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLogin}
                className="text-white/80 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:bg-white/10"
                suppressHydrationWarning
              >
                Login
              </button>
              <button
                onClick={handleGetStarted}
                className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/25"
                suppressHydrationWarning
              >
                Enter MetaSpace
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with 3D Elements */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Enhanced 3D Background Space */}
        <div className="absolute inset-0">
          {/* Animated Grid Background */}
          <div className="grid-background"></div>
          <div className="grid-overlay"></div>

          {/* Enhanced Stars System */}
          {isClient && (
            <div className="stars-container">
              {stars.map((star) => (
                <div
                  key={star.id}
                  className="star"
                  style={{
                    left: star.left,
                    top: star.top,
                    width: star.width,
                    height: star.height,
                    animationDelay: star.animationDelay,
                    animationDuration: star.animationDuration
                  }}
                />
              ))}
            </div>
          )}

          {/* Floating Particle System */}
          {isClient && (
            <div className="absolute inset-0">
              {particles.map((particle) => (
                <div
                  key={`particle-${particle.id}`}
                  className="absolute w-1 h-1 bg-cyan-400/30 rounded-full animate-orbit-slow"
                  style={{
                    left: particle.left,
                    top: particle.top,
                    animationDelay: particle.animationDelay,
                    animationDuration: particle.animationDuration
                  }}
                />
              ))}
            </div>
          )}

          {/* Enhanced Floating 3D Planets */}
          <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 opacity-60 animate-orbit-slow shadow-2xl shadow-blue-500/30"
            style={{ transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)` }}>
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-300 to-purple-500 animate-spin-very-slow"></div>
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-200 to-purple-400 animate-spin-reverse-slow"></div>
          </div>

          <div className="absolute top-40 right-20 w-24 h-24 rounded-full bg-gradient-to-br from-pink-400 to-red-600 opacity-50 animate-orbit-medium shadow-2xl shadow-pink-500/30"
            style={{ transform: `translate(${mousePosition.x * -0.03}px, ${mousePosition.y * 0.03}px)` }}>
            <div className="absolute inset-1 rounded-full bg-gradient-to-br from-pink-300 to-red-500 animate-spin-fast"></div>
          </div>

          <div className="absolute bottom-32 left-1/4 w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-cyan-600 opacity-40 animate-orbit-fast shadow-2xl shadow-green-500/30"
            style={{ transform: `translate(${mousePosition.x * 0.04}px, ${mousePosition.y * -0.02}px)` }}>
            <div className="absolute inset-1 rounded-full bg-gradient-to-br from-green-300 to-cyan-500 animate-spin-reverse-fast"></div>
          </div>

          {/* Floating Geometric Shapes */}
          <div className="absolute top-1/3 left-1/3 w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 opacity-30 animate-float-rotate transform rotate-45"
            style={{ transform: `translate(${mousePosition.x * 0.05}px, ${mousePosition.y * -0.04}px) rotate(45deg)` }} />

          <div className="absolute bottom-1/3 right-1/3 w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 opacity-40 animate-float-scale"
            style={{ transform: `translate(${mousePosition.x * -0.06}px, ${mousePosition.y * 0.05}px)` }}>
            <div className="w-0 h-0 border-l-6 border-r-6 border-b-10 border-l-transparent border-r-transparent border-b-purple-400"></div>
          </div>

          {/* Animated Rings */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-96 h-96 border border-cyan-400/20 rounded-full animate-spin-very-slow"></div>
            <div className="absolute inset-8 border border-purple-400/20 rounded-full animate-spin-reverse-slow"></div>
            <div className="absolute inset-16 border border-pink-400/20 rounded-full animate-spin-medium"></div>
          </div>
        </div>

        {/* Enhanced Main Hero Content */}
        <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8">
          <div className="transform transition-all duration-1000" style={{ transform: `translateY(${scrollY * 0.5}px)` }}>
            {/* Enhanced Title with Letter Animation */}
            <div className="mb-6">
              <div className="text-4xl md:text-6xl font-bold mb-4 animate-bounce-in">
                {['W', 'e', 'l', 'c', 'o', 'm', 'e', ' ', 't', 'o', ' ', 't', 'h', 'e'].map((letter, i) => (
                  <span
                    key={i}
                    className="inline-block animate-letter-float text-white/90"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    {letter === ' ' ? '\u00A0' : letter}
                  </span>
                ))}
              </div>

              <div className="text-7xl md:text-9xl font-bold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-text-shimmer">
                {['M', 'e', 't', 'a', 'V', 'e', 'r', 's', 'e'].map((letter, i) => (
                  <span
                    key={i}
                    className="inline-block animate-text-wave animate-text-glow"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  >
                    {letter}
                  </span>
                ))}
              </div>
            </div>

            {/* Enhanced Description with Fade-in */}
            <p className="text-xl md:text-2xl text-white/80 mb-12 max-w-4xl mx-auto leading-relaxed animate-fade-in-up animation-delay-800">
              Experience real-time collaboration with immersive 3D spaces, live chat,
              instant media sharing, and interactive avatars in our next-generation metaverse platform.
            </p>

            {/* Enhanced Buttons with Advanced Effects */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center animate-fade-in-up animation-delay-1000">
              <button
                onClick={handleGetStarted}
                className="group relative bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white px-12 py-4 rounded-full text-lg font-semibold transition-all duration-500 transform hover:scale-110 shadow-2xl hover:shadow-cyan-500/50 animate-button-glow"
                suppressHydrationWarning
              >
                <span className="relative z-10">Enter MetaSpace</span>
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
                <div className="absolute inset-0 rounded-full animate-pulse-ring"></div>
              </button>

              <button
                onClick={handleDemo}
                className="group relative border-2 border-cyan-400 text-cyan-400 hover:text-white px-12 py-4 rounded-full text-lg font-semibold transition-all duration-500 transform hover:scale-110 hover:bg-cyan-400/10 animate-border-glow"
                suppressHydrationWarning
              >
                <span className="relative z-10 flex items-center">
                  <svg className="w-6 h-6 mr-2 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Try Live Demo
                </span>
                <div className="absolute inset-0 rounded-full animate-pulse-ring animation-delay-500"></div>
              </button>
            </div>

            {/* Floating Action Indicators */}
            <div className="absolute -right-20 top-1/2 transform -translate-y-1/2 hidden lg:block">
              <div className="flex flex-col space-y-4">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center animate-pulse-subtle cursor-pointer hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center animate-pulse-subtle animation-delay-200 cursor-pointer hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-cyan-500 rounded-full flex items-center justify-center animate-pulse-subtle animation-delay-400 cursor-pointer hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Left Side Floating Elements */}
            <div className="absolute -left-20 top-1/2 transform -translate-y-1/2 hidden lg:block">
              <div className="flex flex-col space-y-6">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full animate-orbit-slow opacity-60"></div>
                <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-red-500 rounded-full animate-orbit-medium opacity-50"></div>
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full animate-orbit-fast opacity-40"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce-slow">
          <div className="relative">
            <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center animate-glow-pulse">
              <div className="w-1 h-3 bg-gradient-to-b from-cyan-400 to-purple-500 rounded-full mt-2 animate-scroll-dot"></div>
            </div>
            <div className="absolute -inset-2 border border-white/10 rounded-full animate-ping"></div>
            <div className="absolute -inset-4 border border-white/5 rounded-full animate-ping animation-delay-500"></div>
          </div>
          <p className="text-white/40 text-xs mt-2 animate-fade-pulse">Scroll to explore</p>
        </div>
      </section>

      {/* 3D Avatar Showcase */}
      <section ref={avatarRef} className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-cyan-900/20"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Your Digital Identity
            </h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto">
              Create and customize your 3D avatar with 360° interaction and lifelike expressions
            </p>
          </div>

          {/* Enhanced 3D Avatar Display */}
          <div className="relative">
            <div className="flex justify-center items-center space-x-12">
              {/* Avatar 1 - Enhanced */}
              <div className="relative group animate-fade-in-up">
                <div className="w-64 h-64 rounded-full bg-gradient-to-br from-cyan-400 to-purple-600 p-1 animate-spin-slow group-hover:animate-spin-fast transition-all duration-500">
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden shadow-2xl shadow-cyan-500/50">
                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 relative animate-float-medium group-hover:animate-float-fast">
                      {/* Enhanced Avatar Face */}
                      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-orange-300 to-orange-400 flex items-center justify-center animate-pulse-subtle">
                        <div className="w-full h-full rounded-full bg-gradient-to-br from-orange-200 to-orange-300 relative">
                          {/* Animated Eyes */}
                          <div className="absolute top-1/3 left-1/4 w-3 h-3 bg-black rounded-full animate-blink-smart"></div>
                          <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-black rounded-full animate-blink-smart animation-delay-100"></div>
                          {/* Animated Smile */}
                          <div className="absolute bottom-1/3 left-1/2 transform -translate-x-1/2 w-8 h-4 border-b-2 border-black rounded-full animate-smile"></div>
                          {/* Cheeks */}
                          <div className="absolute top-1/2 left-1/5 w-2 h-2 bg-pink-300 rounded-full animate-pulse"></div>
                          <div className="absolute top-1/2 right-1/5 w-2 h-2 bg-pink-300 rounded-full animate-pulse animation-delay-200"></div>
                        </div>
                      </div>
                      {/* Floating particles around avatar */}
                      <div className="absolute -inset-8">
                        {[...Array(8)].map((_, i) => {
                          // Use predetermined positions to avoid hydration mismatch
                          const positions = [
                            { left: '90%', top: '50%' },
                            { left: '78.3%', top: '21.7%' },
                            { left: '50%', top: '10%' },
                            { left: '21.7%', top: '21.7%' },
                            { left: '10%', top: '50%' },
                            { left: '21.7%', top: '78.3%' },
                            { left: '50%', top: '90%' },
                            { left: '78.3%', top: '78.3%' }
                          ];
                          
                          return (
                            <div
                              key={i}
                              className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-orbit-particles"
                              style={{
                                left: positions[i].left,
                                top: positions[i].top,
                                animationDelay: `${i * 0.2}s`
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-center">
                  <p className="text-cyan-400 font-semibold animate-text-glow">Professional</p>
                </div>
                {/* Hover effect ring */}
                <div className="absolute inset-0 rounded-full border-2 border-cyan-400/0 group-hover:border-cyan-400/50 transition-all duration-500 animate-pulse-ring"></div>
              </div>

              {/* Avatar 2 - Enhanced */}
              <div className="relative group animate-fade-in-up animation-delay-200">
                <div className="w-80 h-80 rounded-full bg-gradient-to-br from-pink-400 to-cyan-600 p-1 animate-spin-reverse group-hover:animate-spin-reverse-fast transition-all duration-500">
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden shadow-2xl shadow-pink-500/50">
                    <div className="w-64 h-64 rounded-full bg-gradient-to-br from-green-400 via-blue-500 to-purple-500 relative animate-float-slow group-hover:animate-float-medium">
                      {/* Enhanced Avatar Face */}
                      <div className="absolute inset-6 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-400 flex items-center justify-center animate-pulse-subtle">
                        <div className="w-full h-full rounded-full bg-gradient-to-br from-yellow-200 to-yellow-300 relative">
                          {/* Animated Eyes */}
                          <div className="absolute top-1/3 left-1/4 w-4 h-4 bg-black rounded-full animate-blink-smart"></div>
                          <div className="absolute top-1/3 right-1/4 w-4 h-4 bg-black rounded-full animate-blink-smart animation-delay-150"></div>
                          {/* Animated Smile */}
                          <div className="absolute bottom-1/3 left-1/2 transform -translate-x-1/2 w-10 h-5 border-b-2 border-black rounded-full animate-smile"></div>
                          {/* Cheeks */}
                          <div className="absolute top-1/2 left-1/5 w-3 h-3 bg-pink-300 rounded-full animate-pulse"></div>
                          <div className="absolute top-1/2 right-1/5 w-3 h-3 bg-pink-300 rounded-full animate-pulse animation-delay-300"></div>
                        </div>
                      </div>
                      {/* Floating particles */}
                      <div className="absolute -inset-10">
                        {[...Array(12)].map((_, i) => {
                          // Use predetermined positions to avoid hydration mismatch
                          const positions = [
                            { left: '95%', top: '50%' },
                            { left: '89.0%', top: '11.0%' },
                            { left: '72.5%', top: '-12.5%' },
                            { left: '50%', top: '-22.5%' },
                            { left: '27.5%', top: '-12.5%' },
                            { left: '11.0%', top: '11.0%' },
                            { left: '5%', top: '50%' },
                            { left: '11.0%', top: '89.0%' },
                            { left: '27.5%', top: '112.5%' },
                            { left: '50%', top: '122.5%' },
                            { left: '72.5%', top: '112.5%' },
                            { left: '89.0%', top: '89.0%' }
                          ];
                          
                          return (
                            <div
                              key={i}
                              className="absolute w-1.5 h-1.5 bg-pink-400 rounded-full animate-orbit-particles-large"
                              style={{
                                left: positions[i].left,
                                top: positions[i].top,
                                animationDelay: `${i * 0.15}s`
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-center">
                  <p className="text-pink-400 font-semibold animate-text-glow">Creative</p>
                </div>
                {/* Hover effect ring */}
                <div className="absolute inset-0 rounded-full border-2 border-pink-400/0 group-hover:border-pink-400/50 transition-all duration-500 animate-pulse-ring"></div>
              </div>

              {/* Avatar 3 */}
              <div className="relative group">
                <div className="w-64 h-64 rounded-full bg-gradient-to-br from-green-400 to-blue-600 p-1 animate-spin-slow">
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-red-400 via-orange-500 to-yellow-500 relative animate-float-fast">
                      {/* Avatar Face */}
                      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-pink-300 to-pink-400 flex items-center justify-center">
                        <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-200 to-pink-300 relative">
                          {/* Eyes */}
                          <div className="absolute top-1/3 left-1/4 w-3 h-3 bg-black rounded-full animate-blink"></div>
                          <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-black rounded-full animate-blink"></div>
                          {/* Smile */}
                          <div className="absolute bottom-1/3 left-1/2 transform -translate-x-1/2 w-8 h-4 border-b-2 border-black rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-center">
                  <p className="text-green-400 font-semibold">Casual</p>
                </div>
              </div>
            </div>

            {/* 360° Rotation Indicator */}
            <div className="text-center mt-16">
              <div className="inline-flex items-center space-x-2 text-white/60">
                <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>360° Interactive Avatars</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Real-Time 3D Spaces */}
      <section ref={spaceRef} className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/20 to-purple-900/20"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-cyan-500 bg-clip-text text-transparent">
              Live Interactive Spaces
            </h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto">
              Collaborate in real-time within immersive 3D environments with instant chat and media sharing
            </p>
          </div>

          {/* 3D Space Showcase */}
          <div className="relative perspective-1000">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Space 1 - Office */}
              <div className="group relative transform-gpu transition-all duration-700 hover:scale-105 hover:rotate-y-12">
                <div className="relative h-80 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 to-purple-700 shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>

                  {/* 3D Room Elements */}
                  <div className="absolute inset-4 perspective-500">
                    {/* Floor */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-800 to-gray-600 transform rotateX-60 origin-bottom"></div>

                    {/* Walls */}
                    <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-blue-400 to-blue-600 transform rotateY-15"></div>
                    <div className="absolute top-0 right-0 w-32 h-48 bg-gradient-to-l from-purple-400 to-purple-600 transform rotateY-75"></div>

                    {/* Furniture */}
                    <div className="absolute bottom-16 left-8 w-16 h-8 bg-gradient-to-t from-brown-600 to-brown-400 rounded transform rotateX-30"></div>
                    <div className="absolute bottom-12 right-8 w-12 h-12 bg-gradient-to-t from-gray-700 to-gray-500 rounded transform rotateX-45"></div>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-bold text-white mb-2">Virtual Office</h3>
                    <p className="text-white/80 text-sm">Professional workspace with meeting rooms</p>
                  </div>

                  {/* Live Badge */}
                  <div className="absolute top-4 right-4 bg-green-500 text-black px-3 py-1 rounded-full text-xs font-bold flex items-center">
                    <div className="w-2 h-2 bg-black rounded-full mr-1 animate-pulse"></div>
                    LIVE
                  </div>
                </div>
              </div>

              {/* Space 2 - Creative Studio */}
              <div className="group relative transform-gpu transition-all duration-700 hover:scale-105 hover:rotate-y-12">
                <div className="relative h-80 rounded-2xl overflow-hidden bg-gradient-to-br from-pink-600 to-orange-700 shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>

                  {/* 3D Room Elements */}
                  <div className="absolute inset-4 perspective-500">
                    {/* Floor */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-orange-800 to-orange-600 transform rotateX-60 origin-bottom"></div>

                    {/* Walls */}
                    <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-pink-400 to-pink-600 transform rotateY-15"></div>
                    <div className="absolute top-0 right-0 w-32 h-48 bg-gradient-to-l from-orange-400 to-orange-600 transform rotateY-75"></div>

                    {/* Creative Elements */}
                    <div className="absolute bottom-16 left-6 w-20 h-12 bg-gradient-to-t from-purple-600 to-purple-400 rounded transform rotateX-30"></div>
                    <div className="absolute bottom-12 right-6 w-8 h-16 bg-gradient-to-t from-yellow-600 to-yellow-400 rounded transform rotateX-45"></div>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-bold text-white mb-2">Creative Studio</h3>
                    <p className="text-white/80 text-sm">Artistic space for collaboration</p>
                  </div>

                  {/* Real-time Badge */}
                  <div className="absolute top-4 right-4 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center">
                    <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
                    Real-time
                  </div>
                </div>
              </div>

              {/* Space 3 - Gaming Arena */}
              <div className="group relative transform-gpu transition-all duration-700 hover:scale-105 hover:rotate-y-12">
                <div className="relative h-80 rounded-2xl overflow-hidden bg-gradient-to-br from-green-600 to-cyan-700 shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>

                  {/* 3D Room Elements */}
                  <div className="absolute inset-4 perspective-500">
                    {/* Floor */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cyan-800 to-cyan-600 transform rotateX-60 origin-bottom"></div>

                    {/* Walls */}
                    <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-green-400 to-green-600 transform rotateY-15"></div>
                    <div className="absolute top-0 right-0 w-32 h-48 bg-gradient-to-l from-cyan-400 to-cyan-600 transform rotateY-75"></div>

                    {/* Gaming Elements */}
                    <div className="absolute bottom-16 left-10 w-12 h-16 bg-gradient-to-t from-blue-600 to-blue-400 rounded transform rotateX-30"></div>
                    <div className="absolute bottom-12 right-10 w-16 h-8 bg-gradient-to-t from-green-600 to-green-400 rounded transform rotateX-45"></div>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-bold text-white mb-2">Gaming Arena</h3>
                    <p className="text-white/80 text-sm">Multiplayer gaming environment</p>
                  </div>

                  {/* Interactive Badge */}
                  <div className="absolute top-4 right-4 bg-cyan-500 text-black px-3 py-1 rounded-full text-xs font-bold flex items-center">
                    <div className="w-2 h-2 bg-black rounded-full mr-1 animate-pulse"></div>
                    Interactive
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Features */}
          <div className="mt-20 text-center">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="group">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Instant Messaging</h3>
                <p className="text-white/70">Real-time chat with zero latency</p>
              </div>

              <div className="group">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Live Media Sharing</h3>
                <p className="text-white/70">Stream video and audio instantly</p>
              </div>

              <div className="group">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Live Collaboration</h3>
                <p className="text-white/70">Work together in real-time</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Features */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-black"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Next-Gen Features
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Real-time Collaboration */}
            <div className="group relative bg-gradient-to-br from-blue-900/50 to-purple-900/50 p-8 rounded-2xl border border-cyan-500/20 hover:border-cyan-500/50 transition-all duration-500 hover:transform hover:scale-105">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Real-time Collaboration</h3>
              <p className="text-white/80">Work together in real-time with voice, video, and shared whiteboards</p>
            </div>

            {/* Live Media Streaming */}
            <div className="group relative bg-gradient-to-br from-purple-900/50 to-pink-900/50 p-8 rounded-2xl border border-purple-500/20 hover:border-purple-500/50 transition-all duration-500 hover:transform hover:scale-105">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Live Media Streaming</h3>
              <p className="text-white/80">Real-time video, audio, and screen sharing with zero latency</p>
            </div>

            {/* Enterprise Security */}
            <div className="group relative bg-gradient-to-br from-green-900/50 to-cyan-900/50 p-8 rounded-2xl border border-green-500/20 hover:border-green-500/50 transition-all duration-500 hover:transform hover:scale-105">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-cyan-600 rounded-xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Enterprise Security</h3>
              <p className="text-white/80">End-to-end encryption with role-based access control</p>
            </div>
          </div>
        </div>
      </section>

      {/* Future Enhancements */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black to-purple-900/20"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              Coming Soon
            </h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto">
              Exciting features in development to enhance your metaverse experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* VR Headset Support */}
            <div className="group relative bg-gradient-to-br from-yellow-900/30 to-orange-900/30 p-8 rounded-2xl border border-yellow-500/20 hover:border-yellow-500/50 transition-all duration-500">
              <div className="absolute top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold">
                Q2 2025
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">VR Headset Support</h3>
              <p className="text-white/80">Full compatibility with Meta Quest, HTC Vive, and other major VR headsets</p>
            </div>

            {/* AI-Powered Avatars */}
            <div className="group relative bg-gradient-to-br from-purple-900/30 to-pink-900/30 p-8 rounded-2xl border border-purple-500/20 hover:border-purple-500/50 transition-all duration-500">
              <div className="absolute top-4 right-4 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                Q3 2025
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">AI-Powered Avatars</h3>
              <p className="text-white/80">Intelligent avatars with facial recognition, emotion mapping, and natural gestures</p>
            </div>

            {/* Spatial Audio */}
            <div className="group relative bg-gradient-to-br from-green-900/30 to-cyan-900/30 p-8 rounded-2xl border border-green-500/20 hover:border-green-500/50 transition-all duration-500">
              <div className="absolute top-4 right-4 bg-green-500 text-black px-3 py-1 rounded-full text-xs font-bold">
                Q4 2025
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-cyan-600 rounded-xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">3D Spatial Audio</h3>
              <p className="text-white/80">Immersive 3D positional audio with distance-based volume and directional sound</p>
            </div>

            {/* Haptic Feedback */}
            <div className="group relative bg-gradient-to-br from-blue-900/30 to-indigo-900/30 p-8 rounded-2xl border border-blue-500/20 hover:border-blue-500/50 transition-all duration-500">
              <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                2026
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Haptic Feedback</h3>
              <p className="text-white/80">Touch and force feedback for realistic object interaction in virtual spaces</p>
            </div>

            {/* Blockchain Integration */}
            <div className="group relative bg-gradient-to-br from-orange-900/30 to-red-900/30 p-8 rounded-2xl border border-orange-500/20 hover:border-orange-500/50 transition-all duration-500">
              <div className="absolute top-4 right-4 bg-orange-500 text-black px-3 py-1 rounded-full text-xs font-bold">
                2026
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Blockchain Assets</h3>
              <p className="text-white/80">NFT avatars, virtual real estate ownership, and decentralized identity verification</p>
            </div>

            {/* AR Integration */}
            <div className="group relative bg-gradient-to-br from-teal-900/30 to-cyan-900/30 p-8 rounded-2xl border border-teal-500/20 hover:border-teal-500/50 transition-all duration-500">
              <div className="absolute top-4 right-4 bg-teal-500 text-black px-3 py-1 rounded-full text-xs font-bold">
                2026
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">AR Integration</h3>
              <p className="text-white/80">Augmented reality overlay for mixed reality experiences and real-world integration</p>
            </div>
          </div>

          <div className="text-center mt-16">
            <p className="text-white/60 text-lg">
              Want to be notified when these features launch?
              <span className="text-cyan-400 ml-2">Join our waitlist below!</span>
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/50 via-purple-900/50 to-pink-900/50"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Ready to Enter the
            <span className="block bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Future?
            </span>
          </h2>
          <p className="text-xl text-white/80 mb-12 max-w-3xl mx-auto">
            Join millions of users already exploring the metaverse. Create your avatar,
            build your space, and connect with others in ways never before possible.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <button
              onClick={handleGetStarted}
              className="group relative bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white px-12 py-6 rounded-full text-xl font-bold transition-all duration-500 transform hover:scale-110 shadow-2xl hover:shadow-cyan-500/50"
              suppressHydrationWarning
            >
              <span className="relative z-10">Start Your Journey</span>
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
            </button>

            <button
              onClick={handleDemo}
              className="group relative border-2 border-cyan-400 text-cyan-400 hover:text-white px-12 py-6 rounded-full text-xl font-bold transition-all duration-500 transform hover:scale-110 hover:bg-cyan-400/10"
              suppressHydrationWarning
            >
              <span className="relative z-10">Try Live Demo</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h3 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-8">
              MetaSpace
            </h3>
            <p className="text-white/60 mb-8 max-w-2xl mx-auto">
              The next generation metaverse platform for immersive collaboration,
              creative expression, and virtual experiences.
            </p>

            {/* Newsletter */}
            <form onSubmit={handleNewsletterSignup} className="max-w-md mx-auto flex gap-4 mb-12">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email for early access"
                className="flex-1 px-6 py-4 rounded-full border border-white/20 bg-white/5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 backdrop-blur-sm"
                required
                suppressHydrationWarning
              />
              <button
                type="submit"
                className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white px-8 py-4 rounded-full font-semibold transition-all duration-300 transform hover:scale-105"
                suppressHydrationWarning
              >
                Join Waitlist
              </button>
            </form>

            <div className="border-t border-white/10 pt-8">
              <p className="text-white/40">
                © 2024 MetaSpace. All rights reserved. Built for the future of human connection.
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Enhanced Custom Styles */}
      <style jsx>{`
        /* Grid Background */
        .grid-background {
          position: absolute;
          width: 100%;
          height: 100%;
          background-image: 
            linear-gradient(rgba(34, 211, 238, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.1) 1px, transparent 1px);
          background-size: 50px 50px;
          animation: grid-move 20s linear infinite;
        }
        
        .grid-overlay {
          position: absolute;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.3) 100%);
        }
        
        @keyframes grid-move {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
        
        /* Enhanced Stars */
        .stars-container {
          position: absolute;
          width: 100%;
          height: 100%;
        }
        
        .star {
          position: absolute;
          background: white;
          border-radius: 50%;
          animation: twinkle-enhanced 4s infinite;
        }
        
        @keyframes twinkle-enhanced {
          0%, 100% { 
            opacity: 0.2; 
            transform: scale(1) rotate(0deg); 
            box-shadow: 0 0 6px rgba(255, 255, 255, 0.3);
          }
          25% { 
            opacity: 0.8; 
            transform: scale(1.3) rotate(90deg); 
            box-shadow: 0 0 12px rgba(34, 211, 238, 0.6);
          }
          50% { 
            opacity: 1; 
            transform: scale(1.5) rotate(180deg); 
            box-shadow: 0 0 18px rgba(168, 85, 247, 0.8);
          }
          75% { 
            opacity: 0.6; 
            transform: scale(1.2) rotate(270deg); 
            box-shadow: 0 0 10px rgba(236, 72, 153, 0.5);
          }
        }
        
        /* Enhanced Floating Animations */
        @keyframes orbit-slow {
          0% { transform: translateY(0px) rotate(0deg) scale(1); }
          25% { transform: translateY(-30px) rotate(90deg) scale(1.1); }
          50% { transform: translateY(-20px) rotate(180deg) scale(1.2); }
          75% { transform: translateY(-40px) rotate(270deg) scale(1.1); }
          100% { transform: translateY(0px) rotate(360deg) scale(1); }
        }
        
        @keyframes orbit-medium {
          0% { transform: translateY(0px) rotate(0deg) scale(1); }
          33% { transform: translateY(-25px) rotate(120deg) scale(1.15); }
          66% { transform: translateY(-35px) rotate(240deg) scale(0.9); }
          100% { transform: translateY(0px) rotate(360deg) scale(1); }
        }
        
        @keyframes orbit-fast {
          0% { transform: translateY(0px) rotate(0deg) scale(1); }
          50% { transform: translateY(-15px) rotate(180deg) scale(1.3); }
          100% { transform: translateY(0px) rotate(360deg) scale(1); }
        }
        
        @keyframes float-rotate {
          0% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-20px) rotate(90deg); }
          50% { transform: translateY(-10px) rotate(180deg); }
          75% { transform: translateY(-30px) rotate(270deg); }
          100% { transform: translateY(0px) rotate(360deg); }
        }
        
        @keyframes float-scale {
          0% { transform: scale(1) translateY(0px); }
          50% { transform: scale(1.4) translateY(-25px); }
          100% { transform: scale(1) translateY(0px); }
        }
        
        /* Text Animations */
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(60px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes bounce-in {
          0% { opacity: 0; transform: scale(0.3) translateY(-100px); }
          50% { opacity: 1; transform: scale(1.05) translateY(0); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        
        @keyframes letter-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-10px) rotate(2deg); }
          50% { transform: translateY(-5px) rotate(-1deg); }
          75% { transform: translateY(-15px) rotate(1deg); }
        }
        
        @keyframes text-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        
        @keyframes scale-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes text-wave {
          0%, 100% { transform: translateY(0px); }
          25% { transform: translateY(-2px); }
          50% { transform: translateY(-4px); }
          75% { transform: translateY(-2px); }
        }
        
        @keyframes text-glow {
          0%, 100% { text-shadow: 0 0 10px currentColor; }
          50% { text-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
        }
        
        /* Button Animations */
        @keyframes button-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(34, 211, 238, 0.3); }
          50% { box-shadow: 0 0 40px rgba(34, 211, 238, 0.6), 0 0 60px rgba(168, 85, 247, 0.4); }
        }
        
        @keyframes button-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        
        @keyframes border-glow {
          0%, 100% { border-color: rgba(34, 211, 238, 0.5); box-shadow: 0 0 15px rgba(34, 211, 238, 0.2); }
          50% { border-color: rgba(34, 211, 238, 1); box-shadow: 0 0 30px rgba(34, 211, 238, 0.5); }
        }
        
        /* Avatar Animations */
        @keyframes blink-smart {
          0%, 85%, 100% { transform: scaleY(1); }
          90%, 95% { transform: scaleY(0.1); }
        }
        
        @keyframes smile {
          0%, 100% { transform: translateX(-50%) scaleX(1); }
          50% { transform: translateX(-50%) scaleX(1.2); }
        }
        
        @keyframes pulse-subtle {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.02); opacity: 0.95; }
        }
        
        @keyframes orbit-particles {
          0% { transform: rotate(0deg) translateX(30px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(30px) rotate(-360deg); }
        }
        
        @keyframes orbit-particles-large {
          0% { transform: rotate(0deg) translateX(40px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(40px) rotate(-360deg); }
        }
        
        /* Scroll Animations */
        @keyframes scroll-dot {
          0% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(15px); opacity: 0.5; }
          100% { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes glow-pulse {
          0%, 100% { border-color: rgba(255, 255, 255, 0.3); }
          50% { border-color: rgba(34, 211, 238, 0.8); }
        }
        
        @keyframes fade-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        /* Spin Variations */
        @keyframes spin-very-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes spin-reverse-slow {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        
        @keyframes spin-fast {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes spin-reverse-fast {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        
        /* Apply Animations */
        .animate-orbit-slow { animation: orbit-slow 8s ease-in-out infinite; }
        .animate-orbit-medium { animation: orbit-medium 6s ease-in-out infinite; }
        .animate-orbit-fast { animation: orbit-fast 4s ease-in-out infinite; }
        .animate-float-rotate { animation: float-rotate 5s ease-in-out infinite; }
        .animate-float-scale { animation: float-scale 3s ease-in-out infinite; }
        
        .animate-fade-in-up { animation: fade-in-up 1s ease-out; }
        .animate-bounce-in { animation: bounce-in 0.8s ease-out; }
        .animate-letter-float { animation: letter-float 3s ease-in-out infinite; }
        .animate-text-shimmer { animation: text-shimmer 3s linear infinite; background-size: 200% auto; }
        .animate-scale-pulse { animation: scale-pulse 2s ease-in-out infinite; }
        .animate-text-wave { animation: text-wave 2s ease-in-out infinite; }
        .animate-text-glow { animation: text-glow 2s ease-in-out infinite; }
        
        .animate-button-glow { animation: button-glow 2s ease-in-out infinite; }
        .animate-button-pulse { animation: button-pulse 2s ease-in-out infinite; }
        .animate-pulse-ring { animation: pulse-ring 2s ease-out infinite; }
        .animate-border-glow { animation: border-glow 2s ease-in-out infinite; }
        
        .animate-blink-smart { animation: blink-smart 4s infinite; }
        .animate-smile { animation: smile 3s ease-in-out infinite; }
        .animate-pulse-subtle { animation: pulse-subtle 4s ease-in-out infinite; }
        .animate-orbit-particles { animation: orbit-particles 8s linear infinite; }
        .animate-orbit-particles-large { animation: orbit-particles-large 10s linear infinite; }
        
        .animate-scroll-dot { animation: scroll-dot 2s ease-in-out infinite; }
        .animate-glow-pulse { animation: glow-pulse 2s ease-in-out infinite; }
        .animate-fade-pulse { animation: fade-pulse 3s ease-in-out infinite; }
        .animate-bounce-slow { animation: bounce-slow 3s ease-in-out infinite; }
        
        .animate-spin-very-slow { animation: spin-very-slow 30s linear infinite; }
        .animate-spin-reverse-slow { animation: spin-reverse-slow 25s linear infinite; }
        .animate-spin-fast { animation: spin-fast 8s linear infinite; }
        .animate-spin-reverse-fast { animation: spin-reverse-fast 6s linear infinite; }
        .animate-spin-medium { animation: spin-fast 12s linear infinite; }
        
        .animate-pulse-slow { animation: pulse 4s ease-in-out infinite; }
        .animate-pulse-medium { animation: pulse 2s ease-in-out infinite; }
        .animate-pulse-fast { animation: pulse 1s ease-in-out infinite; }
        
        /* Animation Delays */
        .animation-delay-100 { animation-delay: 0.1s; }
        .animation-delay-200 { animation-delay: 0.2s; }
        .animation-delay-300 { animation-delay: 0.3s; }
        .animation-delay-400 { animation-delay: 0.4s; }
        .animation-delay-500 { animation-delay: 0.5s; }
        .animation-delay-600 { animation-delay: 0.6s; }
        .animation-delay-700 { animation-delay: 0.7s; }
        .animation-delay-800 { animation-delay: 0.8s; }
        .animation-delay-1000 { animation-delay: 1s; }
        
        /* 3D Transforms */
        .perspective-1000 { perspective: 1000px; }
        .perspective-500 { perspective: 500px; }
        .transform-gpu { transform: translateZ(0); }
        .rotateX-30 { transform: rotateX(30deg); }
        .rotateX-45 { transform: rotateX(45deg); }
        .rotateX-60 { transform: rotateX(60deg); }
        .rotateY-15 { transform: rotateY(15deg); }
        .rotateY-75 { transform: rotateY(75deg); }
        .rotate-y-12:hover { transform: rotateY(12deg); }
      `}</style>
    </div>
  );
}