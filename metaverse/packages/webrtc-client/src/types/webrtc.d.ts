// WebRTC type declarations to ensure compatibility
// These types should be available in modern browsers

declare global {
  interface RTCIceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
  }

  interface RTCConfiguration {
    iceServers?: RTCIceServer[];
    iceCandidatePoolSize?: number;
  }

  interface MediaTrackConstraints {
    width?: ConstrainULong;
    height?: ConstrainULong;
    frameRate?: ConstrainDouble;
    echoCancellation?: ConstrainBoolean;
    noiseSuppression?: ConstrainBoolean;
    autoGainControl?: ConstrainBoolean;
  }

  type ConstrainULong = number | { ideal?: number; exact?: number; min?: number; max?: number };
  type ConstrainDouble = number | { ideal?: number; exact?: number; min?: number; max?: number };
  type ConstrainBoolean = boolean | { ideal?: boolean; exact?: boolean };
}

export {};