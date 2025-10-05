export interface OutgoingMessage {
    type: string;
    payload: any;
}

export interface IncomingMessage {
    type: 'join' | 'move' | 'leave' | 'chat-join' | 'chat-message' | 'chat-leave' | 'video-call-signaling' | 'video-call-end' | 
          'proximity-video-call-signal' | 'proximity-position-update' | 'proximity-video-call-ended' | 'proximity-heartbeat' | 
          'authenticate' | 'heartbeat' | 'heartbeat-response';
    payload: any;
}

export interface JoinPayload {
    spaceId: string;
    token: string;
}

export interface MovePayload {
    x: number;
    y: number;
}

export interface UserPosition {
    userId: string;
    username: string;
    x: number;
    y: number;
}

export interface SpaceJoinedPayload {
    spawn: {
        x: number;
        y: number;
    };
    users: UserPosition[];
}

export interface ChatJoinPayload {
    chatroomId: string;
}

export interface ChatMessagePayload {
    chatroomId: string;
    content: string;
    type?: string;
}

export interface ChatLeavePayload {
    chatroomId: string;
}

export type outgoingmessage = OutgoingMessage;