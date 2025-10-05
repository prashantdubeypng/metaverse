"use client";

import React from 'react';
import { Position3D } from '@/types/video-call';

interface ProximityIndicatorProps {
  currentPosition: Position3D;
  targetPosition: Position3D;
  maxRange: number;
  className?: string;
  showDistance?: boolean;
  showCoordinates?: boolean;
}

const ProximityIndicator: React.FC<ProximityIndicatorProps> = ({
  currentPosition,
  targetPosition,
  maxRange,
  className = '',
  showDistance = true,
  showCoordinates = false
}) => {
  // Calculate 3D distance
  const calculateDistance = (pos1: Position3D, pos2: Position3D): number => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = (pos1.z || 0) - (pos2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  const distance = calculateDistance(currentPosition, targetPosition);
  const isInRange = distance <= maxRange;
  const proximityPercentage = Math.min((distance / maxRange) * 100, 100);
  
  // Calculate direction angle (2D projection for simplicity)
  const dx = targetPosition.x - currentPosition.x;
  const dy = targetPosition.y - currentPosition.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Get color based on proximity
  const getProximityColor = (): string => {
    if (!isInRange) return '#ef4444'; // red-500
    if (proximityPercentage <= 30) return '#22c55e'; // green-500
    if (proximityPercentage <= 60) return '#eab308'; // yellow-500
    return '#f97316'; // orange-500
  };

  // Get signal strength bars
  const getSignalBars = (): number => {
    if (!isInRange) return 0;
    if (proximityPercentage <= 25) return 4;
    if (proximityPercentage <= 50) return 3;
    if (proximityPercentage <= 75) return 2;
    return 1;
  };

  const color = getProximityColor();
  const signalBars = getSignalBars();

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      {/* Radar/Direction Indicator */}
      <div className="relative w-12 h-12">
        {/* Outer range circle */}
        <div className="absolute inset-0 border-2 border-gray-300 rounded-full opacity-30"></div>
        
        {/* Range fill */}
        <div 
          className="absolute inset-1 rounded-full transition-all duration-300"
          style={{
            backgroundColor: color,
            opacity: isInRange ? 0.2 : 0.1,
            transform: `scale(${isInRange ? 1 : 0.5})`
          }}
        ></div>
        
        {/* Center dot (current position) */}
        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-600 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
        
        {/* Target indicator */}
        <div 
          className="absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
          style={{
            backgroundColor: color,
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${Math.min(proximityPercentage / 100 * 16, 16)}px)`
          }}
        ></div>
        
        {/* Direction arrow */}
        {isInRange && (
          <div 
            className="absolute top-1/2 left-1/2 w-0 h-0 transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-300"
            style={{
              borderLeft: '3px solid transparent',
              borderRight: '3px solid transparent',
              borderBottom: `6px solid ${color}`,
              transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`
            }}
          ></div>
        )}
      </div>

      {/* Signal Strength Bars */}
      <div className="flex items-end space-x-1">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={`w-1.5 transition-all duration-300 ${
              bar <= signalBars ? 'opacity-100' : 'opacity-20'
            }`}
            style={{
              height: `${bar * 3 + 6}px`,
              backgroundColor: bar <= signalBars ? color : '#d1d5db'
            }}
          ></div>
        ))}
      </div>

      {/* Distance and Status Info */}
      <div className="flex flex-col">
        {showDistance && (
          <span 
            className="text-sm font-medium"
            style={{ color }}
          >
            {distance.toFixed(1)}u
          </span>
        )}
        
        <span className="text-xs text-gray-500">
          {isInRange ? 'In range' : 'Out of range'}
        </span>
        
        {showCoordinates && (
          <span className="text-xs text-gray-400 mt-1">
            ({targetPosition.x.toFixed(1)}, {targetPosition.y.toFixed(1)}, {(targetPosition.z || 0).toFixed(1)})
          </span>
        )}
      </div>

      {/* Connection Status Icon */}
      <div className="flex items-center">
        {isInRange ? (
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke={color} 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" 
            />
          </svg>
        ) : (
          <svg 
            className="w-5 h-5 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" 
            />
          </svg>
        )}
      </div>
    </div>
  );
};

// Compact version for small spaces
export const CompactProximityIndicator: React.FC<ProximityIndicatorProps> = ({
  currentPosition,
  targetPosition,
  maxRange,
  className = ''
}) => {
  const calculateDistance = (pos1: Position3D, pos2: Position3D): number => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = (pos1.z || 0) - (pos2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  const distance = calculateDistance(currentPosition, targetPosition);
  const isInRange = distance <= maxRange;
  const proximityPercentage = Math.min((distance / maxRange) * 100, 100);

  const getProximityColor = (): string => {
    if (!isInRange) return '#ef4444';
    if (proximityPercentage <= 30) return '#22c55e';
    if (proximityPercentage <= 60) return '#eab308';
    return '#f97316';
  };

  return (
    <div className={`inline-flex items-center space-x-1 ${className}`}>
      <div 
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: getProximityColor() }}
      ></div>
      <span className="text-xs text-gray-600">
        {distance.toFixed(1)}u
      </span>
    </div>
  );
};

export default ProximityIndicator;
