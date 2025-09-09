export interface OutgoingMessage {
    type: string;
    payload: any;
}

export interface IncomingMessage {
    type: 'join' | 'move' | 'leave' | 'chat-join' | 'chat-message' | 'chat-leave' | 'video-call-signaling' | 'video-call-end';
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