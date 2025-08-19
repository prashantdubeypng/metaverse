export interface OutgoingMessage {
    type: string;
    payload: any;
}

export interface IncomingMessage {
    type: 'join' | 'move' | 'leave';
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

export type outgoingmessage = OutgoingMessage;