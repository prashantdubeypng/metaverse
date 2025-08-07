import { User } from "./User";
import { outgoingmessage } from "./types";
export class Roommanager {
    rooms: Map<string, User[]> = new Map();
    static instance: Roommanager;
    private constructor() {
        this.rooms = new Map();
    }
    static getInstance(): Roommanager {
        if (!this.instance) {
            this.instance = new Roommanager();
        }
        return this.instance;
    }
    // in the class no need to write the function keyword to create the function
    public addUser(spaceId: string, user: User) {
        if (!this.rooms.has(spaceId)) {
            this.rooms.set(spaceId, []);
        }
        this.rooms.set(spaceId,[...this.rooms.get(spaceId)!, user]);
    }
    public broadCast(message: outgoingmessage,user:User , SpaceId: string) {
        if(!this.rooms.has(SpaceId)) {
            return;
        }
        this.rooms.get(SpaceId)?.forEach(u => {
            if (u.id !== user.id) {
                u.send(message);
            }
        });
    }
    public removeUser(user: User, SpaceId: string) {
        if (!this.rooms.has(SpaceId)) {
            return;
        }
        this.rooms.set(SpaceId, this.rooms.get(SpaceId)?.filter(u => u.id !== user.id) ?? []);
    }
    // public moveUser(user: User, SpaceId: string, x: number, y: number) {
    //     if (!this.rooms.has(SpaceId)) {
    //         return;
    //     }
    //     const room = this.rooms.get(SpaceId);
    //     const userIndex = room?.findIndex(u => u.id === user.id);
    //     if (userIndex !== undefined && userIndex !== -1) {
    //         room[userIndex].x = x;
    //         room[userIndex].y = y;
    //     }
    // }
}