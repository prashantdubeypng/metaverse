import{Roommanager}from'./Roommanager';
import { outgoingmessage } from './types';
import { WebSocket } from 'ws';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { jwt_password } from './config';
import client from '@repo/db';
function getRandomIdForUser(length = 15) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@$%&*';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
export class User {
    public id:string
    private SpaceId?: string;
    private UserId?: string;
    private x: number;
    private y: number;
    constructor(private ws: WebSocket) {
        this.id = getRandomIdForUser();
        this.x = 0;
        this.y = 0;
   }
   public initHandlers() {
    this.ws.on('message', async(data) => {
        const parseData = JSON.parse(data.toString());
        switch(parseData.type){
            case 'join':
                const SpaceId = parseData.payload.spaceId;
                const token = parseData.payload.token;
                if(!token){
                    this.ws.close(1008, 'Invalid token');
                    return;
                }
                try {
                  const decode = jwt.verify(parseData.payload.token, jwt_password);
                  console.log(decode)
                     // Token is valid, continue...
                    } catch (err) {
                        // Token is invalid or expired
                        this.ws.close(1008, 'Invalid token');
                        return;
}
                console.log('should work now......1......1.1.11.1..1.1')
                
                // it will verify the  token and if it is not valid just close the connection and send response
                
                const User = (jwt.verify(token, jwt_password) as JwtPayload).userId;
                if(!User){
                    this.ws.close(1008, 'Invalid token');
                    return;
                }
                this.UserId = User;
                const space = await client.space.findFirst({
                    where:{
                        id: SpaceId
                    }
                })
                console.log('reacing space to check')
                if(!space){
                    this.ws.close(1008, 'Space not found');
                    return;
                }
                console.log('should... work....2.2..2.2.2.3..3.2.2.2..2.2.2')
                this.SpaceId = SpaceId;
                this.x = Math.floor(Math.random() * space.width);
                this.y = Math.floor(Math.random() * space.height);
                // Add user to the room manager
                 Roommanager.getInstance().broadCast({
                    type:'user-joined-space',
                    payload:{
                        userId:this.UserId,
                        x:this.x,
                        y:this.y,
                    }
                },this,this.SpaceId!);
                Roommanager.getInstance().addUser(SpaceId,this);
                this.send({
                    type:'Space-joined',
                    payload: {
                        'spawn':{
                            x:this.x,
                            y:this.y,
                        },
                        Users:Roommanager.getInstance().rooms.get(SpaceId)?.map(user => ({
                            userId: this.UserId,
                        }))??[],
                    }
                })
                break;
            case 'move':
                const movex = parseData.payload.x;
                const movey = parseData.payload.y;
                const xdisplaycement = Math.abs(this.x-movex)
                const ydisplaycement = Math.abs(this.y-movey)
                if((xdisplaycement === 1&&ydisplaycement===0)||(ydisplaycement === 1 && xdisplaycement === 0)){
                    // Update user position in the room manager
                    this.x = movex;
                    this.y = movey;
                    Roommanager.getInstance().broadCast({
                    type:'user-moved',
                    payload:{
                        userId:this.UserId,
                        x:movex,
                        y:movey
                    }
                },this,this.SpaceId!);
                return;
                }
                this.send({
                    type:'move-rejected',
                    payload:{
                      userId:this.UserId,
                      x:this.x,
                      y:this.y  
                    }
                })
                break;
            default:
                this.ws.close(1008, 'Invalid message type');
                break;
        }
    })
   }
   destroy(){
    Roommanager.getInstance().broadCast({
        type:'user-left',
        payload:{
            userId:this.UserId,  
        }
    },this,this.SpaceId!);
   }
   send(payload:outgoingmessage){
       this.ws.send(JSON.stringify(payload));
   }
}